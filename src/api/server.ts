import express, { Request, Response } from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import winston from 'winston';
import { answerWithRAG } from '../rag/ragPipeline.js';
import { PORT } from '../config.js';

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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
  apis: ['./src/api/server.ts'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.post('/ask', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { question } = req.body;
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question is required and must be a non-empty string'
      });
    }
    
    logger.info('Processing question', { question });
    
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
      error: (error as Error).message,
      stack: (error as Error).stack,
      processing_time: processingTime
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
      processing_time: processingTime
    });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'RAG Museum API',
    endpoints: {
      ask: 'POST /ask',
      health: 'GET /health',
      docs: 'GET /api-docs'
    }
  });
});

app.listen(PORT, () => {
  logger.info(`API server running at http://localhost:${PORT}`);
  logger.info(`Swagger docs at http://localhost:${PORT}/api-docs`);
});

export default app;