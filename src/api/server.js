import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import winston from 'winston';
import { answerWithRAG } from '../rag/ragPipeline.js';
import { PORT } from '../config.js';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'rag-system.log' })
  ]
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RAG Museum API',
      version: '1.0.0',
      description: 'Question-answering system for museum documentation using RAG',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/api/server.js'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @swagger
 * /ask:
 *   post:
 *     summary: Ask a question about the museum collection
 *     tags: [Questions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: The question to ask about the museum collection
 *                 example: "Show me American paintings from the 19th century"
 *     responses:
 *       200:
 *         description: Successful response with answer and sources
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                   description: Generated answer
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       source:
 *                         type: string
 *                       file:
 *                         type: string
 *                       chunk_index:
 *                         type: number
 *                       score:
 *                         type: number
 *                       text:
 *                         type: string
 *                 processing_time:
 *                   type: number
 *                   description: Processing time in milliseconds
 *       400:
 *         description: Bad request - missing question
 *       500:
 *         description: Internal server error
 */
app.post('/ask', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { question } = req.body;
    
    // Validate input
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question is required and must be a non-empty string'
      });
    }
    
    logger.info('Processing question', { question });
    
    // Process with RAG
    const result = await answerWithRAG(question.trim());
    const processingTime = Date.now() - startTime;
    
    logger.info('Question processed successfully', {
      question,
      processing_time: processingTime,
      sources_count: result.sources.length
    });
    
    res.json({
      ...result,
      processing_time: processingTime
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('RAG error', {
      error: error.message,
      stack: error.stack,
      processing_time: processingTime
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      processing_time: processingTime
    });
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'RAG Museum API',
    endpoints: {
      ask: 'POST /ask',
      health: 'GET /health',
      docs: 'GET /api-docs'
    }
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`API server running at http://localhost:${PORT}`);
  logger.info(`Swagger docs at http://localhost:${PORT}/api-docs`);
});

export default app;