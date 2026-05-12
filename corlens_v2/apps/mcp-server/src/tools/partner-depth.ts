// Extracted helper for testability — no MCP SDK import here.

export type PartnerDepthDeps = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type ToolContent = { type: "text"; text: string };
export type ToolResult = { content: [ToolContent] };

export async function runGetPartnerDepth(
  actor: string,
  book: string,
  deps: PartnerDepthDeps = {},
): Promise<ToolResult> {
  const baseUrl = deps.baseUrl ?? process.env.CORLENS_API_URL ?? "http://localhost:8080/api";
  const fetcher = deps.fetchImpl ?? fetch;
  const url = `${baseUrl}/corridors/partner-depth/${encodeURIComponent(actor)}/${encodeURIComponent(book)}`;
  const res = await fetcher(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CorLens API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    venue?: string;
    bidCount?: number;
    askCount?: number;
    topBid?: { price: string; amount: string } | null;
    topAsk?: { price: string; amount: string } | null;
    spreadBps?: number | null;
    bidDepthBase?: string;
    askDepthBase?: string;
    fetchedAt?: string;
  };

  // No meaningful data: empty order book
  if (!data.bidCount && !data.askCount && data.spreadBps == null) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No partner-depth data for ${actor}/${book}.`,
        },
      ],
    };
  }

  const lines: string[] = [
    `Venue:       ${data.venue ?? actor}`,
    `Book:        ${book}`,
    `Spread:      ${data.spreadBps != null ? `${data.spreadBps} bps` : "n/a"}`,
    `Top bid:     price=${data.topBid?.price ?? "n/a"}, amount=${data.topBid?.amount ?? "n/a"}`,
    `Top ask:     price=${data.topAsk?.price ?? "n/a"}, amount=${data.topAsk?.amount ?? "n/a"}`,
    `Bid depth:   ${data.bidDepthBase ?? "n/a"} (${data.bidCount ?? 0} levels)`,
    `Ask depth:   ${data.askDepthBase ?? "n/a"} (${data.askCount ?? 0} levels)`,
    `Fetched at:  ${data.fetchedAt ?? "n/a"}`,
  ];

  return {
    content: [
      {
        type: "text" as const,
        text: `Partner depth ${actor}/${book}:\n\n${lines.join("\n")}`,
      },
    ],
  };
}
