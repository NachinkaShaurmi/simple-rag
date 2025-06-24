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
    const context = contexts[0].content;

    return `Use this information to answer the question:

${context}

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
      logger.info(`Generated prompt length: ${prompt.length}`);
      logger.info(`Generated prompt: ${prompt}`); // Full prompt for debugging

      // Try different LLM configurations
      const response = await this.llm(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false,
        pad_token_id: 50256, // Common pad token
      });

      logger.info(
        `Full LLM response structure: ${JSON.stringify(response, null, 2)}`
      );

      // More robust answer extraction
      let answer = "";

      if (Array.isArray(response) && response.length > 0) {
        const result = response[0];
        logger.info(`First result: ${JSON.stringify(result, null, 2)}`);

        if (result.generated_text) {
          answer = result.generated_text.trim();
          logger.info(`Extracted generated text: ${answer}`);
        }
      } else if (
        response &&
        typeof response === "object" &&
        response.generated_text
      ) {
        answer = response.generated_text.trim();
        logger.info(`Direct generated text: ${answer}`);
      }
      if (!answer) {
        logger.error("Failed to extract answer from LLM response");
        throw new Error("Failed to extract answer from LLM response");
      }

      logger.info(`Final answer: ${answer}`);

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

  cleanup = async () => {
    try {
      if (this.embeddingService) {
        await this.embeddingService.cleanup();
      }
      logger.info("RagService cleanup completed");
    } catch (error) {
      logger.error(`Error during RagService cleanup: ${error}`);
    }
  };
}
