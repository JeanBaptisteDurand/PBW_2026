import { z } from "zod";
import { Uuid } from "./shared.js";

// ─── Completion ──────────────────────────────────────────────────
export const ChatRole = z.enum(["system", "user", "assistant"]);
export type ChatRole = z.infer<typeof ChatRole>;

export const ChatMessage = z.object({
  role: ChatRole,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const CompletionRequest = z.object({
  purpose: z.string().min(1).max(100),
  messages: z.array(ChatMessage).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
});
export type CompletionRequest = z.infer<typeof CompletionRequest>;

export const CompletionResponse = z.object({
  content: z.string(),
  model: z.string(),
  tokensIn: z.number().int().min(0),
  tokensOut: z.number().int().min(0),
  promptLogId: Uuid,
});
export type CompletionResponse = z.infer<typeof CompletionResponse>;

// ─── Embedding ───────────────────────────────────────────────────
export const EmbeddingRequest = z.object({
  purpose: z.string().min(1).max(100),
  input: z.string().min(1),
  model: z.string().optional(),
});
export type EmbeddingRequest = z.infer<typeof EmbeddingRequest>;

export const EmbeddingResponse = z.object({
  embedding: z.array(z.number()),
  model: z.string(),
  tokensIn: z.number().int().min(0),
  promptLogId: Uuid,
});
export type EmbeddingResponse = z.infer<typeof EmbeddingResponse>;

// ─── Web search ──────────────────────────────────────────────────
export const WebSearchRequest = z.object({
  purpose: z.string().min(1).max(100),
  query: z.string().min(1).max(500),
  maxResults: z.number().int().min(1).max(20).default(5),
});
export type WebSearchRequest = z.infer<typeof WebSearchRequest>;

export const WebSearchResult = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  score: z.number().optional(),
});
export type WebSearchResult = z.infer<typeof WebSearchResult>;

export const WebSearchResponse = z.object({
  query: z.string(),
  answer: z.string().nullable(),
  results: z.array(WebSearchResult),
  fromCache: z.boolean(),
});
export type WebSearchResponse = z.infer<typeof WebSearchResponse>;

// ─── Usage rollup ────────────────────────────────────────────────
export const UsageRollup = z.object({
  since: z.string().datetime(),
  byPurpose: z.array(
    z.object({
      purpose: z.string(),
      callCount: z.number().int().min(0),
      tokensIn: z.number().int().min(0),
      tokensOut: z.number().int().min(0),
    }),
  ),
});
export type UsageRollup = z.infer<typeof UsageRollup>;
