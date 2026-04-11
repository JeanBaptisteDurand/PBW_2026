import type {
  GraphData,
  ComplianceReportData,
  ChatMessage,
  ChatResponse,
  CorridorRequest,
  CorridorAnalysis,
  CorridorListItem,
  CorridorDetailResponse,
  CorridorChatRequest,
  CorridorChatResponse,
} from "@xrplens/core";

const BASE_URL = "/api";

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("xrplens_auth");
    if (raw) {
      const { token } = JSON.parse(raw);
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch {}
  return {};
}

// ─── Generic Fetch ───────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJSON<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

// ─── Response Types ──────────────────────────────────────────

export interface StartAnalysisResponse {
  id: string;
  status: string;
}

export interface AnalysisStatusResponse {
  id: string;
  status: "queued" | "running" | "done" | "error";
  seedAddress: string;
  seedLabel?: string;
  error?: string;
  summaryJson?: string;
  createdAt: string;
}

export interface ComplianceReportResponse {
  id: string;
  report: ComplianceReportData;
}

// ─── API Methods ─────────────────────────────────────────────

export const api = {
  /** POST /api/analyze — start a new analysis.
   * `depth` (1-3) controls BFS expansion:
   *   1 = single-seed crawl (default, same as before),
   *   2 = seed + top-8 heavy neighbours each crawled as their own hub,
   *   3 = two hops of expansion. */
  startAnalysis(
    seedAddress: string,
    seedLabel?: string,
    depth?: number,
  ): Promise<StartAnalysisResponse> {
    return fetchJSON<StartAnalysisResponse>("/analyze", {
      method: "POST",
      body: JSON.stringify({ seedAddress, seedLabel, depth }),
    });
  },

  /** GET /api/analyze/:id/status — poll analysis status */
  getAnalysisStatus(id: string): Promise<AnalysisStatusResponse> {
    return fetchJSON<AnalysisStatusResponse>(`/analyze/${id}/status`);
  },

  /** GET /api/analyze — list all past analyses */
  getAnalysisHistory(): Promise<AnalysisStatusResponse[]> {
    return fetchJSON<AnalysisStatusResponse[]>("/analyze");
  },

  /** GET /api/analysis/:id/graph — fetch graph data */
  getGraph(analysisId: string): Promise<GraphData> {
    return fetchJSON<GraphData>(`/analysis/${analysisId}/graph`);
  },

  /** POST /api/compliance/:analysisId — generate compliance report */
  generateComplianceReport(
    analysisId: string,
  ): Promise<ComplianceReportResponse> {
    return fetchJSON<ComplianceReportResponse>(`/compliance/${analysisId}`, {
      method: "POST",
    });
  },

  /** GET /api/compliance/:analysisId — list compliance reports */
  getComplianceReports(
    analysisId: string,
  ): Promise<ComplianceReportResponse[]> {
    return fetchJSON<ComplianceReportResponse[]>(`/compliance/${analysisId}`);
  },

  /** POST /api/chat — send a chat message */
  sendChatMessage(
    analysisId: string,
    message: string,
    chatId?: string,
  ): Promise<ChatResponse> {
    return fetchJSON<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ analysisId, message, chatId }),
    });
  },

  /** GET /api/chat/:chatId — fetch chat history */
  getChatHistory(chatId: string): Promise<ChatMessage[]> {
    return fetchJSON<ChatMessage[]>(`/chat/${chatId}`);
  },

  /** POST /api/corridor — analyze payment corridor (legacy, used by Safe Path) */
  analyzeCorridor(request: CorridorRequest): Promise<CorridorAnalysis> {
    return fetchJSON<CorridorAnalysis>("/corridor", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  // ─── Corridor atlas (cached + filtered) ─────────────────────

  /** GET /api/corridors — list every catalog corridor with cached state */
  listCorridors(): Promise<{ corridors: CorridorListItem[] }> {
    return fetchJSON("/corridors");
  },

  /** GET /api/corridors/:id — one corridor with full cached analysis */
  getCorridor(id: string): Promise<{ corridor: CorridorDetailResponse }> {
    return fetchJSON(`/corridors/${encodeURIComponent(id)}`);
  },

  /** POST /api/corridors/refresh/:id — force a single corridor to re-scan */
  refreshCorridor(id: string): Promise<{ corridor: CorridorDetailResponse }> {
    return fetchJSON(`/corridors/refresh/${encodeURIComponent(id)}`, {
      method: "POST",
    });
  },

  /** GET /api/corridors/:id/partner-depth — live partner orderbook snapshot */
  getPartnerDepth(
    id: string,
    actor: string = "bitso",
  ): Promise<{
    snapshot: {
      actor: string;
      book: string;
      venue: string;
      bidCount: number;
      askCount: number;
      topBid: { price: string; amount: string } | null;
      topAsk: { price: string; amount: string } | null;
      spreadBps: number | null;
      bidDepthBase: string;
      askDepthBase: string;
      source: string;
      fetchedAt: string;
      ttlSeconds: number;
    };
  }> {
    return fetchJSON(
      `/corridors/${encodeURIComponent(id)}/partner-depth?actor=${encodeURIComponent(actor)}`,
    );
  },

  /** GET /api/corridors/:id/history — 30-day status timeline */
  getCorridorHistory(
    id: string,
    days: number = 30,
  ): Promise<{
    corridorId: string;
    windowDays: number;
    events: Array<{
      id: string;
      status: "GREEN" | "AMBER" | "RED" | "UNKNOWN";
      pathCount: number;
      recCost: string | null;
      source: "scan" | "seed" | "manual";
      at: string;
    }>;
  }> {
    return fetchJSON(
      `/corridors/${encodeURIComponent(id)}/history?days=${days}`,
    );
  },

  /** POST /api/corridors/chat — RAG chat about corridors */
  corridorChat(req: CorridorChatRequest): Promise<CorridorChatResponse> {
    return fetchJSON("/corridors/chat", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  // ─── Account ───────────────────────────────────────────────────

  /** GET /api/auth/profile — full account data */
  getProfile(): Promise<{
    id: string;
    walletAddress: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    subscriptions: Array<{
      id: string;
      txHash: string;
      amount: string;
      currency: string;
      paidAt: string;
    }>;
    analyses: Array<{
      id: string;
      status: string;
      seedAddress: string;
      seedLabel?: string;
      depth: number;
      error?: string;
      createdAt: string;
    }>;
  }> {
    return fetchJSON("/auth/profile");
  },

  // ─── Payment gate ──────────────────────────────────────────────

  /** GET /api/payment/info — payment options + demo wallet */
  getPaymentInfo(): Promise<{
    options: Array<{ currency: string; amount: string; label: string }>;
    demoWalletAddress: string;
  }> {
    return fetchJSON("/payment/info");
  },

  /** POST /api/payment/create — create payment request */
  createPaymentRequest(currency: "XRP" | "RLUSD" = "XRP"): Promise<{
    paymentId: string;
    destination: string;
    amount: string;
    currency: string;
    memo: string;
  }> {
    return fetchJSON("/payment/create", {
      method: "POST",
      body: JSON.stringify({ currency }),
    });
  },

  /** GET /api/payment/status/:id — poll payment status */
  getPaymentStatus(paymentId: string): Promise<{
    status: "pending" | "confirmed" | "expired" | "not_found";
    txHash?: string;
  }> {
    return fetchJSON(`/payment/status/${paymentId}`);
  },

  /** POST /api/payment/demo-pay — trigger demo payment */
  demoPay(paymentId: string): Promise<{ txHash: string }> {
    return fetchJSON("/payment/demo-pay", {
      method: "POST",
      body: JSON.stringify({ paymentId }),
    });
  },
};
