# Museum RAG System

A Question-Answering system for museum documentation using RAG (Retrieval-Augmented Generation) architecture.

## Features

- **Document Processing**: Loads and processes JSON files from museum collection
- **Vector Search**: Uses ChromaDB for semantic search with embeddings
- **LLM Integration**: Uses HuggingFace Transformers.js with SmolLM2-135M-Instruct
- **REST API**: Express.js API with Swagger documentation
- **Web Interface**: Simple HTML interface for testing
- **CLI Interface**: Command-line interface for interactive testing

## Quick Start

### 1. Start with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

This will start:
- ChromaDB on port 8000
- RAG System API on port 3000

### 2. Process Your Data

```bash
# Count files in your data directory
npm run count-files

# Process JSON files and create embeddings
npm run process-data
```

### 3. Test the System

**Web Interface**: Open http://localhost:3000

**API Documentation**: Open http://localhost:3000/api-docs

**CLI Interface**:
```bash
npm run cli
```

**Direct API Call**:
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Show me American paintings from the 19th century"}'
```

## Project Structure

```
rag-system/
├── src/
│   ├── api/
│   │   └── server.js          # Express API server
│   ├── data/
│   │   ├── processDataNode.js # Data processing script
│   │   └── retrieveChunks.js  # Vector search functionality
│   ├── rag/
│   │   └── ragPipeline.js     # RAG pipeline implementation
│   ├── cli/
│   │   └── cli.js             # CLI interface
│   ├── utils/
│   │   └── countFiles.js      # Utility to count data files
│   └── config.js              # Configuration
├── public/
│   └── index.html             # Web interface
├── data/                      # Your JSON data files
├── docker-compose.yml         # Docker services
├── Dockerfile                 # App container
└── package.json               # Dependencies
```

## API Endpoints

### POST /ask
Ask a question about the museum collection.

**Request**:
```json
{
  "question": "Show me American paintings from the 19th century"
}
```

**Response**:
```json
{
  "answer": "Generated answer based on retrieved documents...",
  "sources": [
    {
      "source": "Source 1",
      "file": "123.json",
      "chunk_index": 0,
      "score": 0.85,
      "text": "Retrieved document text..."
    }
  ],
  "processing_time": 1250
}
```

### GET /health
Health check endpoint.

### GET /api-docs
Swagger API documentation.

## Example Questions

- "Show me American paintings from the 19th century"
- "Find artworks with floral motifs or nature themes"
- "What can you tell me about Japanese ceramics in the collection?"
- "Find portraits by female artists"
- "Show me artworks related to religious themes"

## Configuration

Environment variables (`.env` file):

```env
CHROMA_URL=http://localhost:8000
DATA_DIR=./data
PORT=3000
NODE_ENV=development
```

## Development

### Local Development (without Docker)

1. Start ChromaDB:
```bash
docker run -p 8000:8000 chromadb/chroma:latest
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

### Scripts

- `npm start` - Start the API server
- `npm run cli` - Start CLI interface
- `npm run process-data` - Process JSON files and create embeddings
- `npm run count-files` - Count and analyze data files

## Technical Details

### Embedding Model
- **Model**: Xenova/all-MiniLM-L6-v2
- **Purpose**: Creates vector representations of text chunks

### LLM Model
- **Model**: HuggingFaceTB/SmolLM2-135M-Instruct
- **Purpose**: Generates answers based on retrieved context

### Vector Database
- **Database**: ChromaDB
- **Collection**: museum_chunks
- **Features**: Semantic search, metadata filtering

### Text Processing
- **Chunking**: Splits artwork data into meaningful text chunks
- **Overlap**: Maintains context between chunks
- **Metadata**: Preserves artwork information (title, artist, culture, etc.)

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Error**:
   - Ensure ChromaDB is running on port 8000
   - Check CHROMA_URL in configuration

2. **No Data Found**:
   - Run `npm run count-files` to verify data directory
   - Run `npm run process-data` to process JSON files

3. **Memory Issues**:
   - Reduce batch size in data processing
   - Process data in smaller chunks

### Logs

Application logs are written to:
- Console output
- `rag-system.log` file

## License

MIT License