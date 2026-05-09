import { describe, expect, it, type vi } from "vitest";
import { CorridorRagPhase } from "../../../src/services/phases/02-corridor-rag.js";
import { collectEvents, makeCtx, makeMockDeps } from "./_helpers.js";

describe("CorridorRagPhase", () => {
  it("emits corridor-rag with the chat answer", async () => {
    const deps = makeMockDeps();
    (deps.corridor.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: "Use Bitso on the MX side.",
      sources: [],
    });
    const ctx = makeCtx({}, deps);

    const events = await collectEvents(new CorridorRagPhase(), ctx);
    const ev = events.find((e) => e.kind === "corridor-rag");
    expect(ev).toBeDefined();
    expect(ctx.state.corridorRagAnswer).toBe("Use Bitso on the MX side.");
  });

  it("swallows errors and emits a tool-result on failure", async () => {
    const deps = makeMockDeps();
    (deps.corridor.chat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rag fail"));
    const ctx = makeCtx({}, deps);

    const events = await collectEvents(new CorridorRagPhase(), ctx);
    expect(events.find((e) => e.kind === "tool-result")).toBeDefined();
    expect(ctx.state.corridorRagAnswer).toBeNull();
  });

  it("emits step at start", async () => {
    const ctx = makeCtx();
    const events = await collectEvents(new CorridorRagPhase(), ctx);
    expect(events[0]?.kind).toBe("step");
  });
});
