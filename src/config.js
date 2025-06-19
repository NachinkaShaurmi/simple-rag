import dotenv from 'dotenv';

dotenv.config();

export const CHROMA_URL = process.env.CHROMA_URL || "http://chromadb:8000";
export const DATA_DIR = process.env.DATA_DIR || "./data";
export const PORT = process.env.PORT || 3000;