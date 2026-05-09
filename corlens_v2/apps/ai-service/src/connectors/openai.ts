import OpenAI from "openai";

export type ChatInput = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

export type ChatOutput = {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export type EmbedInput = {
  input: string;
  model: string;
};

export type EmbedOutput = {
  embedding: number[];
  model: string;
  tokensIn: number;
};

export interface OpenAIClient {
  chat(input: ChatInput): Promise<ChatOutput>;
  embed(input: EmbedInput): Promise<EmbedOutput>;
}

export type OpenAIClientOptions = {
  openai: OpenAI;
};

export function createOpenAIClient(opts: OpenAIClientOptions): OpenAIClient {
  return {
    async chat(input) {
      const params: Record<string, unknown> = {
        messages: input.messages,
        model: input.model,
      };
      if (input.temperature !== undefined) params.temperature = input.temperature;
      if (input.maxTokens !== undefined) params.max_tokens = input.maxTokens;

      const resp = (await opts.openai.chat.completions.create(params as never)) as {
        choices: Array<{ message: { content: string | null } }>;
        model: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = resp.choices[0]?.message?.content ?? "";
      return {
        content,
        model: resp.model,
        tokensIn: resp.usage?.prompt_tokens ?? 0,
        tokensOut: resp.usage?.completion_tokens ?? 0,
      };
    },

    async embed(input) {
      const resp = (await opts.openai.embeddings.create({
        input: input.input,
        model: input.model,
      } as never)) as {
        data: Array<{ embedding: number[] }>;
        model: string;
        usage?: { prompt_tokens?: number };
      };
      const embedding = resp.data[0]?.embedding ?? [];
      return {
        embedding,
        model: resp.model,
        tokensIn: resp.usage?.prompt_tokens ?? 0,
      };
    },
  };
}

export function makeOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}
