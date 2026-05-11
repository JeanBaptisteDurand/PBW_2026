import { rankActors } from "../../data/xrpl-utils.js";
import { type Phase, type PhaseContext, type SafePathEvent, errMessage, nowIso } from "./types.js";

export class PlanningPhase implements Phase {
  readonly name = "planning" as const;

  async *run(ctx: PhaseContext): AsyncGenerator<SafePathEvent> {
    const { input, state, deps } = ctx;
    const tolerance = input.maxRiskTolerance ?? "MED";
    const corridorCtx = state.corridor.id
      ? `Corridor: ${state.corridor.category ?? "n/a"}, bridge=${state.corridor.bridgeAsset ?? "RLUSD"}. Top src: ${rankActors(
          state.srcActors,
        )
          .slice(0, 3)
          .map((a) => a.name + (a.odl ? " (ODL)" : ""))
          .join(", ")}. Top dst: ${rankActors(state.dstActors)
          .slice(0, 3)
          .map((a) => a.name + (a.odl ? " (ODL)" : ""))
          .join(", ")}.`
      : "No corridor in atlas.";
    const ragCtx = state.corridorRagAnswer
      ? `\nCorridor intelligence:\n${state.corridorRagAnswer}`
      : "";

    yield {
      kind: "step",
      step: "planning",
      detail: "Drafting routing plan",
      at: nowIso(),
    };

    try {
      const plan = await deps.ai.complete({
        purpose: "agent.plan",
        messages: [
          {
            role: "system",
            content:
              "You are an XRPL treasury routing agent. In 4-5 sentences, describe your plan: what corridor type this is, which actors you will investigate, what XRPL tools you will run, and what risks you will check. Be specific and factual.",
          },
          {
            role: "user",
            content: `Route ${input.amount} ${input.srcCcy} → ${input.dstCcy}, max risk ${tolerance}. ${corridorCtx}${ragCtx}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 300,
      });
      state.plan = plan.content.trim();
      state.reasoning += `${state.plan}\n\n`;
      yield { kind: "reasoning", text: state.plan, at: nowIso() };
    } catch (err) {
      yield {
        kind: "tool-result",
        name: "planning",
        summary: `Planning AI call failed: ${errMessage(err)}`,
        at: nowIso(),
      };
    }
  }
}
