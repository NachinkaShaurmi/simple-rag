import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  documentPath: process.env.DOCUMENT_PATH || "",
  lanceDbPath: process.env.LANCE_DB_PATH || "",
  embeddingModel: process.env.EMBEDDING_MODEL || "",
  llmModel: process.env.LLM_MODEL || "",
  useRag: process.env.USE_RAG !== "false",
};
