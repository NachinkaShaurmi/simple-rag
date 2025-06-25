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
      this.llm = await pipeline("text-generation", config.llmModel);

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

    return `Use this information to answer the question. Provide only factual information, do not ask follow-up questions.

${context}

Question: ${question}

Answer with facts only:`;
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

      // If RAG is disabled, we should still process the question but not include sources
      if (!config.useRag) {
        logger.info("RAG is disabled, processing without context");
        const response = await this.llm(question, {
          max_new_tokens: 300,
          temperature: 0.5,
          do_sample: true,
          return_full_text: false,
          top_p: 0.9,
        });

        let answer = "";
        if (Array.isArray(response) && response.length > 0) {
          answer = response[0].generated_text?.trim() || "";
        } else if (response && typeof response === "object" && response.generated_text) {
          answer = response.generated_text.trim();
        }

        if (!answer || answer.length < 10) {
          answer = "I apologize, but I couldn't generate a proper response to your question. Please try rephrasing or asking a different question.";
        }

        return {
          answer,
          sources: [], // Empty sources when RAG is disabled
        };
      }

      const prompt = this.createPrompt(question, contexts);
      logger.info(`Generated prompt length: ${prompt.length}`);
      logger.info(`Generated prompt: ${prompt}`);

      // Try up to 3 times to get a valid response
      let attempts = 0;
      const maxAttempts = 3;
      let answer = "";

      while (attempts < maxAttempts) {
        attempts++;

        const response = await this.llm(prompt, {
          max_new_tokens: 300, // Increased from 100 to allow for longer responses
          temperature: 0.5 + (attempts * 0.1), // Slightly increase temperature on retries
          do_sample: true,
          return_full_text: false,
          top_p: 0.9,
        });

        logger.info(
          `Attempt ${attempts} - Full LLM response structure: ${JSON.stringify(response, null, 2)}`
        );

        // Extract the answer from the response
        if (Array.isArray(response) && response.length > 0) {
          const result = response[0];
          logger.info(`First result: ${JSON.stringify(result, null, 2)}`);

          if (result.generated_text) {
            answer = result.generated_text.trim();
            logger.info(`Extracted generated text length: ${answer.length} characters`);
            logger.info(`Extracted generated text: ${answer}`);
          }
        } else if (
          response &&
          typeof response === "object" &&
          response.generated_text
        ) {
          answer = response.generated_text.trim();
          logger.info(`Direct generated text length: ${answer.length} characters`);
          logger.info(`Direct generated text: ${answer}`);
        }

        // Validate the answer
        if (!answer) {
          logger.warn(`Attempt ${attempts}: Empty answer received`);
          continue;
        }

        // Check for common invalid patterns
        const invalidPatterns = [
          /^Sold:\s*$/m,
          /^\d+\.\s*what kind of/i,
          /^A:/
        ];

        const hasInvalidPattern = invalidPatterns.some(pattern => pattern.test(answer));

        // Check if the answer is too short or contains repetitive content
        const lines = answer.split('\n').filter(line => line.trim().length > 0);
        const uniqueLines = new Set(lines);
        const hasRepetitiveContent = lines.length > 3 && uniqueLines.size < lines.length / 2;

        if (hasInvalidPattern || hasRepetitiveContent) {
          logger.warn(`Attempt ${attempts}: Invalid answer detected: "${answer.substring(0, 100)}..."`);
          if (attempts < maxAttempts) {
            answer = "";
            continue;
          }
        } else {
          // Valid answer found
          break;
        }
      }

      // If we still don't have a valid answer after all attempts
      if (!answer || answer.length < 10) {
        logger.error("Failed to get a valid answer after multiple attempts");
        return {
          answer: "I apologize, but I couldn't generate a proper response to your question. Please try rephrasing or asking a different question.",
          sources: config.useRag ? contexts.map((chunk) => ({
            content: chunk.content,
            source: chunk.metadata.source,
          })) : [],
        };
      }

      // Clean up the answer if needed
      answer = answer
        .replace(/^Sold:\s*$/gm, "") // Remove "Sold:" lines
        .replace(/^\d+\.\s*what kind of.*$/im, "") // Remove numbered questions
        .replace(/^A:\s*/m, "") // Remove "A:" prefixes
        .trim();

      logger.info(`Final answer length: ${answer.length} characters`);
      logger.info(`Final answer: ${answer}`);

      return {
        answer,
        sources: config.useRag ? contexts.map((chunk) => ({
          content: chunk.content,
          source: chunk.metadata.source,
        })) : [],
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
