import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  documentPath: process.env.DOCUMENT_PATH || "./data",
  lanceDbPath: process.env.LANCE_DB_PATH || "./lancedb",
  embeddingModel:
    process.env.EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2",
  llmModel: process.env.LLM_MODEL || "HuggingFaceTB/SmolLM2-135M-Instruct",
};
