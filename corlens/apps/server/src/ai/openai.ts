import OpenAI from "openai";
import { config } from "../config.js";
import { logger } from "../logger.js";

// ─── Singleton Client ─────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!config.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }
  return openaiClient;
}

// ─── Chat Completion ──────────────────────────────────────────────────────────

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function chatCompletion(
  messages: ChatCompletionMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const client = getOpenAIClient();

  if (!client) {
    logger.warn("[openai] No API key configured — returning placeholder response");
    return "OpenAI API key not configured. This is a placeholder response for demo purposes.";
  }

  const {
    model = "gpt-4o-mini",
    maxTokens = 2000,
    temperature = 0.3,
  } = options;

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    return response.choices[0]?.message?.content ?? "";
  } catch (err: any) {
    logger.error("[openai] Chat completion failed", { error: err?.message });
    throw err;
  }
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

export async function createEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  if (!client) {
    logger.warn("[openai] No API key configured — returning zero embedding");
    return new Array(1536).fill(0);
  }

  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0]?.embedding ?? [];
  } catch (err: any) {
    logger.error("[openai] Embedding creation failed", { error: err?.message });
    throw err;
  }
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();

  if (!client) {
    logger.warn("[openai] No API key configured — returning zero embeddings");
    return texts.map(() => new Array(1536).fill(0));
  }

  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  } catch (err: any) {
    logger.error("[openai] Batch embedding creation failed", { error: err?.message });
    throw err;
  }
}
