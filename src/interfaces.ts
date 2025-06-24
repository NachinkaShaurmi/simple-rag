export interface DocumentChunk {
  id: string;
  content: string;
  vector: number[];
  metadata: {
    source: string;
    chunkIndex: number;
  };
}

export interface RagResponse {
  answer: string;
  sources: Array<{
    content: string;
    source: string;
  }>;
}

export const validateQuestion = (question: any): boolean => {
  return typeof question === "string" && question.trim().length > 0;
};
