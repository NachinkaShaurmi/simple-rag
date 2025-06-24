import { pipeline } from "@huggingface/transformers";
import * as lancedb from "@lancedb/lancedb";
import { config } from "../config";
import { DocumentChunk } from "../interfaces";
import { logger } from "../utils/logger";

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: any;
  private db: any;
  private table: any;
  private instanceId: string = Math.random().toString(36).substring(2);

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
      } else {
        logger.info(
          `Creating new "documents" table for instance ${this.instanceId}`
        );
        this.table = await this.db.createTable("documents", [
          {
            id: "temp",
            vector: new Array(384).fill(0),
            content: "",
            source: "",
            chunkIndex: 0,
          },
        ]);
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

        const existing = await this.table
          .search(vector)
          .where(`id = '${chunk.id}'`)
          .execute();
        const existingArray = Array.isArray(existing)
          ? existing
          : existing.toArray
          ? await existing.toArray()
          : [];

        if (existingArray.length === 0) {
          await this.table.add([
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

      const results = await this.table
        .search(Array.from(queryEmbedding.data))
        .limit(k)
        .execute();

      logger.info(`Raw search results: ${JSON.stringify(results)}`);

      logger.info(
        `Search results type for instance ${
          this.instanceId
        }: ${typeof results}, isArray: ${Array.isArray(results)}`
      );
      if (results && typeof results === "object") {
        logger.info(`Search results keys: ${Object.keys(results)}`);
      }

      const resultsArray = Array.isArray(results)
        ? results
        : results.toArray
        ? await results.toArray()
        : [];

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
}
