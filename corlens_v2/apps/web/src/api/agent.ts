import type { agent as ag } from "@corlens/contracts";
import { apiUrl, fetchJSON, getAuthToken } from "./client.js";

type SafePathRunSummary = ag.SafePathRunSummary;
type SafePathRunDetail = ag.SafePathRunDetail;
type AnalysisComplianceResponse = ag.AnalysisComplianceResponse;
type ComplianceVerifyResponse = ag.ComplianceVerifyResponse;

export const agentApi = {
  listSafePathRuns(): Promise<{ runs: SafePathRunSummary[] }> {
    return fetchJSON("/safe-path");
  },

  getSafePathRun(id: string): Promise<SafePathRunDetail> {
    return fetchJSON(`/safe-path/${id}`);
  },

  generateComplianceAnalysis(analysisId: string): Promise<AnalysisComplianceResponse> {
    return fetchJSON(`/compliance/analysis/${analysisId}`, { method: "POST" });
  },

  getComplianceAnalysisMarkdown(analysisId: string): Promise<AnalysisComplianceResponse> {
    return fetchJSON(`/compliance/analysis/${analysisId}`);
  },

  async getComplianceAnalysisPdf(analysisId: string): Promise<Blob> {
    const token = getAuthToken();
    const res = await fetch(apiUrl(`/compliance/analysis/${analysisId}/pdf`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);
    return res.blob();
  },

  verifyCompliance(hash: string): Promise<ComplianceVerifyResponse> {
    return fetchJSON(`/compliance/verify?hash=${encodeURIComponent(hash)}`);
  },

  async openSafePathStream(
    body: ag.SafePathRequest,
    onEvent: (event: unknown) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = getAuthToken();
    const res = await fetch(apiUrl("/safe-path"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`SSE start failed: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const idx = buffer.indexOf("\n\n");
        if (idx < 0) break;
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = chunk.startsWith("data: ") ? chunk.slice(6) : chunk;
        if (line === "[DONE]") return;
        try {
          onEvent(JSON.parse(line));
        } catch {
          // skip malformed frames
        }
      }
    }
  },
};
