import { rankActors } from "../../data/xrpl-utils.js";
import { type Phase, type PhaseContext, type SafePathEvent, nowIso } from "./types.js";

export class CorridorResolutionPhase implements Phase {
  readonly name = "corridor-resolution" as const;

  async *run(ctx: PhaseContext): AsyncGenerator<SafePathEvent> {
    const { input, state, deps } = ctx;
    const corridorId = `${input.srcCcy.toLowerCase()}-${input.dstCcy.toLowerCase()}`;

    // Fetch currency meta from the corridor service, fall back to empty if unavailable.
    const [srcMeta, dstMeta, hubList] = await Promise.all([
      deps.corridor.getCurrencyMeta(input.srcCcy).catch(() => null),
      deps.corridor.getCurrencyMeta(input.dstCcy).catch(() => null),
      deps.corridor.listCurrencyMeta().catch(() => ({ currencies: [], globalHubs: [] })),
    ]);
    state.currencyMeta = { src: srcMeta, dst: dstMeta, globalHubs: hubList.globalHubs };

    state.srcIssuers = srcMeta?.issuers ?? [];
    state.dstIssuers = dstMeta?.issuers ?? [];
    state.srcActors = srcMeta?.actors ?? [];
    state.dstActors = dstMeta?.actors ?? [];
    state.isOnChain = state.srcIssuers.length > 0 && state.dstIssuers.length > 0;

    yield {
      kind: "step",
      step: "corridor_resolution",
      detail: `Looking up ${input.srcCcy} → ${input.dstCcy} in the corridor atlas`,
      at: nowIso(),
    };
    yield {
      kind: "tool-call",
      name: "corridorLookup",
      args: { corridorId },
      at: nowIso(),
    };

    let detail: { id: string; label: string; status: string; category?: string } | null = null;
    try {
      const found = await deps.corridor.getById(corridorId);
      if (found && typeof found === "object") {
        const r = found as {
          id?: unknown;
          label?: unknown;
          status?: unknown;
          category?: unknown;
        };
        if (
          typeof r.id === "string" &&
          typeof r.label === "string" &&
          typeof r.status === "string"
        ) {
          detail = {
            id: r.id,
            label: r.label,
            status: r.status,
            category: typeof r.category === "string" ? r.category : undefined,
          };
        }
      }
    } catch {
      // Non-fatal: corridor service unreachable. Fall back to no-corridor mode.
    }

    if (detail) {
      state.corridor.id = detail.id;
      state.corridor.label = detail.label;
      state.corridor.status = detail.status;
      state.corridor.category = detail.category ?? null;
      state.corridor.bridgeAsset = detail.category === "off-chain-bridge" ? "RLUSD" : null;

      yield {
        kind: "corridor-context",
        corridorId: detail.id,
        label: detail.label,
        status: detail.status,
        at: nowIso(),
      };

      const odlCount = [...state.srcActors, ...state.dstActors].filter((a) => a.odl).length;
      const rlusdCount = [...state.srcActors, ...state.dstActors].filter(
        (a) => a.supportsRlusd,
      ).length;
      yield {
        kind: "tool-result",
        name: "corridorLookup",
        summary: `${corridorId}: ${detail.category ?? "n/a"}, ${state.srcActors.length} src + ${state.dstActors.length} dst actors, ${odlCount} ODL, ${rlusdCount} RLUSD.`,
        at: nowIso(),
      };
    } else {
      yield {
        kind: "corridor-context",
        corridorId: null,
        label: null,
        status: null,
        at: nowIso(),
      };
      yield {
        kind: "reasoning",
        text: `No corridor found for ${input.srcCcy} → ${input.dstCcy}. Will attempt direct XRPL path_find.`,
        at: nowIso(),
      };
    }

    if (state.srcActors.length > 0 || state.dstActors.length > 0) {
      const top = rankActors(state.srcActors)
        .slice(0, 2)
        .map((a) => a.name);
      const topDst = rankActors(state.dstActors)
        .slice(0, 2)
        .map((a) => a.name);
      state.reasoning += `Resolved corridor ${corridorId}. Top src: ${top.join(", ") || "(none)"}. Top dst: ${topDst.join(", ") || "(none)"}.\n`;
    }
  }
}
