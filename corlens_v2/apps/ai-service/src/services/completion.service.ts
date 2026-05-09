import { createHash } from "node:crypto";
import type { ChatMessage, CompletionResponse } from "@corlens/contracts/dist/ai.js";
import type { OpenAIClient } from "../connectors/openai.js";
import type { PromptLogRepo } from "../repositories/prompt-log.repo.js";

export type CompletionServiceOptions = {
  openai: OpenAIClient;
  promptLog: PromptLogRepo;
  defaultModel: string;
};

export type CompletionService = ReturnType<typeof createCompletionService>;

export function createCompletionService(opts: CompletionServiceOptions) {
  return {
    async complete(input: {
      purpose: string;
      messages: ChatMessage[];
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }): Promise<CompletionResponse> {
      const model = input.model ?? opts.defaultModel;
      const promptHash = createHash("sha256")
        .update(JSON.stringify(input.messages))
        .digest("hex")
        .slice(0, 16);
      const start = Date.now();
      try {
        const result = await opts.openai.chat({
          messages: input.messages,
          model,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        });
        const log = await opts.promptLog.insert({
          purpose: input.purpose,
          model,
          promptHash,
          prompt: {
            messages: input.messages,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
          },
          response: { content: result.content },
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs: Date.now() - start,
        });
        return {
          content: result.content,
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          promptLogId: log.id,
        };
      } catch (err) {
        await opts.promptLog
          .insert({
            purpose: input.purpose,
            model,
            promptHash,
            prompt: { messages: input.messages },
            latencyMs: Date.now() - start,
            error: (err as Error).message,
          })
          .catch(() => undefined);
        throw err;
      }
    },
  };
}
