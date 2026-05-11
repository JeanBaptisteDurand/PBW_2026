import type { AIServiceClient } from "../../connectors/ai-service.js";
import { PARTNER_DEPTH_BOOKS, rankActors } from "../../data/xrpl-utils.js";
import { EventQueue } from "./_event-queue.js";
import { type Phase, type PhaseContext, type SafePathEvent, errMessage, nowIso } from "./types.js";

async function aiWebSearch(ai: AIServiceClient, q: EventQueue, query: string): Promise<string[]> {
  q.push({ kind: "tool-call", name: "webSearch", args: { query }, at: nowIso() });
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
    q.push({
      kind: "tool-result",
      name: "webSearch",
      summary: `${bullets.length} facts found for "${query}".`,
      at: nowIso(),
    });
    q.push({ kind: "web-search", query, results: bullets, at: nowIso() });
    return bullets;
  } catch (err) {
    q.push({
      kind: "tool-result",
      name: "webSearch",
      summary: `Web search failed: ${errMessage(err)}`,
      at: nowIso(),
    });
    return [];
  }
}

export class ActorResearchPhase implements Phase {
  readonly name = "actor-research" as const;

  async *run(ctx: PhaseContext): AsyncGenerator<SafePathEvent> {
    const { state, deps } = ctx;
    yield {
      kind: "step",
      step: "actor_research",
      detail: "Researching top actors on both sides in parallel",
      at: nowIso(),
    };

    const topSrc = rankActors(state.srcActors).slice(0, 3);
    const topDst = rankActors(state.dstActors).slice(0, 3);
    const allTop = [...topSrc, ...topDst];
    const queue = new EventQueue();

    const searchPromises = allTop.map(async (actor) => {
      const bullets = await aiWebSearch(
        deps.ai,
        queue,
        `${actor.name} crypto exchange reputation safety incidents 2025 2026`,
      );
      state.actorResearch.set(actor.key, bullets);
    });

    const corridorId = state.corridor.id;
    const depthPromise = (async () => {
      if (!corridorId) return;
      for (const actor of allTop) {
        const bookKey = `${corridorId}:${actor.key}`;
        const mapping = PARTNER_DEPTH_BOOKS[bookKey];
        if (!mapping) continue;
        queue.push({
          kind: "tool-call",
          name: "fetchPartnerDepth",
          args: { corridorId, actor: actor.key },
          at: nowIso(),
        });
        try {
          const snap = await deps.marketData.partnerDepth(mapping.actor, mapping.book);
          state.partnerDepth = snap;
          queue.push({
            kind: "tool-result",
            name: "fetchPartnerDepth",
            summary: `${snap.venue}: ${snap.bidCount} bids, ${snap.askCount} asks${snap.spreadBps !== null ? `, ${snap.spreadBps.toFixed(1)} bps` : ""}.`,
            at: nowIso(),
          });
          queue.push({
            kind: "partner-depth",
            actor: actor.key,
            summary: snap,
            at: nowIso(),
          });
        } catch (err) {
          queue.push({
            kind: "tool-result",
            name: "fetchPartnerDepth",
            summary: `Failed: ${errMessage(err)}`,
            at: nowIso(),
          });
        }
        break;
      }
    })();

    const allDone = Promise.all([...searchPromises, depthPromise]).finally(() => queue.end());

    for await (const ev of queue.drain()) {
      yield ev;
    }
    await allDone;
  }
}
