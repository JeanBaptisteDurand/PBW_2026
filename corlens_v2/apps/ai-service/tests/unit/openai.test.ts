import { describe, expect, it, vi } from "vitest";
import { createOpenAIClient } from "../../src/connectors/openai.js";

describe("openai client", () => {
  it("calls chat.completions.create with passed params and parses the response", async () => {
    const fakeOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "hello world" } }],
            model: "gpt-4o-mini",
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
      embeddings: { create: vi.fn() },
    };

    const client = createOpenAIClient({ openai: fakeOpenAI as never });
    const out = await client.chat({
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-4o-mini",
      temperature: 0.5,
      maxTokens: 100,
    });

    expect(out.content).toBe("hello world");
    expect(out.model).toBe("gpt-4o-mini");
    expect(out.tokensIn).toBe(10);
    expect(out.tokensOut).toBe(5);
    expect(fakeOpenAI.chat.completions.create).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 100,
    });
  });

  it("calls embeddings.create and returns vector + token count", async () => {
    const fakeOpenAI = {
      chat: { completions: { create: vi.fn() } },
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
      },
    };

    const client = createOpenAIClient({ openai: fakeOpenAI as never });
    const out = await client.embed({ input: "hello", model: "text-embedding-3-small" });

    expect(out.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(out.model).toBe("text-embedding-3-small");
    expect(out.tokensIn).toBe(4);
  });

  it("throws with a usable message if OpenAI fails", async () => {
    const fakeOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("rate limit exceeded")),
        },
      },
      embeddings: { create: vi.fn() },
    };
    const client = createOpenAIClient({ openai: fakeOpenAI as never });
    await expect(
      client.chat({ messages: [{ role: "user", content: "hi" }], model: "gpt-4o-mini" }),
    ).rejects.toThrow(/rate limit/);
  });
});
