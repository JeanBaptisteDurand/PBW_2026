import type { AIServiceClient } from "../connectors/ai-service.js";
import type { RagRepo } from "../repositories/rag.repo.js";

export type RagIndexServiceOptions = {
  ai: AIServiceClient;
  repo: RagRepo;
};

export type RagIndexService = ReturnType<typeof createRagIndexService>;

export type CorridorSummaryForRag = {
  id: string;
  label: string;
  description: string;
  useCase: string;
  aiNote: string | null;
};

export function createRagIndexService(opts: RagIndexServiceOptions) {
  return {
    async index(input: { corridor: CorridorSummaryForRag; chunks: string[] }): Promise<{ indexed: number }> {
      await opts.repo.clearDocs(input.corridor.id);
      let count = 0;
      for (const chunk of input.chunks) {
        const { embedding } = await opts.ai.embed({ purpose: "corridor.rag-index", input: chunk });
        await opts.repo.upsertDoc({
          corridorId: input.corridor.id,
          content: chunk,
          metadata: { label: input.corridor.label, useCase: input.corridor.useCase },
          embedding,
        });
        count += 1;
      }
      return { indexed: count };
    },

    chunksFor(corridor: CorridorSummaryForRag): string[] {
      return [
        `${corridor.label}: ${corridor.description}`,
        `Use case: ${corridor.useCase}`,
        ...(corridor.aiNote ? [corridor.aiNote] : []),
      ];
    },
  };
}
