import { vi } from "vitest";
import type {
  Phase,
  PhaseContext,
  SafePathEvent,
  SafePathRequest,
} from "../../../src/services/phases/types.js";
import { makeInitialState } from "../../../src/services/phases/types.js";

export function makeMockDeps(overrides?: Partial<PhaseContext["deps"]>): PhaseContext["deps"] {
  return {
    corridor: {
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      chat: vi.fn().mockResolvedValue({ answer: "ok", sources: [] }),
      getCurrencyMeta: vi.fn().mockResolvedValue(null),
      listCurrencyMeta: vi.fn().mockResolvedValue({ currencies: [], globalHubs: [] }),
    },
    path: {
      analyze: vi
        .fn()
        .mockResolvedValue({ id: "00000000-0000-0000-0000-000000000001", status: "queued" }),
      getAnalysis: vi.fn().mockResolvedValue({ status: "done" }),
      getGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
      chat: vi.fn().mockResolvedValue({ answer: "ok", sources: [] }),
      history: vi.fn().mockResolvedValue({}),
      quickEvalRisk: vi.fn().mockResolvedValue({
        address: "rDefault",
        score: 10,
        flags: [],
        summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
      }),
    },
    ai: {
      complete: vi.fn().mockResolvedValue({ content: "stub", tokensIn: 1, tokensOut: 1 }),
      embed: vi.fn().mockResolvedValue({ embedding: [], tokensIn: 1 }),
    },
    marketData: {
      pathFind: vi.fn().mockResolvedValue({ result: { alternatives: [] } }),
      partnerDepth: vi.fn().mockResolvedValue({
        actor: "bitso",
        book: "xrp_mxn",
        venue: "Bitso",
        bidCount: 1,
        askCount: 1,
        spreadBps: 10,
        bidDepthBase: "100",
        askDepthBase: "100",
        fetchedAt: new Date().toISOString(),
      }),
      accountInfo: vi.fn().mockResolvedValue({}),
      trustLines: vi.fn().mockResolvedValue({}),
      gatewayBalances: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as PhaseContext["deps"];
}

export function makeCtx(
  input: Partial<SafePathRequest> = {},
  deps?: PhaseContext["deps"],
): PhaseContext {
  return {
    input: {
      srcCcy: "USD",
      dstCcy: "MXN",
      amount: "100",
      maxRiskTolerance: "MED",
      ...input,
    },
    state: makeInitialState(),
    deps: deps ?? makeMockDeps(),
  };
}

export async function collectEvents(phase: Phase, ctx: PhaseContext): Promise<SafePathEvent[]> {
  const events: SafePathEvent[] = [];
  for await (const e of phase.run(ctx)) {
    events.push(e);
  }
  return events;
}
