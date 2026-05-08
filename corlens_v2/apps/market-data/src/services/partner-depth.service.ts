import type { PartnerActor, PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";
import type { CacheService } from "./cache.service.js";
import type { XrplClient } from "../connectors/xrpl-client.js";
import { fetchBitsoDepth } from "../connectors/partner-bitso.js";
import { fetchBitstampDepth } from "../connectors/partner-bitstamp.js";
import { fetchKrakenDepth } from "../connectors/partner-kraken.js";
import { fetchBinanceDepth } from "../connectors/partner-binance.js";
import { fetchXrplDexDepth } from "../connectors/partner-xrpl-dex.js";

export type PartnerDepthServiceOptions = {
  cache: CacheService;
  xrpl: XrplClient;
  ttlSeconds: number;
};

export type PartnerDepthService = ReturnType<typeof createPartnerDepthService>;

export function createPartnerDepthService(opts: PartnerDepthServiceOptions) {
  return {
    async fetch(actor: PartnerActor, book: string): Promise<PartnerDepthSnapshot> {
      const key = `partner:${actor}:${book}`;
      return opts.cache.getOrSet(key, opts.ttlSeconds, async () => {
        switch (actor) {
          case "bitso": return fetchBitsoDepth({ book, ttlSeconds: opts.ttlSeconds });
          case "bitstamp": return fetchBitstampDepth({ pair: book, ttlSeconds: opts.ttlSeconds });
          case "kraken": return fetchKrakenDepth({ pair: book, ttlSeconds: opts.ttlSeconds });
          case "binance": return fetchBinanceDepth({ symbol: book, ttlSeconds: opts.ttlSeconds });
          case "xrpl-dex": return fetchXrplDexDepth({ pairKey: book, client: opts.xrpl, ttlSeconds: opts.ttlSeconds });
        }
      });
    },
  };
}
