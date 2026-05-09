import { createHash } from "node:crypto";
import type { AIServiceClient } from "../connectors/ai-service.js";

export type AiNoteServiceOptions = {
  ai: AIServiceClient;
};

export type AiNoteService = ReturnType<typeof createAiNoteService>;

export type CorridorSummary = {
  id: string;
  label: string;
  description: string;
  useCase: string;
  status: string;
  pathCount: number;
  recCost: string | null;
};

export function createAiNoteService(opts: AiNoteServiceOptions) {
  return {
    async generate(input: { corridor: CorridorSummary }): Promise<{ note: string; hash: string }> {
      const prompt = `You are a corridor analyst. Write a 2-sentence assessment of this XRPL payment corridor:

ID: ${input.corridor.id}
Label: ${input.corridor.label}
Description: ${input.corridor.description}
Use case: ${input.corridor.useCase}
Current status: ${input.corridor.status} (${input.corridor.pathCount} paths)
Recommended cost: ${input.corridor.recCost ?? "n/a"}

Be specific about liquidity and risk. Avoid fluff.`;

      const result = await opts.ai.complete({
        purpose: "corridor.ai-note",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        maxTokens: 150,
      });
      const hash = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
      return { note: result.content.trim(), hash };
    },
  };
}
