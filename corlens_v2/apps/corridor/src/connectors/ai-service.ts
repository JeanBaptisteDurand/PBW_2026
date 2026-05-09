import { hmacSigner } from "@corlens/clients";

export type AIServiceClient = {
  complete(input: {
    purpose: string;
    messages: Array<{ role: string; content: string }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ content: string; tokensIn: number; tokensOut: number }>;
  embed(input: { purpose: string; input: string }): Promise<{
    embedding: number[];
    tokensIn: number;
  }>;
};

export type AIServiceClientOptions = {
  baseUrl: string;
  hmacSecret: string;
  fetch?: typeof fetch;
};

export function createAIServiceClient(opts: AIServiceClientOptions): AIServiceClient {
  const f = opts.fetch ?? fetch;
  const sign = hmacSigner({ secret: opts.hmacSecret });

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const bodyStr = JSON.stringify(body);
    const res = await f(`${opts.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...sign(bodyStr) },
      body: bodyStr,
    });
    if (!res.ok) throw new Error(`ai-service ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
  }

  return {
    async complete(input) {
      const r = await postJson<{ content: string; tokensIn: number; tokensOut: number }>(
        "/completion",
        input,
      );
      return { content: r.content, tokensIn: r.tokensIn, tokensOut: r.tokensOut };
    },
    async embed(input) {
      const r = await postJson<{ embedding: number[]; tokensIn: number }>("/embedding", input);
      return { embedding: r.embedding, tokensIn: r.tokensIn };
    },
  };
}
