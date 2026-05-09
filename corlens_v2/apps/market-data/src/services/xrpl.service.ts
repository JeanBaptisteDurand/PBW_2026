import type { XrplClient } from "../connectors/xrpl-client.js";
import * as fetchers from "../connectors/xrpl-fetchers.js";
import type { CacheService } from "./cache.service.js";

export type XrplServiceOptions = {
  client: XrplClient;
  cache: CacheService;
  ttl: { account: number; book: number; amm: number; tx: number; nft: number };
};

export type XrplService = ReturnType<typeof createXrplService>;

export function createXrplService(opts: XrplServiceOptions) {
  const { client, cache, ttl } = opts;
  return {
    accountInfo: (address: string) =>
      cache.getOrSet(`acc:info:${address}`, ttl.account, () =>
        fetchers.fetchAccountInfo(client, address),
      ),
    accountLines: (address: string, limit?: number) =>
      cache.getOrSet(`acc:lines:${address}:${limit ?? "all"}`, ttl.account, () =>
        fetchers.fetchTrustLines(client, address, limit),
      ),
    accountObjects: (address: string, limit?: number) =>
      cache.getOrSet(`acc:objs:${address}:${limit ?? "all"}`, ttl.account, () =>
        fetchers.fetchAccountObjects(client, address, limit),
      ),
    accountTx: (address: string, limit?: number, sinceUnixTime?: number) =>
      cache.getOrSet(`acc:tx:${address}:${limit ?? 100}:${sinceUnixTime ?? 0}`, ttl.tx, () =>
        fetchers.fetchAccountTransactions(client, address, { limit, sinceUnixTime }),
      ),
    accountNfts: (address: string, limit?: number) =>
      cache.getOrSet(`acc:nfts:${address}:${limit ?? "all"}`, ttl.nft, () =>
        fetchers.fetchAccountNFTs(client, address, limit),
      ),
    accountChannels: (address: string, limit?: number) =>
      cache.getOrSet(`acc:chs:${address}:${limit ?? "all"}`, ttl.account, () =>
        fetchers.fetchAccountChannels(client, address, limit),
      ),
    accountOffers: (address: string, limit?: number) =>
      cache.getOrSet(`acc:offs:${address}:${limit ?? "all"}`, ttl.account, () =>
        fetchers.fetchAccountOffers(client, address, limit),
      ),
    accountCurrencies: (address: string) =>
      cache.getOrSet(`acc:ccy:${address}`, ttl.account, () =>
        fetchers.fetchAccountCurrencies(client, address),
      ),
    gatewayBalances: (address: string) =>
      cache.getOrSet(`acc:gw:${address}`, ttl.account, () =>
        fetchers.fetchGatewayBalances(client, address),
      ),
    noripple: (address: string, role: "gateway" | "user") =>
      cache.getOrSet(`acc:nr:${address}:${role}`, ttl.account, () =>
        fetchers.fetchNoripppleCheck(client, address, role),
      ),
    bookOffers: (
      takerGetsCurrency: string,
      takerGetsIssuer: string | undefined,
      takerPaysCurrency: string,
      takerPaysIssuer: string | undefined,
      limit: number,
    ) => {
      const key = `book:${takerGetsCurrency}|${takerGetsIssuer ?? ""}->${takerPaysCurrency}|${takerPaysIssuer ?? ""}:${limit}`;
      return cache.getOrSet(key, ttl.book, () =>
        fetchers.fetchBookOffers(
          client,
          { currency: takerGetsCurrency, issuer: takerGetsIssuer },
          { currency: takerPaysCurrency, issuer: takerPaysIssuer },
          limit,
        ),
      );
    },
    ammByPair: (
      asset1Currency: string,
      asset1Issuer: string | undefined,
      asset2Currency: string,
      asset2Issuer: string | undefined,
    ) => {
      const key = `amm:pair:${asset1Currency}|${asset1Issuer ?? ""}|${asset2Currency}|${asset2Issuer ?? ""}`;
      return cache.getOrSet(key, ttl.amm, () =>
        fetchers.fetchAMMInfoByPair(
          client,
          { currency: asset1Currency, issuer: asset1Issuer },
          { currency: asset2Currency, issuer: asset2Issuer },
        ),
      );
    },
    ammByAccount: (account: string) =>
      cache.getOrSet(`amm:acc:${account}`, ttl.amm, () =>
        fetchers.fetchAMMInfoByAccount(client, account),
      ),
    nftBuyOffers: (nftId: string, limit: number) =>
      cache.getOrSet(`nft:buy:${nftId}:${limit}`, ttl.nft, () =>
        fetchers.fetchNFTBuyOffers(client, nftId, limit),
      ),
    nftSellOffers: (nftId: string, limit: number) =>
      cache.getOrSet(`nft:sell:${nftId}:${limit}`, ttl.nft, () =>
        fetchers.fetchNFTSellOffers(client, nftId, limit),
      ),
    pathFind: (sourceAccount: string, destinationAccount: string, destinationAmount: unknown) =>
      fetchers.fetchPaymentPaths(client, sourceAccount, destinationAccount, destinationAmount),
  };
}
