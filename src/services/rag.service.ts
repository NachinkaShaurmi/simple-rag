import { pipeline } from "@huggingface/transformers";
import { config } from "../config";
import { DocumentService } from "./document.service";
import { EmbeddingService } from "./embedding.service";
import { DocumentChunk, RagResponse } from "../interfaces";
import { logger } from "../utils/logger";

// Singleton pattern for RagService
export class RagService {
  private static instance: RagService;
  private documentService: DocumentService;
  private embeddingService: EmbeddingService;
  private llm: any;

  private constructor() {
    this.documentService = new DocumentService();
    this.embeddingService = EmbeddingService.getInstance(); // Use singleton
  }

  static getInstance(): RagService {
    if (!RagService.instance) {
      RagService.instance = new RagService();
    }
    return RagService.instance;
  }

  initialize = async () => {
    try {
      await this.embeddingService.initialize();
      this.llm = await pipeline("text-generation", config.llmModel, {
        dtype: "fp32",
      });

      logger.info(`LLM initialized: ${typeof this.llm}`);

      const chunks = await this.documentService.loadAndProcessDocuments();
      await this.embeddingService.createEmbeddings(chunks);
      logger.info("RAG pipeline initialized");
    } catch (error) {
      logger.error(`Failed to initialize RAG service: ${error}`);
      throw error;
    }
  };

  private createPrompt = (
    question: string,
    contexts: DocumentChunk[]
  ): string => {
    const contextStr = contexts
      .map((chunk) => `Source: ${chunk.metadata.source}\n${chunk.content}`)
      .join("\n\n");

    return `Using the following context, answer the question concisely and accurately. Cite sources where appropriate.

Context:
${contextStr}

Question: ${question}

Answer:`;
  };

  processQuestion = async (question: string): Promise<RagResponse> => {
    try {
      logger.info("Processing question, checking embedding service");
      const contexts = await this.embeddingService.search(question);

      if (contexts.length === 0) {
        logger.warn("No relevant context found for the question.");
        return {
          answer:
            "Sorry, I could not find relevant information to answer your question.",
          sources: [],
        };
      }

      const prompt = this.createPrompt(question, contexts);
      const response = await this.llm(prompt, {
        max_new_tokens: 200,
        temperature: 0.1,
        timeout: 30000,
      });

      const answer =
        response[0].generated_text.split("Answer:")[1]?.trim() || "";

      logger.info(`Processed question: ${question}`);

      return {
        answer,
        sources: contexts.map((chunk) => ({
          content: chunk.content,
          source: chunk.metadata.source,
        })),
      };
    } catch (error) {
      logger.error(`Error processing question: ${error}`);
      throw error;
    }
  };
}
