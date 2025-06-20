import dotenv from 'dotenv';

dotenv.config();

export const CHROMA_URL: string = process.env.CHROMA_URL || "http://chromadb:8000";
export const DATA_DIR: string = process.env.DATA_DIR || "./data";
export const PORT: number = parseInt(process.env.PORT || "3000", 10);