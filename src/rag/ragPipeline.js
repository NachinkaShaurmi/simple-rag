import { pipeline } from "@huggingface/transformers";
import { retrieveRelevantChunks } from "../data/retrieveChunks.js";

/**
 * Generate an answer to a question using retrieved context and LLM.
 * @param {string} question
 * @returns {Promise<{answer: string, sources: Array}>}
 */
export async function answerWithRAG(question) {
  // 1. Retrieve relevant chunks
  const topChunks = await retrieveRelevantChunks(question, 5);

  // 2. Compose context for the LLM
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

  // 3. Generate answer with LLM
  try {
    const generator = await pipeline("text-generation", "Xenova/distilgpt2");
    const output = await generator(prompt, {
      max_new_tokens: 100,
      temperature: 0.1,
      do_sample: true,
      pad_token_id: 50256,
    });

    let answer = output[0]?.generated_text || "";
    if (answer.includes(prompt)) {
      answer = answer.replace(prompt, "").trim();
    }

    if (!answer || answer.length < 10) {
      // Fallback to simple template-based answer
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
    console.warn(
      "LLM generation failed, using template response:",
      error.message
    );
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
