import {
  type Phase,
  type PhaseContext,
  type SafePathEvent,
  type SplitLeg,
  nowIso,
} from "./types.js";

export function computeSplitPlan(
  amount: number,
  surviving: number,
  partnerDepth: { bidDepthBase: string; venue: string } | null,
): SplitLeg[] | null {
  if (surviving < 2 && !partnerDepth) return null;
  if (amount < 50_000) return null;

  if (partnerDepth) {
    const bidDepth = Number(partnerDepth.bidDepthBase);
    const depthUsd = bidDepth * 2.5;
    if (amount > depthUsd * 0.8 && surviving >= 2) {
      const primaryPct = Math.min(80, Math.round(((depthUsd * 0.6) / amount) * 100));
      return [
        {
          percentage: primaryPct,
          description: `${primaryPct}% via primary path`,
          reason: `Measured ${partnerDepth.venue} depth (${bidDepth.toFixed(0)} XRP ≈ $${depthUsd.toFixed(0)}) can absorb ~${primaryPct}% at <20bps slippage.`,
        },
        {
          percentage: 100 - primaryPct,
          description: `${100 - primaryPct}% via secondary path`,
          reason: "Remaining routed through alternative to avoid excessive slippage.",
        },
      ];
    }
  }

  if (amount > 100_000 && surviving >= 2) {
    return [
      {
        percentage: 60,
        description: "60% via primary path",
        reason: "Large amount — split for execution risk diversification.",
      },
      {
        percentage: 40,
        description: "40% via secondary path",
        reason: "Secondary path provides counterparty diversification.",
      },
    ];
  }
  return null;
}

export class SplitPlanPhase implements Phase {
  readonly name = "split-plan" as const;

  async *run(ctx: PhaseContext): AsyncGenerator<SafePathEvent> {
    const { input, state } = ctx;
    const amount = Number(input.amount) || 0;
    const surviving = state.paths.length - state.rejected.length;
    const plan = computeSplitPlan(amount, surviving, state.partnerDepth);
    if (!plan) return;

    state.splitPlan = plan;
    yield { kind: "split-plan", legs: plan, at: nowIso() };
    yield {
      kind: "reasoning",
      text: `Amount ${input.amount} ${input.srcCcy} is large. Recommending split: ${plan.map((l) => `${l.percentage}%`).join(" / ")}.`,
      at: nowIso(),
    };
  }
}
