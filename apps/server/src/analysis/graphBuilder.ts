import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphStats,
  NodeKind,
  IssuerNodeData,
  TokenNodeData,
  AMMPoolNodeData,
  OrderBookNodeData,
  AccountNodeData,
  RiskFlagData,
  XRPLAsset,
} from "@xrplens/core";
import type { CrawlResult } from "./crawler.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const RLUSD_HEX = "524C555344000000000000000000000000000000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function hexToAscii(hex: string): string {
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code > 0) result += String.fromCharCode(code);
  }
  return result.trim();
}

export function decodeCurrency(hex: string): string {
  if (!hex || hex.length <= 3) return hex;
  if (hex.toUpperCase() === RLUSD_HEX.toUpperCase()) return "RLUSD";
  const ascii = hexToAscii(hex);
  // If it decoded to printable ASCII, return that; otherwise return original hex
  if (/^[\x20-\x7E]+$/.test(ascii)) return ascii;
  return hex;
}

export function xrpDropsToString(drops: string | number): string {
  return String(Number(drops) / 1_000_000);
}

// ─── Node builders ───────────────────────────────────────────────────────────

function makeNode(
  id: string,
  kind: NodeKind,
  label: string,
  data: GraphNode["data"],
  riskFlags: RiskFlagData[] = [],
): GraphNode {
  return { id, kind, label, data, riskFlags };
}

function makeEdge(
  source: string,
  target: string,
  kind: GraphEdge["kind"],
  label?: string,
  data?: Record<string, unknown>,
): GraphEdge {
  return {
    id: `${source}--${kind}--${target}`,
    source,
    target,
    kind,
    label,
    data,
  };
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export function buildGraph(
  crawl: CrawlResult,
  seedAddress: string,
  seedLabel?: string,
): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIndex = new Set<string>();

  function addNode(node: GraphNode) {
    if (!nodeIndex.has(node.id)) {
      nodeIndex.add(node.id);
      nodes.push(node);
    }
  }

  // ── 1. Issuer node ────────────────────────────────────────────────────────
  const issuerId = `issuer:${seedAddress}`;
  const issuerData = crawl.issuerInfo ?? {};

  const domain = issuerData.Domain ? hexToAscii(issuerData.Domain) : undefined;

  const obligations = crawl.gatewayBalances?.obligations ?? {};
  const tokenNames = Object.keys(obligations).map((c) => decodeCurrency(c));

  const DISABLE_MASTER = 0x00100000;
  const issuerFlagsVal = issuerData.Flags ?? 0;
  const masterDisabled = (issuerFlagsVal & DISABLE_MASTER) !== 0;
  const hasRegularKey = !!issuerData.RegularKey;
  const hasSignerList =
    crawl.accountObjects.some((o: any) => o.LedgerEntryType === "SignerList") ||
    (issuerData.signer_lists ?? []).length > 0;
  const isBlackholed = masterDisabled && !hasRegularKey && !hasSignerList;

  const issuerNodeData: IssuerNodeData = {
    address: seedAddress,
    domain,
    emailHash: issuerData.EmailHash,
    messageKey: issuerData.MessageKey,
    flags: issuerData.Flags,
    tokens: tokenNames,
    totalObligations: obligations,
    balance: issuerData.Balance ? xrpDropsToString(issuerData.Balance) : undefined,
    transferRate: issuerData.TransferRate,
    regularKey: issuerData.RegularKey,
    ownerCount: issuerData.OwnerCount,
    sequence: issuerData.Sequence,
    isBlackholed,
  };

  addNode(
    makeNode(
      issuerId,
      "issuer",
      seedLabel ?? domain ?? seedAddress.slice(0, 8),
      issuerNodeData,
    ),
  );

  // ── 2. Token nodes ────────────────────────────────────────────────────────
  for (const [currHex, totalSupply] of Object.entries(obligations)) {
    const currName = decodeCurrency(currHex);
    const tokenId = `token:${currName}:${seedAddress}`;

    const tokenNodeData: TokenNodeData = {
      currency: currName,
      currencyHex: currHex !== currName ? currHex : undefined,
      issuer: seedAddress,
      totalSupply: String(totalSupply),
      trustLineCount: crawl.trustLines.length,
      domain,
    };

    addNode(makeNode(tokenId, "token", currName, tokenNodeData));

    // ISSUED_BY: token → issuer
    edges.push(makeEdge(tokenId, issuerId, "ISSUED_BY", "issued by"));
  }

  // ── 3. AMM Pool node ──────────────────────────────────────────────────────
  let ammPoolId: string | null = null;
  if (crawl.ammPool?.account) {
    ammPoolId = `ammPool:${crawl.ammPool.account}`;
    const pool = crawl.ammPool;

    // Parse reserves
    let reserve1 = "0";
    let reserve2 = "0";
    let asset1: XRPLAsset = { currency: "XRP" };
    let asset2: XRPLAsset = { currency: "RLUSD", issuer: seedAddress };

    if (pool.amount) {
      if (typeof pool.amount === "string") {
        reserve1 = xrpDropsToString(pool.amount);
        asset1 = { currency: "XRP" };
      } else if (pool.amount?.currency) {
        reserve1 = String(pool.amount.value ?? "0");
        asset1 = { currency: decodeCurrency(pool.amount.currency), issuer: pool.amount.issuer };
      }
    }
    if (pool.amount2) {
      if (typeof pool.amount2 === "string") {
        reserve2 = xrpDropsToString(pool.amount2);
        asset2 = { currency: "XRP" };
      } else if (pool.amount2?.currency) {
        reserve2 = String(pool.amount2.value ?? "0");
        asset2 = { currency: decodeCurrency(pool.amount2.currency), issuer: pool.amount2.issuer };
      }
    }

    const lpTokenBalance = String(pool.lp_token?.value ?? "0");
    const tradingFee = pool.trading_fee ?? 0;
    const tvlEstimate = Number(reserve1) * 2 + Number(reserve2) * 1;

    // Parse auction slot
    const rawAuction = pool.auction_slot;
    const auctionSlot = rawAuction
      ? {
          account: rawAuction.account ?? "",
          discountedFee: rawAuction.discounted_fee ?? 0,
          expiration: rawAuction.expiration,
          price: rawAuction.price?.value,
          timeInterval: rawAuction.time_interval,
          authAccounts: (rawAuction.auth_accounts ?? []).map(
            (a: any) => a.AuthAccount?.Account ?? a.account ?? "",
          ),
        }
      : undefined;

    const ammNodeData: AMMPoolNodeData = {
      account: pool.account,
      asset1,
      asset2,
      reserve1,
      reserve2,
      lpTokenBalance,
      tradingFee,
      tvlUsd: tvlEstimate,
      lpHolderCount: crawl.lpHolders.length,
      asset2Frozen: pool.asset2_frozen,
      auctionSlot,
      voteSlots: (pool.vote_slots ?? []).map((vs: any) => ({
        account: vs.VoteEntry?.Account ?? vs.account ?? "",
        tradingFee: vs.VoteEntry?.TradingFee ?? vs.trading_fee ?? 0,
        voteWeight: vs.VoteEntry?.VoteWeight ?? vs.vote_weight ?? 0,
      })),
    };

    addNode(makeNode(ammPoolId, "ammPool", `AMM Pool ${pool.account.slice(0, 8)}`, ammNodeData));

    // POOLS_WITH: ammPool → token (for each token in the pool)
    for (const [currHex] of Object.entries(obligations)) {
      const currName = decodeCurrency(currHex);
      const tokenId = `token:${currName}:${seedAddress}`;
      if (nodeIndex.has(tokenId)) {
        edges.push(makeEdge(ammPoolId, tokenId, "POOLS_WITH", "pools with"));
      }
    }
  }

  // ── 4. Account nodes from trust line holders (cap 50) ────────────────────
  const topTrustLineHolders = [...crawl.trustLines]
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)))
    .slice(0, 50);

  for (const line of topTrustLineHolders) {
    if (!line.account) continue;
    const accountId = `account:${line.account}`;
    const enriched = crawl.topAccounts.get(line.account);

    const accountDomain = enriched?.Domain ? hexToAscii(enriched.Domain) : undefined;
    const accountNodeData: AccountNodeData = {
      address: line.account,
      balance: enriched?.Balance,
      domain: accountDomain,
      messageKey: enriched?.MessageKey,
      flags: enriched?.Flags,
      ownerCount: enriched?.OwnerCount,
      sequence: enriched?.Sequence,
      regularKey: enriched?.RegularKey,
    };

    addNode(
      makeNode(accountId, "account", accountDomain ?? line.account.slice(0, 8), accountNodeData),
    );

    // TRUSTS: account → token
    const currName = decodeCurrency(line.currency ?? "");
    const tokenId = `token:${currName}:${seedAddress}`;
    if (nodeIndex.has(tokenId)) {
      edges.push(
        makeEdge(accountId, tokenId, "TRUSTS", "trusts", {
          balance: line.balance,
          limit: line.limit,
          limitPeer: line.limit_peer,
          freeze: line.freeze,
          freezePeer: line.freeze_peer,
          authorized: line.authorized,
          peerAuthorized: line.peer_authorized,
          qualityIn: line.quality_in,
          qualityOut: line.quality_out,
          noRipple: line.no_ripple,
          noRipplePeer: line.no_ripple_peer,
        }),
      );
    }
  }

  // ── 4b. Account nodes from LP holders (cap 30) ────────────────────────────
  const topLpHolders = [...crawl.lpHolders]
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)))
    .slice(0, 30);

  for (const holder of topLpHolders) {
    if (!holder.account) continue;
    const accountId = `account:${holder.account}`;

    if (!nodeIndex.has(accountId)) {
      const enriched = crawl.topAccounts.get(holder.account);
      const accountDomain = enriched?.Domain ? hexToAscii(enriched.Domain) : undefined;
      const accountNodeData: AccountNodeData = {
        address: holder.account,
        balance: enriched?.Balance,
        domain: accountDomain,
        messageKey: enriched?.MessageKey,
        flags: enriched?.Flags,
        ownerCount: enriched?.OwnerCount,
        sequence: enriched?.Sequence,
        regularKey: enriched?.RegularKey,
      };

      addNode(
        makeNode(
          accountId,
          "account",
          accountDomain ?? holder.account.slice(0, 8),
          accountNodeData,
        ),
      );
    }

    // PROVIDES_LIQUIDITY: account → ammPool
    if (ammPoolId) {
      edges.push(
        makeEdge(accountId, ammPoolId, "PROVIDES_LIQUIDITY", "provides liquidity", {
          balance: holder.balance,
        }),
      );
    }
  }

  // ── 5. Order Book node ────────────────────────────────────────────────────
  if (crawl.asks.length > 0 || crawl.bids.length > 0) {
    const tokenCurrKeys = Object.keys(obligations);
    const primaryToken = tokenCurrKeys.length > 0 ? decodeCurrency(tokenCurrKeys[0]) : "TOKEN";
    const orderBookId = `orderBook:XRP/${primaryToken}`;

    // Compute spread from best ask and bid
    let spread: number | undefined;
    if (crawl.asks.length > 0 && crawl.bids.length > 0) {
      const bestAsk = crawl.asks[0];
      const bestBid = crawl.bids[0];
      const askPrice = bestAsk?.quality ? Number(bestAsk.quality) : null;
      const bidPrice = bestBid?.quality ? Number(bestBid.quality) : null;

      if (askPrice !== null && bidPrice !== null && askPrice > 0 && bidPrice > 0) {
        const mid = (askPrice + bidPrice) / 2;
        spread = mid > 0 ? Math.abs(askPrice - bidPrice) / mid : undefined;
      }
    }

    // Compute total depths
    const askDepth = crawl.asks
      .reduce((sum: number, o: any) => {
        const xrpDrops = typeof o.TakerGets === "string" ? Number(o.TakerGets) : 0;
        return sum + xrpDrops / 1_000_000;
      }, 0)
      .toFixed(6);

    const bidDepth = crawl.bids
      .reduce((sum: number, o: any) => {
        const tokenVal =
          typeof o.TakerGets === "object" ? Number(o.TakerGets?.value ?? 0) : 0;
        return sum + tokenVal;
      }, 0)
      .toFixed(6);

    const orderBookNodeData: OrderBookNodeData = {
      takerGets: { currency: "XRP" },
      takerPays: { currency: primaryToken, issuer: seedAddress },
      spread,
      askDepth,
      bidDepth,
      offerCount: crawl.asks.length + crawl.bids.length,
    };

    addNode(makeNode(orderBookId, "orderBook", `XRP/${primaryToken} Order Book`, orderBookNodeData));

    // TRADES_ON: orderBook → token
    for (const [currHex] of Object.entries(obligations)) {
      const currName = decodeCurrency(currHex);
      const tokenId = `token:${currName}:${seedAddress}`;
      if (nodeIndex.has(tokenId)) {
        edges.push(makeEdge(orderBookId, tokenId, "TRADES_ON", "trades on"));
      }
    }
  }

  // ── Build stats (single pass) ────────────────────────────────────────────
  const nodesByKind: Record<NodeKind, number> = {
    token: 0, issuer: 0, ammPool: 0, orderBook: 0,
    account: 0, paymentPath: 0,
  };
  let totalRiskFlags = 0, highRiskCount = 0, medRiskCount = 0, lowRiskCount = 0;

  for (const node of nodes) {
    nodesByKind[node.kind]++;
    for (const flag of node.riskFlags) {
      totalRiskFlags++;
      if (flag.severity === "HIGH") highRiskCount++;
      else if (flag.severity === "MED") medRiskCount++;
      else lowRiskCount++;
    }
  }

  const stats: GraphStats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalRiskFlags,
    highRiskCount,
    medRiskCount,
    lowRiskCount,
    nodesByKind,
  };

  return { nodes, edges, stats };
}
