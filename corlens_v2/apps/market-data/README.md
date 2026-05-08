# @corlens/market-data

The single owner of XRPL connections in v2. Exposes typed REST routes for every XRPL on-ledger read, plus partner exchange depth (Bitso, Bitstamp, Kraken, Binance, XRPL DEX). Redis cache with per-data-type TTLs.

## Endpoints (all behind Caddy at `/api/market-data/*`)

### XRPL
- `GET /xrpl/account/:address`
- `GET /xrpl/account/:address/lines`
- `GET /xrpl/account/:address/objects`
- `GET /xrpl/account/:address/transactions`
- `GET /xrpl/account/:address/nfts`
- `GET /xrpl/account/:address/channels`
- `GET /xrpl/account/:address/offers`
- `GET /xrpl/account/:address/currencies`
- `GET /xrpl/account/:address/noripple`
- `GET /xrpl/amm/by-pair?asset1=...&asset2=...`
- `GET /xrpl/amm/by-account/:account`
- `GET /xrpl/book?takerGets=...&takerPays=...`
- `GET /xrpl/nft/:nftId/buy-offers`
- `GET /xrpl/nft/:nftId/sell-offers`
- `POST /xrpl/path-find` — SSE stream

### Partner depth
- `GET /partner-depth/:actor/:book` — actor ∈ {bitso, bitstamp, kraken, binance, xrpl-dex}

### Admin / observability
- `GET /health`
- `GET /docs`
- `POST /admin/refresh-corridors` — stub until corridor service ships in step 6

## Dev

```bash
pnpm --filter @corlens/market-data dev
```

Listens on port 3002 by default.
