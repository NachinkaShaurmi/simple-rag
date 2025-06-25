import fs from "fs/promises";
import path from "path";
import { config } from "../config";
import { TextSplitter } from "../utils/text-splitter";
import { v4 as uuidv4 } from "uuid";
import { DocumentChunk } from "../interfaces";
import { logger } from "../utils/logger";

export class DocumentService {
  private splitter: TextSplitter;

  constructor() {
    this.splitter = new TextSplitter({
      chunkSize: 750,
      chunkOverlap: 75,
    });
  }

  private async findJsonFiles(dirPath: string): Promise<string[]> {
    const jsonFiles: string[] = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          // Recursively search subdirectories
          logger.info(`Searching subdirectory: ${fullPath}`);
          const subDirFiles = await this.findJsonFiles(fullPath);
          jsonFiles.push(...subDirFiles);
        } else if (item.isFile() && item.name.endsWith(".json")) {
          logger.info(`Found JSON file: ${fullPath}`);
          jsonFiles.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${dirPath}: ${error}`);
    }

    return jsonFiles;
  }

  async loadAndProcessDocuments(): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    try {
      logger.info(`Reading documents from ${config.documentPath}`);

      // Get all JSON files recursively
      const jsonFiles = await this.findJsonFiles(config.documentPath);
      logger.info(`Found ${jsonFiles.length} JSON files total`);

      for (const filePath of jsonFiles) {
        try {
          // Get relative path for source metadata
          const relativePath = path.relative(config.documentPath, filePath);
          logger.info(`Processing file: ${relativePath}`);

          const content = await fs.readFile(filePath, "utf-8");

          let doc: Record<string, string>;
          try {
            doc = JSON.parse(content);
          } catch (error) {
            logger.error(`Failed to parse JSON in ${relativePath}: ${error}`);
            continue;
          }

          const text = Object.entries(doc).reduce((acc, [key, value]) => {
            if (!!value) return acc + `\n${key}: ${value},`;

            return acc;
          }, "");

          const splitChunks = this.splitter.splitText(text);

          splitChunks.forEach((chunk, index) => {
            const chunkId = uuidv4();
            chunks.push({
              id: chunkId,
              content: chunk,
              vector: [], // Will be populated by EmbeddingService
              metadata: {
                source: relativePath, // Use relative path to show folder structure
                chunkIndex: index,
              },
            });
            logger.info(
              `Created chunk ${chunkId} from ${relativePath}, index ${index}`
            );
          });
        } catch (error) {
          logger.error(`Error processing file ${filePath}: ${error}`);
          // Continue with other files
        }
      }

      if (chunks.length === 0) {
        logger.warn(
          `No chunks created. Check if ${config.documentPath} contains valid .json files.`
        );
      } else {
        logger.info(
          `Successfully created ${chunks.length} chunks from ${jsonFiles.length} files`
        );
      }
    } catch (error) {
      logger.error(`Error processing documents: ${error}`);
    }

    console.log("list of chunks", chunks);

    return chunks;
  }
}
