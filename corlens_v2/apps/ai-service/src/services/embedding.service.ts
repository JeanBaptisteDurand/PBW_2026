import { createHash } from "node:crypto";
import type { OpenAIClient } from "../connectors/openai.js";
import type { PromptLogRepo } from "../repositories/prompt-log.repo.js";
import type { EmbeddingResponse } from "@corlens/contracts/dist/ai.js";

export type EmbeddingServiceOptions = {
  openai: OpenAIClient;
  promptLog: PromptLogRepo;
  defaultModel: string;
};

export type EmbeddingService = ReturnType<typeof createEmbeddingService>;

export function createEmbeddingService(opts: EmbeddingServiceOptions) {
  return {
    async embed(input: { purpose: string; input: string; model?: string }): Promise<EmbeddingResponse> {
      const model = input.model ?? opts.defaultModel;
      const promptHash = createHash("sha256").update(input.input).digest("hex").slice(0, 16);
      const start = Date.now();
      try {
        const result = await opts.openai.embed({ input: input.input, model });
        const log = await opts.promptLog.insert({
          purpose: input.purpose,
          model,
          promptHash,
          prompt: { input: input.input },
          response: { dimensions: result.embedding.length },
          tokensIn: result.tokensIn,
          tokensOut: 0,
          latencyMs: Date.now() - start,
        });
        return {
          embedding: result.embedding,
          model: result.model,
          tokensIn: result.tokensIn,
          promptLogId: log.id,
        };
      } catch (err) {
        await opts.promptLog.insert({
          purpose: input.purpose, model, promptHash,
          prompt: { input: input.input }, latencyMs: Date.now() - start, error: (err as Error).message,
        }).catch(() => undefined);
        throw err;
      }
    },
  };
}
