export interface ArtworkData {
  id?: string;
  title?: string;
  artist?: string;
  culture?: string;
  dated?: string;
  medium?: string;
  dimensions?: string;
  description?: string;
  provenance?: string;
  exhibition_history?: string;
  credit_line?: string;
  text?: string;
  style?: string;
  classification?: string;
  department?: string;
  country?: string;
  region?: string;
}

export interface TextChunk {
  text: string;
  type: 'main_description' | 'additional_text' | 'metadata' | 'fallback';
}

export interface ChunkMetadata {
  file: string;
  chunk_index: number;
  object_id: string;
  title: string;
  artist: string;
  culture: string;
  dated: string;
}

export interface RetrievedChunk {
  document: string;
  metadata: ChunkMetadata;
  score: number;
}

export interface RAGResult {
  answer: string;
  sources: Array<{
    source: string;
    file: string;
    chunk_index: number;
    score: number;
    text: string;
  }>;
}

export interface EmbeddingFunction {
  generate(texts: string[]): Promise<number[][]>;
}