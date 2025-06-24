import express, { Request, Response } from "express";
import { RagService } from "../services/rag.service";
import { validateQuestion } from "../interfaces";
import { logger } from "../utils/logger"; // Added for debug logging

const router = express.Router();
const ragService = RagService.getInstance();

/**
 * @swagger
 * /api/question:
 *   post:
 *     summary: Ask a question and get a response with sources
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response with answer and sources
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post("/question", async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    logger.info(`Received question: ${question}`); // Debug log
    if (!validateQuestion(question)) {
      logger.warn(`Invalid question received: ${question}`);
      return res.status(400).json({ error: "Invalid question" });
    }

    const response = await ragService.processQuestion(question);
    res.json(response);
  } catch (error) {
    logger.error(`Error processing question: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
