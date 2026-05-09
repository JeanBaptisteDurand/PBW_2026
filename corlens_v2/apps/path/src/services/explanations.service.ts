import type { AIServiceClient } from "../connectors/ai-service.js";
import type { GraphNode } from "../domain/types.js";
import type { GraphRepo } from "../repositories/graph.repo.js";

export type ExplanationsServiceOptions = {
  ai: AIServiceClient;
  graph: GraphRepo;
};

export type ExplanationsService = ReturnType<typeof createExplanationsService>;

export function createExplanationsService(opts: ExplanationsServiceOptions) {
  return {
    async generate(input: { analysisId: string; nodes: GraphNode[] }): Promise<{ count: number }> {
      let count = 0;
      for (const n of input.nodes) {
        const prompt = `Explain in 2 sentences what this XRPL ${n.kind} node represents and any risk implications.\n\nLabel: ${n.label}\nKind: ${n.kind}\nData: ${JSON.stringify(n.data).slice(0, 800)}`;
        const result = await opts.ai.complete({
          purpose: "path.explanation",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          maxTokens: 150,
        });
        await opts.graph.writeExplanation(input.analysisId, n.id, result.content.trim());
        count += 1;
      }
      return { count };
    },
  };
}
