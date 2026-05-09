import { XrplAddress, marketData as md } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { XrplService } from "../services/xrpl.service.js";

const RawResponse = z.object({}).passthrough();
type Raw = z.infer<typeof RawResponse>;

export async function registerXrplRoutes(app: FastifyInstance, svc: XrplService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/xrpl/account/:address",
    {
      schema: { params: md.AddressParam, response: { 200: RawResponse }, tags: ["xrpl"] },
    },
    async (req) => svc.accountInfo(req.params.address) as Promise<Raw>,
  );

  typed.get(
    "/xrpl/account/:address/lines",
    {
      schema: {
        params: md.AddressParam,
        querystring: md.LimitQuery,
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.accountLines(req.params.address, req.query.limit) as Promise<unknown[]>,
  );

  typed.get(
    "/xrpl/account/:address/objects",
    {
      schema: {
        params: md.AddressParam,
        querystring: md.LimitQuery,
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.accountObjects(req.params.address, req.query.limit) as Promise<unknown[]>,
  );

  typed.get(
    "/xrpl/account/:address/transactions",
    {
      schema: {
        params: md.AddressParam,
        querystring: md.SinceQuery,
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) =>
      svc.accountTx(req.params.address, req.query.limit, req.query.sinceUnixTime) as Promise<
        unknown[]
      >,
  );

  typed.get(
    "/xrpl/account/:address/nfts",
    {
      schema: {
        params: md.AddressParam,
        querystring: md.LimitQuery,
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.accountNfts(req.params.address, req.query.limit) as Promise<unknown[]>,
  );

  typed.get(
    "/xrpl/account/:address/channels",
    {
      schema: {
        params: md.AddressParam,
        querystring: md.LimitQuery,
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.accountChannels(req.params.address, req.query.limit) as Promise<unknown[]>,
  );

  typed.get(
    "/xrpl/account/:address/offers",
    {
      schema: {
        params: md.AddressParam,
        querystring: md.LimitQuery,
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.accountOffers(req.params.address, req.query.limit) as Promise<unknown[]>,
  );

  typed.get(
    "/xrpl/account/:address/currencies",
    {
      schema: { params: md.AddressParam, response: { 200: RawResponse }, tags: ["xrpl"] },
    },
    async (req) => svc.accountCurrencies(req.params.address) as Promise<Raw>,
  );

  typed.get(
    "/xrpl/account/:address/gateway-balances",
    {
      schema: { params: md.AddressParam, response: { 200: RawResponse }, tags: ["xrpl"] },
    },
    async (req) => svc.gatewayBalances(req.params.address) as Promise<Raw>,
  );

  typed.get(
    "/xrpl/account/:address/noripple",
    {
      schema: {
        params: md.AddressParam,
        querystring: md.NoripppleQuery,
        response: { 200: RawResponse },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.noripple(req.params.address, req.query.role) as Promise<Raw>,
  );

  typed.get(
    "/xrpl/book",
    {
      schema: { querystring: md.BookOffersQuery, response: { 200: RawResponse }, tags: ["xrpl"] },
    },
    async (req) =>
      svc.bookOffers(
        req.query.takerGetsCurrency,
        req.query.takerGetsIssuer,
        req.query.takerPaysCurrency,
        req.query.takerPaysIssuer,
        req.query.limit,
      ) as Promise<Raw>,
  );

  typed.get(
    "/xrpl/amm/by-pair",
    {
      schema: { querystring: md.AmmByPairQuery, response: { 200: RawResponse }, tags: ["xrpl"] },
    },
    async (req) =>
      svc.ammByPair(
        req.query.asset1Currency,
        req.query.asset1Issuer,
        req.query.asset2Currency,
        req.query.asset2Issuer,
      ) as Promise<Raw>,
  );

  typed.get(
    "/xrpl/amm/by-account/:account",
    {
      schema: {
        params: z.object({ account: XrplAddress }),
        response: { 200: RawResponse },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.ammByAccount(req.params.account) as Promise<Raw>,
  );

  typed.get(
    "/xrpl/nft/:nftId/buy-offers",
    {
      schema: {
        params: md.NftIdParam,
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(400).default(50) }),
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.nftBuyOffers(req.params.nftId, req.query.limit) as Promise<unknown[]>,
  );

  typed.get(
    "/xrpl/nft/:nftId/sell-offers",
    {
      schema: {
        params: md.NftIdParam,
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(400).default(50) }),
        response: { 200: z.array(z.unknown()) },
        tags: ["xrpl"],
      },
    },
    async (req) => svc.nftSellOffers(req.params.nftId, req.query.limit) as Promise<unknown[]>,
  );

  typed.post(
    "/xrpl/path-find",
    {
      schema: { body: md.PathFindRequest, response: { 200: RawResponse }, tags: ["xrpl"] },
    },
    async (req) =>
      svc.pathFind(
        req.body.sourceAccount,
        req.body.destinationAccount,
        req.body.destinationAmount,
      ) as Promise<Raw>,
  );
}
