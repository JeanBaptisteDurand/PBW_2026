import type { AIServiceClient } from "../../connectors/ai-service.js";
import { PARTNER_DEPTH_BOOKS, rankActors } from "./_currency-meta.js";
import { type Phase, type PhaseContext, type PhaseEmit, nowIso } from "./types.js";

async function aiWebSearch(ai: AIServiceClient, emit: PhaseEmit, query: string): Promise<string[]> {
  emit({ kind: "tool-call", name: "webSearch", args: { query }, at: nowIso() });
  try {
    const resp = await ai.complete({
      purpose: "agent.web-search",
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant. The user asks about a financial company or crypto exchange. Return 3-5 bullet points of key facts: founded date, headquarters, licence status, recent incidents (hacks, outages, regulatory actions), volume if known, and any red flags. Be factual. If you don't know, say so. No marketing language.",
        },
        { role: "user", content: query },
      ],
      temperature: 0,
      maxTokens: 500,
    });
    const bullets = resp.content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    emit({
      kind: "tool-result",
      name: "webSearch",
      summary: `${bullets.length} facts found for "${query}".`,
      at: nowIso(),
    });
    emit({ kind: "web-search", query, results: bullets, at: nowIso() });
    return bullets;
  } catch (err) {
    emit({
      kind: "tool-result",
      name: "webSearch",
      summary: `Web search failed: ${(err as Error).message}`,
      at: nowIso(),
    });
    return [];
  }
}

export class ActorResearchPhase implements Phase {
  readonly name = "actor-research" as const;

  async run(ctx: PhaseContext, emit: PhaseEmit): Promise<void> {
    const { state, deps } = ctx;
    emit({
      kind: "step",
      step: "actor_research",
      detail: "Researching top actors on both sides in parallel",
      at: nowIso(),
    });

    const topSrc = rankActors(state.srcActors).slice(0, 3);
    const topDst = rankActors(state.dstActors).slice(0, 3);
    const allTop = [...topSrc, ...topDst];

    const searchPromises = allTop.map(async (actor) => {
      const results = await aiWebSearch(
        deps.ai,
        emit,
        `${actor.name} crypto exchange reputation safety incidents 2025 2026`,
      );
      state.actorResearch.set(actor.key, results);
    });

    const corridorId = state.corridor.id;
    const depthPromise = (async () => {
      if (!corridorId) return;
      for (const actor of allTop) {
        const bookKey = `${corridorId}:${actor.key}`;
        const mapping = PARTNER_DEPTH_BOOKS[bookKey];
        if (!mapping) continue;
        emit({
          kind: "tool-call",
          name: "fetchPartnerDepth",
          args: { corridorId, actor: actor.key },
          at: nowIso(),
        });
        try {
          const snap = await deps.marketData.partnerDepth(mapping.actor, mapping.book);
          state.partnerDepth = snap;
          emit({
            kind: "tool-result",
            name: "fetchPartnerDepth",
            summary: `${snap.venue}: ${snap.bidCount} bids, ${snap.askCount} asks${snap.spreadBps !== null ? `, ${snap.spreadBps.toFixed(1)} bps` : ""}.`,
            at: nowIso(),
          });
          emit({
            kind: "partner-depth",
            actor: actor.key,
            summary: snap,
            at: nowIso(),
          });
        } catch (err) {
          emit({
            kind: "tool-result",
            name: "fetchPartnerDepth",
            summary: `Failed: ${(err as Error).message}`,
            at: nowIso(),
          });
        }
        break;
      }
    })();

    await Promise.all([...searchPromises, depthPromise]);
  }
}
