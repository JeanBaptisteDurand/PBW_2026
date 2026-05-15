import type { corridor as cc } from "@corlens/contracts";
import { fetchJSON } from "./client.js";

type CorridorListItem = cc.CorridorListItem;
type CorridorDetail = cc.CorridorDetail;
type ChatResponse = cc.ChatResponse;
type ChatHistoryResponse = cc.ChatHistoryResponse;
type CurrencyMeta = cc.CurrencyMeta;

type ListResponse = { corridors: CorridorListItem[] };

let cache: ListResponse | null = null;

export function invalidateCorridorCache(): void {
  cache = null;
}

export const corridorApi = {
  listCorridors(): Promise<ListResponse> {
    if (cache) return Promise.resolve(cache);
    return fetchJSON<ListResponse>("/corridors?limit=500").then((data) => {
      cache = data;
      return data;
    });
  },

  getCorridor(id: string): Promise<{ corridor: CorridorDetail }> {
    return fetchJSON(`/corridors/${encodeURIComponent(id)}`);
  },

  getStatusHistory(
    id: string,
    days = 30,
  ): Promise<{ corridorId: string; events: cc.StatusEvent[] }> {
    return fetchJSON(`/corridors/${encodeURIComponent(id)}/status-history?days=${days}`);
  },

  getPartnerDepth(actor: string, book: string): Promise<unknown> {
    return fetchJSON(
      `/corridors/partner-depth/${encodeURIComponent(actor)}/${encodeURIComponent(book)}`,
    );
  },

  chat(req: { corridorId?: string; message: string }): Promise<ChatResponse> {
    return fetchJSON("/corridors/chat", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getChatById(chatId: string): Promise<ChatHistoryResponse> {
    return fetchJSON(`/corridors/chat/${encodeURIComponent(chatId)}`);
  },

  getCurrencyMeta(code: string): Promise<CurrencyMeta> {
    return fetchJSON(`/corridors/currency-meta/${encodeURIComponent(code)}`);
  },

  listCurrencyMeta(): Promise<{ currencies: CurrencyMeta[]; globalHubs: cc.ActorEntry[] }> {
    return fetchJSON("/corridors/currency-meta");
  },
};
