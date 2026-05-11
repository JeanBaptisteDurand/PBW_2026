import type { AIServiceClient } from "../connectors/ai-service.js";
import type { RagRepo } from "../repositories/rag.repo.js";

export type ChatServiceOptions = { ai: AIServiceClient; repo: RagRepo; topK: number };
export type ChatService = ReturnType<typeof createChatService>;

export function createChatService(opts: ChatServiceOptions) {
  return {
    async ask(input: { analysisId: string; message: string }): Promise<{
      answer: string;
      sources: Array<{ id: string; snippet: string }>;
    }> {
      const { embedding } = await opts.ai.embed({ purpose: "path.chat", input: input.message });
      const docs = await opts.repo.searchByEmbedding(input.analysisId, embedding, opts.topK);
      const chat = await opts.repo.createChat(input.analysisId);
      await opts.repo.appendMessage({ chatId: chat.id, role: "user", content: input.message });

      const context = docs.map((d) => d.content).join("\n\n");
      const result = await opts.ai.complete({
        purpose: "path.chat",
        messages: [
          {
            role: "system",
            content:
              "You are a CORLens entity-audit analyst. Answer based only on the provided context.",
          },
          { role: "user", content: `Context:\n${context}\n\nQuestion: ${input.message}` },
        ],
        temperature: 0.2,
        maxTokens: 400,
      });
      const sources = docs.map((d) => ({ id: d.id, snippet: d.content.slice(0, 200) }));
      await opts.repo.appendMessage({
        chatId: chat.id,
        role: "assistant",
        content: result.content,
        sources,
      });

      return { answer: result.content.trim(), sources };
    },

    async getLatestForAnalysis(analysisId: string) {
      const chat = await opts.repo.findLatestChatByAnalysisId(analysisId);
      if (!chat) return null;
      return {
        chatId: chat.id,
        analysisId,
        messages: chat.messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          sources: m.sources as unknown,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },
  };
}
