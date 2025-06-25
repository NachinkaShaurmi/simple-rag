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
        { dtype: "fp32" }
      );
      this.db = await lancedb.connect(config.lanceDbPath);

      // Drop existing table to ensure fresh state
      const tableNames = await this.db.tableNames();
      if (tableNames.includes("documents")) {
        logger.info("Dropping existing documents table");
        await this.db.dropTable("documents");
      }

      // Create new table
      this.table = await this.db.createTable("documents", [
        {
          id: "temp",
          vector: new Array(384).fill(0),
          content: "",
          source: "",
          chunkIndex: 0,
        },
      ]);
      await this.table?.delete("id = 'temp'");
    } catch (error) {
      logger.error(`Failed to initialize embedding service: ${error}`);
      throw error;
    }
  };

  async createEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const embeddedChunks: DocumentChunk[] = [];

    if (!this.embedder) {
      logger.error(`Embedder not initialized for instance ${this.instanceId}`);
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

        const embeddedChunk = { ...chunk, vector };
        embeddedChunks.push(embeddedChunk);

        // Check for existing chunk by ID
        const existing = await this.table
          ?.query()
          .where(`id = '${chunk.id}'`)
          .toArray();

        if (!existing || existing.length === 0) {
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
  }

  search = async (query: string, k: number = 10): Promise<DocumentChunk[]> => {
    try {
      const cleanedQuery = query.replace(/\n+/g, " ").trim();
      logger.info(`Searching for query: "${query}"`);
      const queryEmbedding = await this.embedder(cleanedQuery, {
        pooling: "mean",
        normalize: true,
      });

      const resultsArray = await this.table
        ?.vectorSearch(Array.from(queryEmbedding.data))
        .limit(k)
        .toArray();

      logger.info(
        `Raw search results: ${JSON.stringify(
          resultsArray?.map((el) => el?.content)
        )}`
      );
      logger.info(`Found ${resultsArray?.length || 0} raw search results`);

      if (!Array.isArray(resultsArray)) {
        logger.error(
          `Results is not an array for instance ${this.instanceId}`,
          resultsArray
        );
        return [];
      }

      // Filter out empty or irrelevant results
      const queryWords = cleanedQuery.toLowerCase().split(/\s+/);
      const validResults = resultsArray.filter((result) =>
        queryWords.some((word) => result.content.toLowerCase().includes(word))
      );

      logger.info(
        `Found ${validResults.length} valid search results after filtering`
      );

      // Apply relevance scoring
      const scoredResults = validResults.map((result: any) => {
        const content = result.content.toLowerCase();
        const queryLower = query.toLowerCase();

        // Calculate relevance score based on exact matches
        let relevanceScore = 0;

        // Extract artist name from query
        const artistMatch = query.match(/(?:artist:|by|about)\s*([^,\n]+)/i);
        if (artistMatch) {
          const artistName = artistMatch[1].trim().toLowerCase();
          if (content.includes(`artist: ${artistName}`)) {
            relevanceScore += 10; // High score for exact artist match
          } else if (content.includes(artistName)) {
            relevanceScore += 5; // Medium score for partial match
          }
        }

        // Check for other query terms
        const queryWords = queryLower
          .split(/\s+/)
          .filter((word) => word.length > 3);
        queryWords.forEach((word) => {
          if (content.includes(word)) {
            relevanceScore += 1;
          }
        });

        return {
          ...result,
          relevanceScore,
          distance: result._distance || 0,
        };
      });

      // Sort by relevance score first, then by distance
      scoredResults.sort((a, b) => {
        if (a.relevanceScore !== b.relevanceScore) {
          return b.relevanceScore - a.relevanceScore; // Higher relevance first
        }
        return a.distance - b.distance; // Lower distance (more similar) first
      });

      // Deduplicate results by source
      const seenSources = new Set<string>();
      const uniqueResults = scoredResults.filter((result) => {
        if (seenSources.has(result.source)) {
          logger.info(`Skipping duplicate source: ${result.source}`);
          return false;
        }
        seenSources.add(result.source);
        return true;
      });

      logger.info(
        `After deduplication: ${uniqueResults.length} unique sources from ${scoredResults.length} total results`
      );

      // Take top k results
      const topResults = uniqueResults.slice(0, k);

      logger.info(
        `Top results after scoring: ${JSON.stringify(
          topResults.map((r) => ({
            artist: r.content.match(/artist:\s*([^\n]+)/)?.[1],
            relevanceScore: r.relevanceScore,
            distance: r.distance,
          }))
        )}`
      );

      console.log(
        "Search results:",
        topResults.map((r) => ({
          id: r.id,
          content: r.content.slice(0, 100),
          distance: r.distance,
        }))
      );

      return topResults.map((result: any) => ({
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
      return [];
    }
  };

  private createPrompt = (
    question: string,
    contexts: DocumentChunk[]
  ): string => {
    const contextText = contexts.map((ctx) => ctx.content).join("\n\n");
    return `Use this information to answer the question. Provide only factual information, do not ask follow-up questions.
Question: ${question}
Context: ${contextText}
Answer:`;
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
