import { pipeline } from "@huggingface/transformers";
import { ChromaClient } from "chromadb";
import { CHROMA_URL } from "../config.js";

/**
 * Retrieve top-k relevant chunks from ChromaDB for a given question.
 * @param {string} question
 * @param {number} topK
 * @returns {Promise<Array<{document: string, metadata: object, score: number}>>}
 */
export async function retrieveRelevantChunks(question, topK = 5) {
  try {
    // 1. Embed the question
    const embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    const embedding = (await embedder(question))[0][0];

    // 2. Create a custom embedding function
    const customEmbeddingFunction = {
      async generate(texts) {
        const embeddings = [];
        for (const text of texts) {
          const result = await embedder(text);
          embeddings.push(result[0][0]);
        }
        return embeddings;
      },
    };

    // 3. Query ChromaDB
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

    // 4. Format results
    const docs = results.documents?.[0] || [];
    const metas = results.metadatas?.[0] || [];
    const scores = results.distances?.[0] || [];
    return docs.map((document, i) => ({
      document,
      metadata: metas[i],
      score: scores[i],
    }));
  } catch (error) {
    console.warn("ChromaDB error, falling back to mock data:", error.message);
    return [];
  }
}
