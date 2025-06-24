import fs from "fs/promises";
import path from "path";
import { config } from "../config";
import { TextSplitter } from "../utils/text-splitter";
import { v4 as uuidv4 } from "uuid";
import { DocumentChunk } from "../interfaces";
import { logger } from "../utils/logger"; // Add logger

export class DocumentService {
  private splitter: TextSplitter;

  constructor() {
    this.splitter = new TextSplitter({
      chunkSize: 750,
      chunkOverlap: 75,
    });
  }

  async loadAndProcessDocuments(): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    try {
      logger.info(`Reading documents from ${config.documentPath}`);
      const files = await fs.readdir(config.documentPath);
      logger.info(`Found ${files.length} files in ${config.documentPath}`);

      for (const file of files) {
        if (file.endsWith(".json")) {
          logger.info(`Processing file: ${file}`);
          const filePath = path.join(config.documentPath, file);
          const content = await fs.readFile(filePath, "utf-8");

          let doc: Record<string, string>;
          try {
            doc = JSON.parse(content);
          } catch (error) {
            logger.error(`Failed to parse JSON in ${file}: ${error}`);
            continue;
          }

          const text = Object.entries(doc).reduce(
            (acc, [key, value]) => acc + `\n${key}: ${value}`,
            ""
          );

          const splitChunks = this.splitter.splitText(text);
          logger.info(`Split ${file} into ${splitChunks.length} chunks`, {
            chunks: splitChunks,
          });

          splitChunks.forEach((chunk, index) => {
            const chunkId = uuidv4();
            chunks.push({
              id: chunkId,
              content: chunk,
              vector: [], // Will be populated by EmbeddingService
              metadata: {
                source: file,
                chunkIndex: index,
              },
            });
            logger.info(
              `Created chunk ${chunkId} from ${file}, index ${index}`
            );
          });
        }
      }

      if (chunks.length === 0) {
        logger.warn(
          `No chunks created. Check if ${config.documentPath} contains valid .json files.`
        );
      }
    } catch (error) {
      logger.error(`Error processing documents: ${error}`);
    }

    console.log(888, chunks);

    return chunks;
  }
}
