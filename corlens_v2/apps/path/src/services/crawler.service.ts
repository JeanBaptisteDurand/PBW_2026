import type { MarketDataClient } from "../connectors/market-data.js";
import type { CrawlResult } from "../domain/types.js";

export type CrawlerServiceOptions = {
  marketData: MarketDataClient;
};

export type CrawlerService = ReturnType<typeof createCrawlerService>;

const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const RLUSD_HEX = "524C555344000000000000000000000000000000";

export function createCrawlerService(opts: CrawlerServiceOptions) {
  return {
    async crawl(seedAddress: string, seedLabel: string | null): Promise<CrawlResult> {
      const md = opts.marketData;
      const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await fn();
        } catch {
          return fallback;
        }
      };

      // 1. account_info — issuerInfo (also reveals AMMID for AMM accounts)
      const accountInfoResp = await safe(
        () =>
          md.accountInfo(seedAddress) as Promise<{
            result?: { account_data?: Record<string, unknown> };
          }>,
        { result: { account_data: {} } },
      );
      const issuerInfo = accountInfoResp.result?.account_data ?? {};

      // 2. trust_lines (limit 2000)
      const trustLinesResp = await safe(
        () => md.trustLines(seedAddress, { limit: 2000 }) as Promise<{ lines?: unknown[] }>,
        { lines: [] },
      );
      const trustLines = (trustLinesResp.lines ?? []) as Array<Record<string, unknown>>;

      // 3. gateway_balances → obligations + isIssuer + primary currency
      const gatewayResp = await safe(
        () =>
          md.gatewayBalances(seedAddress) as Promise<{
            result?: { obligations?: Record<string, string> };
          }>,
        { result: { obligations: {} } },
      );
      const gatewayBalances = gatewayResp.result ?? { obligations: {} };
      const obligations = gatewayBalances.obligations ?? {};
      const isIssuer = Object.keys(obligations).length > 0;
      const primaryCurrency = isIssuer ? (Object.keys(obligations)[0] ?? null) : null;
      const tokenCurrency = primaryCurrency ?? RLUSD_HEX;

      // 4. AMM pool — direct account first (if AMMID present), else by-pair XRP/primary
      const isAmmAccount = !!(issuerInfo as { AMMID?: unknown }).AMMID;
      const ammResp = isAmmAccount
        ? await safe(
            () => md.ammByAccount(seedAddress) as Promise<{ result?: { amm?: unknown } }>,
            { result: { amm: null } },
          )
        : await safe(
            () =>
              md.ammByPair({
                asset1Currency: "XRP",
                asset2Currency: tokenCurrency,
                asset2Issuer: seedAddress,
              }) as Promise<{ result?: { amm?: unknown } }>,
            { result: { amm: null } },
          );
      const ammPool = (ammResp.result?.amm ?? null) as Record<string, unknown> | null;

      // 5. LP holders — trust_lines on the pool account
      let lpHolders: Array<Record<string, unknown>> = [];
      const ammAccount = (ammPool?.account ?? null) as string | null;
      if (ammAccount) {
        const lpResp = await safe(
          () =>
            md.trustLines(ammAccount, { limit: 500 }) as Promise<{ lines?: unknown[] }>,
          { lines: [] },
        );
        lpHolders = (lpResp.lines ?? []) as Array<Record<string, unknown>>;
      }

      // 6. order book asks (XRP -> primary) and 7. bids (primary -> XRP)
      const asksResp = await safe(
        () =>
          md.bookOffers({
            takerGetsCurrency: "XRP",
            takerPaysCurrency: tokenCurrency,
            takerPaysIssuer: seedAddress,
            limit: 50,
          }) as Promise<{ result?: { offers?: unknown[] } }>,
        { result: { offers: [] } },
      );
      const asks = (asksResp.result?.offers ?? []) as Array<Record<string, unknown>>;

      const bidsResp = await safe(
        () =>
          md.bookOffers({
            takerGetsCurrency: tokenCurrency,
            takerGetsIssuer: seedAddress,
            takerPaysCurrency: "XRP",
            limit: 50,
          }) as Promise<{ result?: { offers?: unknown[] } }>,
        { result: { offers: [] } },
      );
      const bids = (bidsResp.result?.offers ?? []) as Array<Record<string, unknown>>;

      // 8. payment paths (sanity probe: seed -> RLUSD issuer)
      const pathsResp = await safe(
        () =>
          md.pathFind({
            sourceAccount: seedAddress,
            destinationAccount: RLUSD_ISSUER,
            destinationAmount: { currency: tokenCurrency, issuer: seedAddress, value: "1" },
          }) as Promise<{ result?: { alternatives?: unknown[] } }>,
        { result: { alternatives: [] } },
      );
      const paths = (pathsResp.result?.alternatives ?? []) as Array<Record<string, unknown>>;

      // 9. account_objects (limit 1000)
      const objectsResp = await safe(
        () =>
          md.accountObjects(seedAddress) as Promise<{
            result?: { account_objects?: unknown[] };
          }>,
        { result: { account_objects: [] } },
      );
      const accountObjects = (objectsResp.result?.account_objects ?? []) as Array<
        Record<string, unknown>
      >;

      // 10. account_nfts
      const nftsResp = await safe(
        () =>
          md.accountNfts(seedAddress) as Promise<{ result?: { account_nfts?: unknown[] } }>,
        { result: { account_nfts: [] } },
      );
      const nfts = (nftsResp.result?.account_nfts ?? []) as Array<Record<string, unknown>>;

      // 11. account_channels (limit 500)
      const channelsResp = await safe(
        () =>
          md.accountChannels(seedAddress) as Promise<{ result?: { channels?: unknown[] } }>,
        { result: { channels: [] } },
      );
      const channels = (channelsResp.result?.channels ?? []) as Array<Record<string, unknown>>;

      // 12. account_transactions (limit 200) + classify
      const txsResp = await safe(
        () =>
          md.accountTransactions(seedAddress, { limit: 200 }) as Promise<{
            result?: { transactions?: unknown[] };
          }>,
        { result: { transactions: [] } },
      );
      const accountTransactions = (txsResp.result?.transactions ?? []) as Array<
        Record<string, unknown>
      >;

      // Classify into v1-shape array `Array<{ type, count, lastSeen? }>`
      const txCounts = new Map<string, { count: number; lastSeen?: string }>();
      for (const tx of accountTransactions) {
        const txJson = tx.tx_json as { TransactionType?: string; date?: number } | undefined;
        const txInner = tx.tx as { TransactionType?: string; date?: number } | undefined;
        const txType =
          txJson?.TransactionType ??
          txInner?.TransactionType ??
          (tx.TransactionType as string | undefined) ??
          "Unknown";
        const entry = txCounts.get(txType) ?? { count: 0 };
        entry.count++;
        const date = txJson?.date ?? txInner?.date ?? tx.close_time_iso;
        if (date) entry.lastSeen = String(date);
        txCounts.set(txType, entry);
      }
      const txTypeSummary = Array.from(txCounts.entries())
        .map(([type, { count, lastSeen }]) => ({ type, count, lastSeen }))
        .sort((a, b) => b.count - a.count);

      // 13. account_offers (limit 200)
      const offersResp = await safe(
        () => md.accountOffers(seedAddress) as Promise<{ result?: { offers?: unknown[] } }>,
        { result: { offers: [] } },
      );
      const accountOffers = (offersResp.result?.offers ?? []) as Array<Record<string, unknown>>;

      // 14. account_currencies (send + receive)
      const currenciesResp = await safe(
        () =>
          md.accountCurrencies(seedAddress) as Promise<{
            result?: { send_currencies?: string[]; receive_currencies?: string[] };
          }>,
        { result: { send_currencies: [], receive_currencies: [] } },
      );
      const currencies = currenciesResp.result ?? {
        send_currencies: [],
        receive_currencies: [],
      };

      // 15. Enrich top 20 accounts (top 10 LP holders + top 10 trustline holders)
      const sortedLp = [...lpHolders]
        .sort(
          (a, b) =>
            Math.abs(Number((b as { balance?: string }).balance ?? 0)) -
            Math.abs(Number((a as { balance?: string }).balance ?? 0)),
        )
        .slice(0, 10);
      const sortedTrustlines = [...trustLines]
        .sort(
          (a, b) =>
            Math.abs(Number((b as { balance?: string }).balance ?? 0)) -
            Math.abs(Number((a as { balance?: string }).balance ?? 0)),
        )
        .slice(0, 10);
      const topAddresses = new Set<string>();
      for (const h of [...sortedLp, ...sortedTrustlines]) {
        const acc = (h as { account?: string }).account;
        if (acc) topAddresses.add(acc);
      }
      const topAccounts = new Map<string, Record<string, unknown>>();
      await Promise.all(
        Array.from(topAddresses).map(async (address) => {
          const r = await safe(
            () =>
              md.accountInfo(address) as Promise<{
                result?: { account_data?: Record<string, unknown> };
              }>,
            { result: { account_data: undefined } },
          );
          const data = r.result?.account_data;
          if (data) topAccounts.set(address, data);
        }),
      );

      // 16. noripple_check (only for issuers)
      let noripppleProblems: string[] = [];
      if (isIssuer) {
        const norippleResp = await safe(
          () => md.noripple(seedAddress) as Promise<{ result?: { problems?: string[] } }>,
          { result: { problems: [] } },
        );
        noripppleProblems = norippleResp.result?.problems ?? [];
      }

      // 17. NFT buy/sell offers (top 5 NFTs)
      const nftOffers: Array<Record<string, unknown>> = [];
      for (const nft of nfts.slice(0, 5)) {
        const nftId =
          ((nft as { NFTokenID?: string }).NFTokenID ??
            (nft as { nft_id?: string }).nft_id) ?? null;
        if (!nftId) continue;
        const buyResp = await safe(
          () =>
            md.nftBuyOffers(nftId) as Promise<{ result?: { offers?: unknown[] } }>,
          { result: { offers: [] } },
        );
        const sellResp = await safe(
          () =>
            md.nftSellOffers(nftId) as Promise<{ result?: { offers?: unknown[] } }>,
          { result: { offers: [] } },
        );
        for (const o of (buyResp.result?.offers ?? []) as Array<Record<string, unknown>>) {
          nftOffers.push({ ...o, nftId, isSellOffer: false });
        }
        for (const o of (sellResp.result?.offers ?? []) as Array<Record<string, unknown>>) {
          nftOffers.push({ ...o, nftId, isSellOffer: true });
        }
      }

      return {
        seedAddress,
        seedLabel,
        primaryCurrency,
        isIssuer,
        issuerInfo,
        trustLines,
        gatewayBalances,
        ammPool,
        lpHolders,
        asks,
        bids,
        paths,
        accountObjects,
        currencies,
        topAccounts,
        accountTransactions,
        nfts,
        channels,
        txTypeSummary,
        accountOffers,
        noripppleProblems,
        nftOffers,
      };
    },
  };
}
