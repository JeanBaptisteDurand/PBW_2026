import { describe, expect, it, vi } from "vitest";
import { createCompletionService } from "../../src/services/completion.service.js";

describe("completion.service", () => {
  it("calls openai, logs the prompt, and returns response with promptLogId", async () => {
    const openai = {
      chat: vi
        .fn()
        .mockResolvedValue({ content: "hi", model: "gpt-4o-mini", tokensIn: 5, tokensOut: 2 }),
      embed: vi.fn(),
    };
    const promptLog = {
      insert: vi.fn(async () => ({ id: "log-1" })),
      rollupByPurpose: vi.fn(),
    };
    const svc = createCompletionService({
      openai: openai as never,
      promptLog: promptLog as never,
      defaultModel: "gpt-4o-mini",
    });

    const out = await svc.complete({
      purpose: "test",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(out.content).toBe("hi");
    expect(out.promptLogId).toBe("log-1");
    expect(openai.chat).toHaveBeenCalledTimes(1);
    expect(promptLog.insert).toHaveBeenCalledTimes(1);
    const logCall = promptLog.insert.mock.calls[0][0];
    expect(logCall.purpose).toBe("test");
    expect(logCall.tokensIn).toBe(5);
    expect(logCall.tokensOut).toBe(2);
  });

  it("logs an error entry when openai throws and re-throws", async () => {
    const openai = {
      chat: vi.fn().mockRejectedValue(new Error("rate limit")),
      embed: vi.fn(),
    };
    const promptLog = { insert: vi.fn(async () => ({ id: "log-1" })), rollupByPurpose: vi.fn() };
    const svc = createCompletionService({
      openai: openai as never,
      promptLog: promptLog as never,
      defaultModel: "gpt-4o-mini",
    });

    await expect(
      svc.complete({ purpose: "test", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/rate limit/);
    expect(promptLog.insert).toHaveBeenCalledTimes(1);
    expect(promptLog.insert.mock.calls[0][0].error).toMatch(/rate limit/);
  });
});
