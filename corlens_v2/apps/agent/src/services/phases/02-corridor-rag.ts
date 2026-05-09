import { type Phase, type PhaseContext, type PhaseEmit, nowIso } from "./types.js";

export class CorridorRagPhase implements Phase {
  readonly name = "corridor-rag" as const;

  async run(ctx: PhaseContext, emit: PhaseEmit): Promise<void> {
    const { input, state, deps } = ctx;
    const question = `What are the best routes for ${input.srcCcy} to ${input.dstCcy}? What actors are most reliable? Any known issues or risks with this corridor?`;
    emit({
      kind: "step",
      step: "corridor_rag",
      detail: `Querying corridor intelligence for ${input.srcCcy} → ${input.dstCcy}`,
      at: nowIso(),
    });

    try {
      const rag = await deps.corridor.chat({
        corridorId: state.corridor.id ?? undefined,
        message: question,
      });
      state.corridorRagAnswer = rag.answer;
      emit({
        kind: "corridor-rag",
        question,
        answer: rag.answer,
        at: nowIso(),
      });
    } catch (err) {
      emit({
        kind: "tool-result",
        name: "corridorRag",
        summary: `Corridor RAG failed: ${(err as Error).message}`,
        at: nowIso(),
      });
    }
  }
}
