import express from "express";
import cors from "cors";
import { swaggerSpec, swaggerUi } from "./api/swagger";
import routes from "./api/routes";
import { RagService } from "./services/rag.service";
import { logger } from "./utils/logger";
import { config } from "./config";
import net from "net"; // Added for port conflict check

const app = express();

async function startServer() {
  try {
    logger.info("Starting server...");

    // Check if port is free
    await new Promise<void>((resolve, reject) => {
      const tester = net
        .createServer()
        .once("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            reject(new Error(`Port ${config.port} is already in use`));
          } else {
            reject(err);
          }
        })
        .once("listening", () => {
          tester.close();
          resolve();
        })
        .listen(config.port);
    });

    // Initialize RAG service (singleton)
    const ragService = RagService.getInstance();
    await ragService.initialize();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static("public"));

    // Routes
    app.use("/api", routes);
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(
        `API docs available at http://localhost:${config.port}/api-docs`
      );
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down server...");
      const ragService = RagService.getInstance();
      await ragService.cleanup();
      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    };

    // Handle process termination
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error(`Server startup error: ${error}`);
    process.exit(1);
  }
}

startServer();
