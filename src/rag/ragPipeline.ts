import { pipeline } from "@huggingface/transformers";
import { retrieveRelevantChunks } from "../data/retrieveChunks.js";
import type { RAGResult } from "../types/index.js";

export async function answerWithRAG(question: string): Promise<RAGResult> {
  const topChunks = await retrieveRelevantChunks(question, 5);

  const context = topChunks
    .map((c, i) => `Source ${i + 1}: ${c.document}`)
    .join("\n\n");
  const prompt = `
You are a helpful museum assistant. Use the following sources to answer the question. Cite sources as [Source X] where relevant.

Sources:
${context}

Question: ${question}
Answer:
`.trim();

  try {
    const generator = await pipeline("text-generation", "Xenova/distilgpt2");
    const output = await generator(prompt, {
      max_new_tokens: 100,
      temperature: 0.1,
      do_sample: true,
      pad_token_id: 50256,
    });

    let answer = (output as any)[0]?.generated_text || "";
    if (answer.includes(prompt)) {
      answer = answer.replace(prompt, "").trim();
    }

    if (!answer || answer.length < 10) {
      const relevantSources = topChunks.slice(0, 2);
      answer = `Based on the museum collection, I found ${
        relevantSources.length
      } relevant artworks: ${relevantSources
        .map((c) => c.metadata.title)
        .join(", ")}. ${relevantSources[0]?.document.split(".")[0]}.`;
    }

    return {
      answer,
      sources: topChunks.map((c, i) => ({
        source: `Source ${i + 1}`,
        file: c.metadata.file,
        chunk_index: c.metadata.chunk_index,
        score: c.score,
        text: c.document,
      })),
    };
  } catch (error) {
    console.warn("LLM generation failed, using template response:", (error as Error).message);
    const relevantSources = topChunks.slice(0, 2);
    const answer = `Based on the museum collection, I found ${
      relevantSources.length
    } relevant artworks: ${relevantSources
      .map((c) => c.metadata.title)
      .join(", ")}. ${relevantSources[0]?.document.split(".")[0]}.`;
    return {
      answer,
      sources: topChunks.map((c, i) => ({
        source: `Source ${i + 1}`,
        file: c.metadata.file,
        chunk_index: c.metadata.chunk_index,
        score: c.score,
        text: c.document,
      })),
    };
  }
}