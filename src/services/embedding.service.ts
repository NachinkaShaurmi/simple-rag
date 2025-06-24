import { pipeline } from "@huggingface/transformers";
import * as lancedb from "@lancedb/lancedb";
import { config } from "../config";
import { DocumentChunk } from "../interfaces";
import { logger } from "../utils/logger";
import { Table } from "@lancedb/lancedb";

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: any;
  private db: any;
  private table: Table | null = null;
  private instanceId: string = crypto.randomUUID();

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  initialize = async () => {
    try {
      logger.info(`Initializing EmbeddingService instance: ${this.instanceId}`);
      this.embedder = await pipeline(
        "feature-extraction",
        config.embeddingModel,
        {
          dtype: "fp32",
        }
      );

      logger.info(
        `Embedder initialized for instance ${this.instanceId}: ${typeof this
          .embedder}`
      );
      if (typeof this.embedder !== "function") {
        logger.error(
          `Embedder is not a function for instance ${this.instanceId}`,
          this.embedder
        );
        throw new Error(
          "Failed to initialize embedder: Not a callable function"
        );
      }

      this.db = await lancedb.connect(config.lanceDbPath);

      const tableExists = await this.db
        .tableNames()
        .then((names: string[]) => names.includes("documents"));
      if (tableExists) {
        logger.info(
          `Table "documents" already exists, opening it for instance ${this.instanceId}`
        );
        this.table = await this.db.openTable("documents");

        // Remove the temp record if it exists
        try {
          // Check if there are any records first (optional)
          const allRecords = await this.table?.countRows();
          logger.info(`Table has ${allRecords} total records`);

          // Delete temp records directly
          await this.table?.delete("id = 'temp'");
          logger.info("Removed any existing temp records from table");
        } catch (error) {
          logger.warn(`Could not remove temp record: ${error}`);
        }
      } else {
        logger.info(
          `Creating new "documents" table for instance ${this.instanceId}`
        );
        // Create table with temp record
        this.table = await this.db.createTable("documents", [
          {
            id: "temp",
            vector: new Array(384).fill(0),
            content: "",
            source: "",
            chunkIndex: 0,
          },
        ]);

        // Immediately remove the temp record after table creation
        logger.info("Removing temp record after table creation");
        await this.table?.delete("id = 'temp'");
      }
    } catch (error) {
      logger.error(
        `Failed to initialize embedding service for instance ${this.instanceId}: ${error}`
      );
      throw error;
    }
  };

  createEmbeddings = async (
    chunks: DocumentChunk[]
  ): Promise<DocumentChunk[]> => {
    const embeddedChunks: DocumentChunk[] = [];

    if (!this.embedder) {
      logger.error(
        `Embedder not initialized in createEmbeddings for instance ${this.instanceId}`
      );
      throw new Error("Embedder not initialized");
    }

    logger.info(`Processing ${chunks.length} chunks for embedding`);

    for (const chunk of chunks) {
      try {
        logger.info(
          `Embedding chunk ${chunk.id} from ${chunk.metadata.source}`
        );
        const embedding = await this.embedder(chunk.content, {
          pooling: "mean",
          normalize: true,
        });

        const vector: number[] = Array.from(embedding.data);
        logger.info(`Vector length for chunk ${chunk.id}: ${vector.length}`);

        if (!vector || vector.length === 0) {
          logger.error(`Empty vector generated for chunk ${chunk.id}`);
          continue;
        }

        const embeddedChunk = {
          ...chunk,
          vector,
        };
        embeddedChunks.push(embeddedChunk);

        const existingArray = await this.table?.vectorSearch(vector).toArray();

        if (existingArray?.length === 0) {
          await this.table?.add([
            {
              id: chunk.id,
              vector,
              content: chunk.content,
              source: chunk.metadata.source,
              chunkIndex: chunk.metadata.chunkIndex,
            },
          ]);
          logger.info(
            `Embedded and stored chunk ${chunk.id} from ${chunk.metadata.source} with vector length ${vector.length}`
          );
        } else {
          logger.info(
            `Chunk ${chunk.id} from ${chunk.metadata.source} already exists, skipping`
          );
        }
      } catch (error) {
        logger.error(`Error embedding chunk ${chunk.id}: ${error}`);
      }
    }

    if (embeddedChunks.length === 0) {
      logger.warn(`No chunks embedded successfully`);
    }

    return embeddedChunks;
  };

  search = async (query: string, k: number = 3): Promise<DocumentChunk[]> => {
    try {
      const queryEmbedding = await this.embedder(query, {
        pooling: "mean",
        normalize: true,
      });

      const resultsArray = await this.table
        ?.vectorSearch(Array.from(queryEmbedding.data))
        .limit(k)
        .toArray();

      logger.info(`Raw search results: ${JSON.stringify(resultsArray)}`);

      logger.info(
        `Search results type for instance ${
          this.instanceId
        }: ${typeof resultsArray}, isArray: ${Array.isArray(resultsArray)}`
      );
      if (resultsArray && typeof resultsArray === "object") {
        logger.info(`Search results keys: ${Object.keys(resultsArray)}`);
      }

      if (!Array.isArray(resultsArray)) {
        logger.error(
          `Results is not an array for instance ${this.instanceId}`,
          resultsArray
        );
        throw new Error("Search results is not an array");
      }

      logger.info(`Found ${resultsArray.length} search results`);
      return resultsArray.map((result: any) => ({
        id: result.id,
        content: result.content,
        vector: result.vector,
        metadata: {
          source: result.source,
          chunkIndex: result.chunkIndex,
        },
      }));
    } catch (error) {
      logger.error(`Search error for instance ${this.instanceId}: ${error}`);
      throw error;
    }
  };

  cleanup = async () => {
    try {
      if (this.db) {
        logger.info(
          `Closing database connection for instance ${this.instanceId}`
        );
        this.db.close();
        this.db = null;
        this.table = null;
      }
      logger.info(
        `EmbeddingService cleanup completed for instance ${this.instanceId}`
      );
    } catch (error) {
      logger.error(`Error during EmbeddingService cleanup: ${error}`);
    }
  };
}
