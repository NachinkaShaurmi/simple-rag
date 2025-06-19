import fs from 'fs';
import path from 'path';
import { pipeline } from "@huggingface/transformers";
import { ChromaClient } from "chromadb";
import { DATA_DIR, CHROMA_URL } from "../config.js";

/**
 * Process JSON files and create text chunks for RAG
 */
async function processMuseumData() {
  console.log("Starting data processing...");
  
  // Initialize embedding model
  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );
  
  // Create custom embedding function
  const customEmbeddingFunction = {
    async generate(texts) {
      const embeddings = [];
      for (const text of texts) {
        const result = await embedder(text);
        embeddings.push(result[0][0]);
      }
      return embeddings;
    }
  };

  // Initialize ChromaDB client
  const url = new URL(CHROMA_URL);
  const chroma = new ChromaClient({
    host: url.hostname,
    port: Number(url.port),
    ssl: url.protocol === "https:",
  });

  // Create or get collection
  const collection = await chroma.getOrCreateCollection({
    name: "museum_chunks",
    embeddingFunction: customEmbeddingFunction,
  });

  // Process JSON files
  const objectsDir = path.join(DATA_DIR, 'objects', '0');
  const files = fs.readdirSync(objectsDir).filter(file => file.endsWith('.json'));
  
  console.log(`Found ${files.length} JSON files to process`);
  
  const documents = [];
  const metadatas = [];
  const ids = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(objectsDir, file);
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Create text chunks from artwork data
      const chunks = createTextChunks(data, file);
      
      chunks.forEach((chunk, chunkIndex) => {
        documents.push(chunk.text);
        metadatas.push({
          file: file,
          chunk_index: chunkIndex,
          object_id: data.id || 'unknown',
          title: data.title || 'Untitled',
          artist: data.artist || 'Unknown Artist',
          culture: data.culture || 'Unknown',
          dated: data.dated || 'Unknown Date'
        });
        ids.push(`${file}_chunk_${chunkIndex}`);
      });
      
      if (i % 100 === 0) {
        console.log(`Processed ${i + 1}/${files.length} files`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error.message);
    }
  }
  
  // Add documents to ChromaDB in batches
  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = {
      documents: documents.slice(i, i + batchSize),
      metadatas: metadatas.slice(i, i + batchSize),
      ids: ids.slice(i, i + batchSize)
    };
    
    await collection.add(batch);
    console.log(`Added batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
  }
  
  console.log(`Data processing complete! Added ${documents.length} chunks to ChromaDB`);
}

/**
 * Create text chunks from artwork JSON data
 */
function createTextChunks(artworkData, filename) {
  const chunks = [];
  
  // Main description chunk
  const mainText = [
    artworkData.title ? `Title: ${artworkData.title}` : '',
    artworkData.artist ? `Artist: ${artworkData.artist}` : '',
    artworkData.culture ? `Culture: ${artworkData.culture}` : '',
    artworkData.dated ? `Date: ${artworkData.dated}` : '',
    artworkData.medium ? `Medium: ${artworkData.medium}` : '',
    artworkData.dimensions ? `Dimensions: ${artworkData.dimensions}` : '',
    artworkData.description ? `Description: ${artworkData.description}` : '',
    artworkData.provenance ? `Provenance: ${artworkData.provenance}` : '',
    artworkData.exhibition_history ? `Exhibition History: ${artworkData.exhibition_history}` : '',
    artworkData.credit_line ? `Credit: ${artworkData.credit_line}` : ''
  ].filter(Boolean).join('\n');
  
  if (mainText.trim()) {
    chunks.push({
      text: mainText,
      type: 'main_description'
    });
  }
  
  // Additional text fields as separate chunks
  if (artworkData.text && artworkData.text.length > 100) {
    chunks.push({
      text: `${artworkData.title || 'Artwork'} - Additional Information: ${artworkData.text}`,
      type: 'additional_text'
    });
  }
  
  // Tags and keywords chunk
  const tags = [];
  if (artworkData.style) tags.push(`Style: ${artworkData.style}`);
  if (artworkData.classification) tags.push(`Classification: ${artworkData.classification}`);
  if (artworkData.department) tags.push(`Department: ${artworkData.department}`);
  if (artworkData.country) tags.push(`Country: ${artworkData.country}`);
  if (artworkData.region) tags.push(`Region: ${artworkData.region}`);
  
  if (tags.length > 0) {
    chunks.push({
      text: `${artworkData.title || 'Artwork'} - ${tags.join(', ')}`,
      type: 'metadata'
    });
  }
  
  return chunks.length > 0 ? chunks : [{
    text: `Artwork from ${filename}: ${JSON.stringify(artworkData).substring(0, 500)}`,
    type: 'fallback'
  }];
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processMuseumData().catch(console.error);
}

export { processMuseumData };