import type {
  CorridorPairDef,
  CorridorRouteResult,
  CorridorStatus,
} from "@corlens/core";
import { chatCompletion, getOpenAIClient } from "../ai/openai.js";

// ─── AI note generator (multi-route aware) ─────────────────────────────────
// We give the model the full route comparison so it can explain *why* the
// winner won and *why* the rejected routes lost. The output is a 130-200
// word grounded commentary that surfaces both the picker's verdict and the
// concrete numbers behind it.

const SYSTEM_PROMPT = `You are an XRPL treasury analyst writing concise commentary about fiat payment corridors. The user is reading about a single fiat-pair corridor (e.g. USD → CNY) which has multiple candidate routes — different issuer combinations on each side. The corridor system already picked the best route; your job is to explain the corridor and that pick.

Style:
- Plain prose, 130 to 200 words.
- First sentence: what this corridor is and why it matters.
- Then state which route won and the concrete reason (depth, status, risk).
- Briefly mention 1-2 alternatives and why they're weaker.
- End with a one-sentence verdict: "production-ready", "usable for small flows", or "informational only".
- Use ONLY the numbers in the context. Never invent offer counts, AMM sizes, or issuer floats.
- Stay analytical. Don't praise Ripple or XRPL.
- No bullet lists, no headers.`;

export interface AiNoteContext {
  status: CorridorStatus;
  routes: CorridorRouteResult[];
  winner: CorridorRouteResult | null;
}

function summarizeRoute(r: CorridorRouteResult): string {
  const parts: string[] = [`Route ${r.routeId} (${r.label})`];
  parts.push(`status=${r.status}`);
  parts.push(`paths=${r.pathCount}`);
  if (r.recommendedRiskScore != null) parts.push(`risk=${r.recommendedRiskScore}`);
  if (r.recommendedHops != null) parts.push(`hops=${r.recommendedHops}`);
  if (r.recommendedCost != null) parts.push(`cost=${r.recommendedCost}`);
  if (r.liquidity?.xrpLeg)
    parts.push(`xrpLeg=${r.liquidity.xrpLeg.toIouOffers}/${r.liquidity.xrpLeg.toXrpOffers}`);
  if (r.liquidity?.directBook)
    parts.push(`directBook=${r.liquidity.directBook.fwdOffers}/${r.liquidity.directBook.revOffers}`);
  if (r.liquidity?.amm?.xrpReserve) {
    const xrp = Number(r.liquidity.amm.xrpReserve) / 1_000_000;
    parts.push(`amm=${xrp.toFixed(0)}xrp`);
  }
  if (r.liquidity?.issuerObligation)
    parts.push(`issuerFloat=${Number(r.liquidity.issuerObligation).toFixed(0)}`);
  if (r.rejectedReason) parts.push(`rejected=${r.rejectedReason}`);
  return parts.join(", ");
}

function summarizeContext(entry: CorridorPairDef, ctx: AiNoteContext): string {
  const lines: string[] = [
    `Corridor: ${entry.label} (${entry.shortLabel})`,
    `Category: ${entry.category}`,
    `Tier: ${entry.tier}`,
    `Region: ${entry.region}`,
    `Static description: ${entry.description}`,
    `Static use case: ${entry.useCase}`,
    `Live status: ${ctx.status}`,
    `Winning route: ${ctx.winner ? ctx.winner.routeId + " (" + ctx.winner.label + ")" : "none"}`,
    "",
    "All scanned routes:",
  ];
  for (const r of ctx.routes) {
    lines.push("  - " + summarizeRoute(r));
  }
  return lines.join("\n");
}

/** Purely local note — never calls OpenAI. Used for low-priority dead lanes. */
export function generateCorridorAiNoteLocal(
  entry: CorridorPairDef,
  ctx: AiNoteContext,
): string {
  // Off-chain-bridge corridors have no on-chain routes to describe. Build
  // the note from the actor registry instead: list the main ramps on each
  // side and flag whether Ripple ODL / RLUSD support is confirmed. The
  // verdict tracks the classifier status (GREEN / AMBER / RED) which
  // reflects real-world rail quality, not on-chain XRPL depth.
  if (entry.category === "off-chain-bridge") {
    const src = entry.sourceActors ?? [];
    const dst = entry.destActors ?? [];
    const srcHl = src.slice(0, 3).map((a) => a.name + (a.odl ? " (ODL)" : "")).join(", ");
    const dstHl = dst.slice(0, 3).map((a) => a.name + (a.odl ? " (ODL)" : "")).join(", ");
    const rlusdOn =
      src.filter((a) => a.supportsRlusd).length +
      dst.filter((a) => a.supportsRlusd).length;
    const odlOn = src.filter((a) => a.odl).length + dst.filter((a) => a.odl).length;
    const verdict =
      ctx.status === "GREEN"
        ? "Verdict: production-ready off-chain rail. ODL partners and/or RLUSD venues on both sides — a payment sent today would settle via Ripple Payments infrastructure, not on-ledger pathfind."
        : ctx.status === "RED"
          ? "Verdict: thin. At least one side lacks a confirmed XRPL-connected venue; route would rely on a super-hub (Tranglo, Onafriq) or offshore P2P."
          : "Verdict: usable for small flows. Real-world rail exists on both sides but single-counterparty risk — the picker can't diversify across multiple XRPL-connected venues.";
    return (
      `${entry.description} ` +
      `Source ramps: ${srcHl || "n/a"}. Destination ramps: ${dstHl || "n/a"}. ` +
      `${rlusdOn} of ${src.length + dst.length} actors publish confirmed RLUSD support; ${odlOn} are Ripple ODL / Ripple Payments partners. ` +
      `XRPL hop: ${entry.bridgeAsset ?? "RLUSD"}. CorLens does not path_find this lane — there is no on-chain IOU trust line — so the verdict below is derived from real-world partner quality, not on-ledger depth. ` +
      verdict
    );
  }

  const winner = ctx.winner
    ? `Picker evaluated ${ctx.routes.length} candidate route${ctx.routes.length !== 1 ? "s" : ""} and selected **${ctx.winner.label}** (${ctx.winner.status}, ${ctx.winner.pathCount} paths).`
    : `Picker evaluated ${ctx.routes.length} candidate route${ctx.routes.length !== 1 ? "s" : ""}; none produced a viable path on the last scan.`;
  const notes = ctx.winner?.liquidity?.notes ?? [];
  const liquiditySummary = notes.length > 0 ? `Live scan: ${notes.join("; ")}.` : "";
  const verdict =
    ctx.status === "GREEN"
      ? "Verdict: production-ready."
      : ctx.status === "AMBER"
        ? "Verdict: usable for small flows."
        : "Verdict: informational only — no reliable route right now.";
  return [entry.description, winner, liquiditySummary, verdict].filter(Boolean).join(" ");
}

export async function generateCorridorAiNote(
  entry: CorridorPairDef,
  ctx: AiNoteContext,
): Promise<string> {
  if (!getOpenAIClient()) {
    // Deterministic fallback so cards never blank out without an API key
    const winner = ctx.winner
      ? `Picker chose ${ctx.winner.label} (${ctx.winner.status}, ${ctx.winner.pathCount} paths).`
      : "Picker found no viable route.";
    const notes = ctx.winner?.liquidity?.notes ?? [];
    return [
      entry.description,
      winner,
      notes.length > 0 ? `Live scan: ${notes.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const context = summarizeContext(entry, ctx);
  const content = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Live data for the corridor. Write the commentary.\n\n${context}`,
      },
    ],
    { maxTokens: 500, temperature: 0.2, model: "gpt-4o-mini" },
  );
  return content.trim();
}
