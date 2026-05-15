import type { path as pp } from "@corlens/contracts";
import { apiUrl, fetchJSON, getAuthToken } from "./client.js";

type AnalyzeResponse = pp.AnalyzeResponse;
type AnalysisSummary = pp.AnalysisSummary;
type GraphResponse = pp.GraphResponse;
type ExplanationsResponse = { analysisId: string; items: pp.ExplanationItem[] };
type ChatResponse = pp.ChatResponse;
type ChatHistoryResponse = pp.ChatHistoryResponse;

export const pathApi = {
  startAnalysis(seedAddress: string, seedLabel?: string, depth?: number): Promise<AnalyzeResponse> {
    return fetchJSON<AnalyzeResponse>("/analyze", {
      method: "POST",
      body: JSON.stringify({ seedAddress, seedLabel, depth }),
    });
  },

  getAnalysis(id: string): Promise<AnalysisSummary> {
    return fetchJSON<AnalysisSummary>(`/analysis/${id}`);
  },

  getGraph(id: string): Promise<GraphResponse> {
    return fetchJSON<GraphResponse>(`/analysis/${id}/graph`);
  },

  getExplanations(id: string): Promise<ExplanationsResponse> {
    return fetchJSON<ExplanationsResponse>(`/analysis/${id}/explanations`);
  },

  chat(analysisId: string, message: string): Promise<ChatResponse> {
    return fetchJSON<ChatResponse>(`/analysis/${analysisId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  getChat(analysisId: string): Promise<ChatHistoryResponse> {
    return fetchJSON<ChatHistoryResponse>(`/analysis/${analysisId}/chat`);
  },

  listAnalyses(limit = 20): Promise<{ analyses: AnalysisSummary[] }> {
    return fetchJSON(`/analyses?limit=${limit}`);
  },

  getHistory(address: string): Promise<unknown> {
    return fetchJSON(`/history/${encodeURIComponent(address)}`);
  },

  openHistoryStream(address: string, depth = 1, maxTx = 200, sinceDays = 30): EventSource {
    const url = new URL(apiUrl("/history/stream"), window.location.origin);
    url.searchParams.set("address", address);
    url.searchParams.set("depth", String(depth));
    url.searchParams.set("maxTx", String(maxTx));
    url.searchParams.set("sinceDays", String(sinceDays));
    const token = getAuthToken();
    if (token) url.searchParams.set("access_token", token);
    return new EventSource(url.toString());
  },
};
