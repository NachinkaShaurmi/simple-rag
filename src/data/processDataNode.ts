import fs from "fs";
import path from "path";
import { pipeline } from "@huggingface/transformers";
import { ChromaClient } from "chromadb";
import { DATA_DIR, CHROMA_URL } from "../config.js";
import type {
  ArtworkData,
  TextChunk,
  EmbeddingFunction,
} from "../types/index.js";

async function processMuseumData(): Promise<void> {
  console.log("Starting data processing...");

  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );

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

  const objectsDir = path.join(DATA_DIR, "objects", "0");
  const files = fs
    .readdirSync(objectsDir)
    .filter((file) => file.endsWith(".json"));

  console.log(`Found ${files.length} JSON files to process`);

  const documents: string[] = [];
  const metadatas: any[] = [];
  const ids: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(objectsDir, file);

    try {
      const data: ArtworkData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const chunks = createTextChunks(data, file);

      chunks.forEach((chunk, chunkIndex) => {
        documents.push(chunk.text);
        metadatas.push({
          file: file,
          chunk_index: chunkIndex,
          object_id: data.id || "unknown",
          title: data.title || "Untitled",
          artist: data.artist || "Unknown Artist",
          culture: data.culture || "Unknown",
          dated: data.dated || "Unknown Date",
        });
        ids.push(`${file}_chunk_${chunkIndex}`);
      });

      if (i % 100 === 0) {
        console.log(`Processed ${i + 1}/${files.length} files`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, (error as Error).message);
    }
  }

  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = {
      documents: documents.slice(i, i + batchSize),
      metadatas: metadatas.slice(i, i + batchSize),
      ids: ids.slice(i, i + batchSize),
    };

    await collection.add(batch);
    console.log(
      `Added batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        documents.length / batchSize
      )}`
    );
  }

  console.log(
    `Data processing complete! Added ${documents.length} chunks to ChromaDB`
  );
}

function createTextChunks(
  artworkData: ArtworkData,
  filename: string
): TextChunk[] {
  const chunks: TextChunk[] = [];

  const mainText = [
    artworkData.title ? `Title: ${artworkData.title}` : "",
    artworkData.artist ? `Artist: ${artworkData.artist}` : "",
    artworkData.culture ? `Culture: ${artworkData.culture}` : "",
    artworkData.dated ? `Date: ${artworkData.dated}` : "",
    artworkData.medium ? `Medium: ${artworkData.medium}` : "",
    artworkData.dimensions ? `Dimensions: ${artworkData.dimensions}` : "",
    artworkData.description ? `Description: ${artworkData.description}` : "",
    artworkData.provenance ? `Provenance: ${artworkData.provenance}` : "",
    artworkData.exhibition_history
      ? `Exhibition History: ${artworkData.exhibition_history}`
      : "",
    artworkData.credit_line ? `Credit: ${artworkData.credit_line}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (mainText.trim()) {
    chunks.push({
      text: mainText,
      type: "main_description",
    });
  }

  if (artworkData.text && artworkData.text.length > 100) {
    chunks.push({
      text: `${artworkData.title || "Artwork"} - Additional Information: ${
        artworkData.text
      }`,
      type: "additional_text",
    });
  }

  const tags: string[] = [];
  if (artworkData.style) tags.push(`Style: ${artworkData.style}`);
  if (artworkData.classification)
    tags.push(`Classification: ${artworkData.classification}`);
  if (artworkData.department)
    tags.push(`Department: ${artworkData.department}`);
  if (artworkData.country) tags.push(`Country: ${artworkData.country}`);
  if (artworkData.region) tags.push(`Region: ${artworkData.region}`);

  if (tags.length > 0) {
    chunks.push({
      text: `${artworkData.title || "Artwork"} - ${tags.join(", ")}`,
      type: "metadata",
    });
  }

  return chunks.length > 0
    ? chunks
    : [
        {
          text: `Artwork from ${filename}: ${JSON.stringify(
            artworkData
          ).substring(0, 500)}`,
          type: "fallback",
        },
      ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  processMuseumData().catch(console.error);
}

export { processMuseumData };
