import { Router, type IRouter } from "express";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { chatWithAnalysis } from "../ai/rag.js";

export const chatRouter: IRouter = Router();

// POST / — Send a chat message
chatRouter.post("/", async (req, res) => {
  try {
    const { analysisId, message, chatId } = req.body ?? {};

    if (!analysisId || typeof analysisId !== "string") {
      res.status(400).json({ error: "analysisId is required" });
      return;
    }

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    // Get or create chat
    let chat;
    if (chatId) {
      chat = await prisma.ragChat.findUnique({ where: { id: chatId } });
      if (!chat) {
        res.status(404).json({ error: "Chat not found" });
        return;
      }
    } else {
      chat = await prisma.ragChat.create({ data: { analysisId } });
    }

    // Save user message
    await prisma.ragMessage.create({
      data: {
        chatId: chat.id,
        role: "user",
        content: message,
      },
    });

    // Get AI response
    const assistantMessage = await chatWithAnalysis(analysisId, chat.id, message);

    // Save assistant message
    await prisma.ragMessage.create({
      data: {
        chatId: chat.id,
        role: "assistant",
        content: assistantMessage.content,
        sources: assistantMessage.sources ? (assistantMessage.sources as any) : null,
      },
    });

    logger.info("[route] Chat message processed", { chatId: chat.id, analysisId });
    res.json({ chatId: chat.id, message: assistantMessage });
  } catch (err: any) {
    logger.error("[route] Failed to process chat message", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:chatId — Get chat history
chatRouter.get("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await prisma.ragChat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    res.json({
      chatId: chat.id,
      analysisId: chat.analysisId,
      messages: chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources ?? undefined,
        createdAt: m.createdAt,
      })),
    });
  } catch (err: any) {
    logger.error("[route] Failed to get chat history", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
