import { classifyOffChainBridgeStatus } from "../../data/currency-meta.js";
import {
  type Phase,
  type PhaseContext,
  type SafePathEvent,
  type Verdict,
  nowIso,
} from "./types.js";

export class OffChainBridgePhase implements Phase {
  readonly name = "off-chain-bridge" as const;

  async *run(ctx: PhaseContext): AsyncGenerator<SafePathEvent> {
    const { input, state } = ctx;
    const noOnChainPaths = state.isOnChain ? state.paths.length === 0 : true;

    if (!noOnChainPaths) {
      return;
    }

    yield {
      kind: "step",
      step: "off_chain_analysis",
      detail: `Analyzing off-chain bridge via ${state.corridor.bridgeAsset ?? "RLUSD"}`,
      at: nowIso(),
    };

    yield {
      kind: "reasoning",
      text: `${input.srcCcy} → ${input.dstCcy} settles via ${state.corridor.bridgeAsset ?? "RLUSD"} on XRPL. No on-chain IOU trust lines. Evaluating ${state.srcActors.length} source + ${state.dstActors.length} dest actors.`,
      at: nowIso(),
    };

    const cls = classifyOffChainBridgeStatus(state.srcActors, state.dstActors);
    yield {
      kind: "tool-result",
      name: "classifyOffChainBridge",
      summary: `Status: ${cls.status} (src ${cls.srcScore}, dst ${cls.dstScore}). ${cls.reason}`,
      at: nowIso(),
    };

    if (state.corridor.id) {
      state.corridor.bridgeAsset = state.corridor.bridgeAsset ?? "RLUSD";
      if (cls.status === "GREEN" || cls.status === "AMBER") {
        state.verdict = "OFF_CHAIN_ROUTED" as Verdict;
        state.riskScore = cls.status === "GREEN" ? 0.3 : 0.5;
      } else {
        state.verdict = state.verdict === "SAFE" ? state.verdict : ("NO_PATHS" as Verdict);
      }
    }

    state.reasoning += `Off-chain bridge: ${cls.reason}\n`;
  }
}
