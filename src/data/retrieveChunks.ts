import { pipeline } from "@huggingface/transformers";
import { ChromaClient } from "chromadb";
import { CHROMA_URL } from "../config.js";
import type { RetrievedChunk, EmbeddingFunction } from "../types/index.js";

export async function retrieveRelevantChunks(
  question: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  try {
    const embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    const embedding = (await embedder(question))[0][0] as number[];

    const customEmbeddingFunction: EmbeddingFunction = {
      async generate(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const text of texts) {
          const result = await embedder(text);
          embeddings.push(result[0][0] as number[]);
        }
        return embeddings;
      },
    };

    const chroma = new ChromaClient({ path: CHROMA_URL });
    const collection = await chroma.getOrCreateCollection({
      name: "museum_chunks",
      embeddingFunction: customEmbeddingFunction,
    });

    const results = await collection.query({
      query_embeddings: [embedding],
      n_results: topK,
      include: ["documents", "metadatas", "distances"],
    });

    const docs = results.documents?.[0] || [];
    const metas = results.metadatas?.[0] || [];
    const scores = results.distances?.[0] || [];

    return docs.map((document: string, i: number) => ({
      document,
      metadata: metas[i] as any,
      score: scores[i],
    }));
  } catch (error) {
    console.warn(
      "ChromaDB error, falling back to mock data:",
      (error as Error).message
    );
    return [];
  }
}
