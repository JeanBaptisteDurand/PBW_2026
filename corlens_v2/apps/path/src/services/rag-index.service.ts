import type { AIServiceClient } from "../connectors/ai-service.js";
import type { RagRepo } from "../repositories/rag.repo.js";
import type { GraphNode, RiskFlagData } from "../domain/types.js";

export type RagIndexServiceOptions = { ai: AIServiceClient; repo: RagRepo };
export type RagIndexService = ReturnType<typeof createRagIndexService>;

export function createRagIndexService(opts: RagIndexServiceOptions) {
  return {
    async index(input: { analysisId: string; nodes: GraphNode[]; flags: RiskFlagData[] }): Promise<{ indexed: number }> {
      await opts.repo.clearDocs(input.analysisId);
      let count = 0;
      for (const n of input.nodes) {
        const text = `${n.kind}: ${n.label}\n${JSON.stringify(n.data).slice(0, 600)}`;
        const { embedding } = await opts.ai.embed({ purpose: "path.rag-index", input: text });
        await opts.repo.upsertDoc({
          analysisId: input.analysisId,
          content: text,
          metadata: { nodeId: n.id, kind: n.kind, label: n.label },
          embedding,
        });
        count += 1;
      }
      if (input.flags.length > 0) {
        const flagsText = input.flags.map((f) => `[${f.severity}] ${f.flag}: ${f.detail}`).join("\n");
        const { embedding } = await opts.ai.embed({ purpose: "path.rag-index", input: flagsText });
        await opts.repo.upsertDoc({
          analysisId: input.analysisId,
          content: flagsText,
          metadata: { kind: "risk-summary" },
          embedding,
        });
        count += 1;
      }
      return { indexed: count };
    },
  };
}
