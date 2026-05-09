import type { AIServiceClient } from "../connectors/ai-service.js";
import type { RagRepo } from "../repositories/rag.repo.js";

export type ChatServiceOptions = {
  ai: AIServiceClient;
  repo: RagRepo;
  topK: number;
};

export type ChatService = ReturnType<typeof createChatService>;

export function createChatService(opts: ChatServiceOptions) {
  return {
    async ask(input: { corridorId?: string; message: string }): Promise<{
      answer: string;
      sources: Array<{ id: string; snippet: string }>;
    }> {
      const { embedding } = await opts.ai.embed({ purpose: "corridor.chat", input: input.message });
      const docs = await opts.repo.searchByEmbedding(
        input.corridorId ?? null,
        embedding,
        opts.topK,
      );

      const chat = await opts.repo.createChat(input.corridorId ?? null);
      await opts.repo.appendMessage({ chatId: chat.id, role: "user", content: input.message });

      const context = docs.map((d) => d.content).join("\n\n");
      const result = await opts.ai.complete({
        purpose: "corridor.chat",
        messages: [
          {
            role: "system",
            content:
              "You are a CORLens corridor analyst. Answer based only on the provided context.",
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
  };
}
