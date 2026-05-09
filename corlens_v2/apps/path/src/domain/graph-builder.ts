// Pure graph builder — ported from v1 corlens/apps/server/src/analysis/graphBuilder.ts
// No I/O. No logger. No xrpl/openai/prisma imports.

import { decodeCurrency, hexToAscii, xrpDropsToString } from "./helpers.js";
import type {
  AMMPoolNodeData,
  AccountNodeData,
  BridgeNodeData,
  CheckNodeData,
  CrawlResult,
  CredentialNodeData,
  DIDNodeData,
  DepositPreauthNodeData,
  EscrowNodeData,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphStats,
  IssuerNodeData,
  MPTokenNodeData,
  NFTNodeData,
  NFTOfferNodeData,
  NodeKind,
  OfferNodeData,
  OracleNodeData,
  OrderBookNodeData,
  PayChannelNodeData,
  PermissionedDomainNodeData,
  RiskFlagData,
  SignerListNodeData,
  TicketNodeData,
  TokenNodeData,
  VaultNodeData,
  XRPLAsset,
} from "./types.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const RLUSD_HEX = "524C555344000000000000000000000000000000";

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

export function buildGraph(crawl: CrawlResult, seedAddress: string, seedLabel?: string): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIndex = new Set<string>();

  function addNode(node: GraphNode) {
    if (!nodeIndex.has(node.id)) {
      nodeIndex.add(node.id);
      nodes.push(node);
    }
  }

  // Helper to look up topAccounts (supports both Map and array shapes)
  const topAccountsMap = crawl.topAccounts as Map<string, any>;
  const getTopAccount = (address: string): any =>
    typeof topAccountsMap.get === "function" ? topAccountsMap.get(address) : undefined;

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
    makeNode(issuerId, "issuer", seedLabel ?? domain ?? seedAddress.slice(0, 8), issuerNodeData),
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
      // XRP amount is in drops (string number)
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
    const enriched = getTopAccount(line.account);

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
      const enriched = getTopAccount(holder.account);
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
    const primaryToken = tokenCurrKeys.length > 0 ? decodeCurrency(tokenCurrKeys[0]!) : "TOKEN";
    const orderBookId = `orderBook:XRP/${primaryToken}`;

    // Compute spread from best ask and bid
    let spread: number | undefined;
    if (crawl.asks.length > 0 && crawl.bids.length > 0) {
      // asks: XRP → token (want token, give XRP); best ask price = XRP per token
      const bestAsk = crawl.asks[0];
      const bestBid = crawl.bids[0];
      // ask: taker_gets = XRP (drops), taker_pays = token
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
        const tokenVal = typeof o.TakerGets === "object" ? Number(o.TakerGets?.value ?? 0) : 0;
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

    addNode(
      makeNode(orderBookId, "orderBook", `XRP/${primaryToken} Order Book`, orderBookNodeData),
    );

    // TRADES_ON: orderBook → token
    for (const [currHex] of Object.entries(obligations)) {
      const currName = decodeCurrency(currHex);
      const tokenId = `token:${currName}:${seedAddress}`;
      if (nodeIndex.has(tokenId)) {
        edges.push(makeEdge(orderBookId, tokenId, "TRADES_ON", "trades on"));
      }
    }
  }

  // ── 6. Escrow nodes ───────────────────────────────────────────────────────
  const escrowObjects = crawl.accountObjects.filter((o: any) => o.LedgerEntryType === "Escrow");

  for (const escrow of escrowObjects) {
    const escrowId = `escrow:${escrow.index ?? escrow.PreviousTxnID ?? Math.random()}`;

    const escrowNodeData: EscrowNodeData = {
      account: escrow.Account ?? seedAddress,
      destination: escrow.Destination ?? "",
      amount: String(escrow.Amount ?? "0"),
      condition: escrow.Condition,
      cancelAfter: escrow.CancelAfter,
      finishAfter: escrow.FinishAfter,
      destinationTag: escrow.DestinationTag,
      sourceTag: escrow.SourceTag,
    };

    addNode(
      makeNode(
        escrowId,
        "escrow",
        `Escrow → ${(escrow.Destination ?? "").slice(0, 8)}`,
        escrowNodeData,
      ),
    );

    // ESCROWS_TO: issuer → escrow
    edges.push(makeEdge(issuerId, escrowId, "ESCROWS_TO", "escrows to"));
  }

  // ── 7. Check nodes ───────────────────────────────────────────────────────
  const checkObjects = crawl.accountObjects.filter((o: any) => o.LedgerEntryType === "Check");

  for (const check of checkObjects) {
    const checkId = `check:${check.index ?? check.PreviousTxnID ?? Math.random()}`;

    const sendMax = check.SendMax;
    const sendMaxStr =
      typeof sendMax === "string" ? xrpDropsToString(sendMax) : (sendMax?.value ?? "0");
    const currency = typeof sendMax === "object" ? decodeCurrency(sendMax?.currency ?? "") : "XRP";

    const checkNodeData: CheckNodeData = {
      account: check.Account ?? seedAddress,
      destination: check.Destination ?? "",
      sendMax: sendMaxStr,
      currency,
      expiration: check.Expiration,
      invoiceID: check.InvoiceID,
      destinationTag: check.DestinationTag,
      sourceTag: check.SourceTag,
      sequence: check.Sequence,
    };

    addNode(
      makeNode(checkId, "check", `Check → ${(check.Destination ?? "").slice(0, 8)}`, checkNodeData),
    );

    edges.push(makeEdge(issuerId, checkId, "CHECKS_TO", "checks to"));
  }

  // ── 8. Payment Channel nodes (from account_objects) ───────────────────────
  const payChannelObjects = crawl.accountObjects.filter(
    (o: any) => o.LedgerEntryType === "PayChannel",
  );

  for (const ch of payChannelObjects) {
    const chId = `payChannel:${ch.index ?? ch.PreviousTxnID ?? Math.random()}`;

    const payChannelNodeData: PayChannelNodeData = {
      account: ch.Account ?? seedAddress,
      destination: ch.Destination ?? "",
      amount: xrpDropsToString(ch.Amount ?? "0"),
      balance: xrpDropsToString(ch.Balance ?? "0"),
      settleDelay: ch.SettleDelay ?? 0,
      expiration: ch.Expiration,
      cancelAfter: ch.CancelAfter,
      publicKey: ch.PublicKey,
    };

    addNode(
      makeNode(
        chId,
        "payChannel",
        `Channel → ${(ch.Destination ?? "").slice(0, 8)}`,
        payChannelNodeData,
      ),
    );

    edges.push(makeEdge(issuerId, chId, "CHANNELS_TO", "channels to"));
  }

  // ── 8b. Payment Channel nodes (from account_channels API) ────────────────
  for (const ch of crawl.channels ?? []) {
    const chId = `payChannel:${ch.channel_id ?? Math.random()}`;
    if (nodeIndex.has(chId)) continue;

    const payChannelNodeData: PayChannelNodeData = {
      account: ch.account ?? seedAddress,
      destination: ch.destination_account ?? "",
      amount: xrpDropsToString(ch.amount ?? "0"),
      balance: xrpDropsToString(ch.balance ?? "0"),
      settleDelay: ch.settle_delay ?? 0,
      expiration: ch.expiration,
      cancelAfter: ch.cancel_after,
      publicKey: ch.public_key,
    };

    addNode(
      makeNode(
        chId,
        "payChannel",
        `Channel → ${(ch.destination_account ?? "").slice(0, 8)}`,
        payChannelNodeData,
      ),
    );

    edges.push(makeEdge(issuerId, chId, "CHANNELS_TO", "channels to"));
  }

  // ── 9. NFT nodes ─────────────────────────────────────────────────────────
  const nftList = (crawl.nfts ?? []).slice(0, 200); // cap at 200
  for (const nft of nftList) {
    const nftId = `nft:${nft.NFTokenID ?? nft.nft_id ?? Math.random()}`;

    const uri = nft.URI ? hexToAscii(nft.URI) : undefined;

    const nftNodeData: NFTNodeData = {
      nftId: nft.NFTokenID ?? nft.nft_id ?? "",
      issuer: nft.Issuer ?? seedAddress,
      taxon: nft.NFTokenTaxon ?? nft.nft_taxon ?? 0,
      serial: nft.nft_serial,
      uri,
      flags: nft.Flags,
      transferFee: nft.TransferFee,
    };

    addNode(
      makeNode(nftId, "nft", uri?.slice(0, 20) ?? `NFT #${nft.nft_serial ?? ""}`, nftNodeData),
    );

    edges.push(makeEdge(issuerId, nftId, "OWNS_NFT", "owns"));
  }

  // ── 10. SignerList nodes ─────────────────────────────────────────────────
  // Sources: account_objects AND issuerInfo.signer_lists (from account_info with signer_lists:true)
  const signerListObjects = crawl.accountObjects.filter(
    (o: any) => o.LedgerEntryType === "SignerList",
  );

  // Also check signer_lists from account_info (more reliable — always present if exists)
  const signerListsFromInfo = crawl.issuerInfo?.signer_lists ?? [];
  for (const sl of signerListsFromInfo) {
    // Avoid duplicates if also found in account_objects
    if (!signerListObjects.some((o: any) => o.SignerQuorum === sl.SignerQuorum)) {
      signerListObjects.push(sl);
    }
  }

  for (const sl of signerListObjects) {
    const slId = `signerList:${sl.index ?? `info:${seedAddress}`}`;

    const signerListNodeData: SignerListNodeData = {
      signerQuorum: sl.SignerQuorum ?? 0,
      signers: (sl.SignerEntries ?? []).map((e: any) => ({
        account: e.SignerEntry?.Account ?? e.Account ?? "",
        weight: e.SignerEntry?.SignerWeight ?? e.SignerWeight ?? 0,
      })),
    };

    addNode(
      makeNode(
        slId,
        "signerList",
        `SignerList (quorum ${sl.SignerQuorum ?? 0})`,
        signerListNodeData,
      ),
    );

    edges.push(makeEdge(issuerId, slId, "SIGNED_BY", "signed by"));
  }

  // ── 11. DID nodes ────────────────────────────────────────────────────────
  const didObjects = crawl.accountObjects.filter((o: any) => o.LedgerEntryType === "DID");

  for (const did of didObjects) {
    const didId = `did:${did.index ?? Math.random()}`;

    const didNodeData: DIDNodeData = {
      account: did.Account ?? seedAddress,
      didDocument: did.DIDDocument ? hexToAscii(did.DIDDocument) : undefined,
      uri: did.URI ? hexToAscii(did.URI) : undefined,
      data: did.Data ? hexToAscii(did.Data) : undefined,
    };

    addNode(makeNode(didId, "did", `DID ${seedAddress.slice(0, 8)}`, didNodeData));

    edges.push(makeEdge(issuerId, didId, "HAS_DID", "has DID"));
  }

  // ── 12. Credential nodes ─────────────────────────────────────────────────
  const credentialObjects = crawl.accountObjects.filter(
    (o: any) => o.LedgerEntryType === "Credential",
  );

  for (const cred of credentialObjects) {
    const credId = `credential:${cred.index ?? Math.random()}`;

    const credentialNodeData: CredentialNodeData = {
      subject: cred.Subject ?? seedAddress,
      issuer: cred.Issuer ?? "",
      credentialType: cred.CredentialType ? hexToAscii(cred.CredentialType) : "unknown",
      expiration: cred.Expiration,
      uri: cred.URI ? hexToAscii(cred.URI) : undefined,
    };

    addNode(
      makeNode(
        credId,
        "credential",
        `Credential: ${credentialNodeData.credentialType}`,
        credentialNodeData,
      ),
    );

    edges.push(makeEdge(issuerId, credId, "HAS_CREDENTIAL", "has credential"));
  }

  // ── 13. MPToken / MPTokenIssuance nodes ──────────────────────────────────
  const mptObjects = crawl.accountObjects.filter(
    (o: any) => o.LedgerEntryType === "MPTokenIssuance" || o.LedgerEntryType === "MPToken",
  );

  for (const mpt of mptObjects) {
    const mptId = `mpToken:${mpt.MPTokenIssuanceID ?? mpt.index ?? Math.random()}`;
    if (nodeIndex.has(mptId)) continue;

    const mpTokenNodeData: MPTokenNodeData = {
      mptIssuanceID: mpt.MPTokenIssuanceID ?? "",
      issuer: mpt.Issuer ?? seedAddress,
      maxSupply: mpt.MaximumAmount,
      outstandingAmount: mpt.OutstandingAmount,
      transferFee: mpt.TransferFee,
      metadata: mpt.MPTokenMetadata ? hexToAscii(mpt.MPTokenMetadata) : undefined,
    };

    addNode(
      makeNode(
        mptId,
        "mpToken",
        `MPT ${(mpt.MPTokenIssuanceID ?? "").slice(0, 8)}`,
        mpTokenNodeData,
      ),
    );

    edges.push(makeEdge(issuerId, mptId, "ISSUED_MPT", "issued MPT"));
  }

  // ── 14. Oracle nodes ─────────────────────────────────────────────────────
  const oracleObjects = crawl.accountObjects.filter((o: any) => o.LedgerEntryType === "Oracle");

  for (const oracle of oracleObjects) {
    const oracleId = `oracle:${oracle.index ?? Math.random()}`;

    const oracleNodeData: OracleNodeData = {
      account: oracle.Owner ?? seedAddress,
      oracleDocumentID: oracle.OracleDocumentID ?? 0,
      provider: oracle.Provider ? hexToAscii(oracle.Provider) : undefined,
      assetClass: oracle.AssetClass ? hexToAscii(oracle.AssetClass) : undefined,
      lastUpdateTime: oracle.LastUpdateTime,
      priceDataSeries: (oracle.PriceDataSeries ?? []).map((pd: any) => {
        const base = pd.PriceData?.BaseAsset;
        const quote = pd.PriceData?.QuoteAsset;
        return {
          baseAsset: typeof base === "string" ? base : (base?.currency ?? ""),
          quoteAsset: typeof quote === "string" ? quote : (quote?.currency ?? ""),
          assetPrice: pd.PriceData?.AssetPrice,
          scale: pd.PriceData?.Scale,
        };
      }),
    };

    addNode(
      makeNode(
        oracleId,
        "oracle",
        `Oracle: ${oracleNodeData.provider ?? "unknown"}`,
        oracleNodeData,
      ),
    );

    edges.push(makeEdge(issuerId, oracleId, "PROVIDES_ORACLE", "provides oracle"));
  }

  // ── 15. DepositPreauth nodes ──────────────────────────────────────────────
  const depositPreauthObjects = crawl.accountObjects.filter(
    (o: any) => o.LedgerEntryType === "DepositPreauth",
  );

  for (const dp of depositPreauthObjects) {
    const dpId = `depositPreauth:${dp.index ?? Math.random()}`;

    const dpNodeData: DepositPreauthNodeData = {
      account: dp.Account ?? seedAddress,
      authorize: dp.Authorize ?? "",
    };

    addNode(
      makeNode(dpId, "depositPreauth", `Preauth → ${(dp.Authorize ?? "").slice(0, 8)}`, dpNodeData),
    );

    edges.push(makeEdge(issuerId, dpId, "PREAUTHORIZES", "preauthorizes"));
  }

  // ── 16. Account's own DEX Offer nodes ───────────────────────────────────
  for (const offer of (crawl.accountOffers ?? []).slice(0, 50)) {
    const offerId = `offer:${offer.seq ?? offer.Sequence ?? Math.random()}`;

    const offerNodeData: OfferNodeData = {
      account: seedAddress,
      takerGets: offer.taker_gets ?? offer.TakerGets,
      takerPays: offer.taker_pays ?? offer.TakerPays,
      sequence: offer.seq ?? offer.Sequence,
      expiration: offer.expiration ?? offer.Expiration,
      flags: offer.flags ?? offer.Flags,
    };

    addNode(
      makeNode(offerId, "offer", `Offer #${offer.seq ?? offer.Sequence ?? ""}`, offerNodeData),
    );

    edges.push(makeEdge(issuerId, offerId, "HAS_OFFER", "has offer"));
  }

  // ── 17. PermissionedDomain nodes ────────────────────────────────────────
  const permDomainObjects = crawl.accountObjects.filter(
    (o: any) => o.LedgerEntryType === "PermissionedDomain",
  );

  for (const pd of permDomainObjects) {
    const pdId = `permissionedDomain:${pd.index ?? Math.random()}`;

    const pdNodeData: PermissionedDomainNodeData = {
      account: pd.Owner ?? seedAddress,
      domainID: pd.index ?? "",
      acceptedCredentials: (pd.AcceptedCredentials ?? []).map((c: any) => ({
        issuer: c.AcceptedCredential?.Issuer ?? c.Issuer ?? "",
        credentialType: c.AcceptedCredential?.CredentialType
          ? hexToAscii(c.AcceptedCredential.CredentialType)
          : "unknown",
      })),
    };

    addNode(
      makeNode(
        pdId,
        "permissionedDomain",
        `PermDomain ${(pd.index ?? "").slice(0, 8)}`,
        pdNodeData,
      ),
    );

    edges.push(makeEdge(issuerId, pdId, "HAS_DOMAIN", "has domain"));
  }

  // ── 18. NFT Offer nodes ──────────────────────────────────────────────────
  for (const offer of (crawl.nftOffers ?? []).slice(0, 50)) {
    const offerId = `nftOffer:${offer.nft_offer_index ?? Math.random()}`;

    const amount =
      typeof offer.amount === "string"
        ? xrpDropsToString(offer.amount)
        : (offer.amount?.value ?? "0");

    const nftOfferNodeData: NFTOfferNodeData = {
      offerId: offer.nft_offer_index ?? "",
      owner: offer.owner ?? "",
      nftId: offer.nftId ?? "",
      amount,
      destination: offer.destination,
      expiration: offer.expiration,
      flags: offer.flags,
      isSellOffer: offer.isSellOffer ?? false,
    };

    addNode(
      makeNode(
        offerId,
        "nftOffer",
        `${offer.isSellOffer ? "Sell" : "Buy"} ${amount}`,
        nftOfferNodeData,
      ),
    );

    const nftNodeId = `nft:${offer.nftId}`;
    if (nodeIndex.has(nftNodeId)) {
      edges.push(makeEdge(offerId, nftNodeId, "NFT_OFFER_FOR", "offer for"));
    }
  }

  // ── 19. Ticket nodes ────────────────────────────────────────────────────
  const ticketObjects = crawl.accountObjects.filter((o: any) => o.LedgerEntryType === "Ticket");

  for (const ticket of ticketObjects) {
    const ticketId = `ticket:${ticket.TicketSequence ?? ticket.index ?? Math.random()}`;

    const ticketNodeData: TicketNodeData = {
      account: ticket.Account ?? seedAddress,
      ticketSequence: ticket.TicketSequence ?? 0,
    };

    addNode(makeNode(ticketId, "ticket", `Ticket #${ticket.TicketSequence ?? ""}`, ticketNodeData));

    edges.push(makeEdge(issuerId, ticketId, "HAS_TICKET", "has ticket"));
  }

  // ── 20. Bridge nodes ────────────────────────────────────────────────────
  const bridgeObjects = crawl.accountObjects.filter((o: any) => o.LedgerEntryType === "Bridge");

  for (const bridge of bridgeObjects) {
    const bridgeId = `bridge:${bridge.index ?? Math.random()}`;

    const bridgeNodeData: BridgeNodeData = {
      account: bridge.Account ?? seedAddress,
      bridgeAccount: bridge.XChainBridge?.LockingChainDoor ?? bridge.XChainBridge?.IssuingChainDoor,
      bridgeAsset: bridge.XChainBridge?.LockingChainIssue ?? bridge.XChainBridge?.IssuingChainIssue,
      signatureReward: bridge.SignatureReward
        ? xrpDropsToString(bridge.SignatureReward)
        : undefined,
      minAccountCreateAmount: bridge.MinAccountCreateAmount
        ? xrpDropsToString(bridge.MinAccountCreateAmount)
        : undefined,
    };

    addNode(
      makeNode(bridgeId, "bridge", `Bridge ${(bridge.index ?? "").slice(0, 8)}`, bridgeNodeData),
    );

    edges.push(makeEdge(issuerId, bridgeId, "HAS_BRIDGE", "has bridge"));
  }

  // ── 21. Vault nodes ─────────────────────────────────────────────────────
  const vaultObjects = crawl.accountObjects.filter((o: any) => o.LedgerEntryType === "Vault");

  for (const vault of vaultObjects) {
    const vaultId = `vault:${vault.index ?? Math.random()}`;

    const vaultNodeData: VaultNodeData = {
      account: vault.Account ?? seedAddress,
      asset: vault.Asset,
      owner: vault.Owner,
      data: vault.Data,
    };

    addNode(makeNode(vaultId, "vault", `Vault ${(vault.index ?? "").slice(0, 8)}`, vaultNodeData));

    edges.push(makeEdge(issuerId, vaultId, "HAS_VAULT", "has vault"));
  }

  // ── Build stats (single pass) ────────────────────────────────────────────
  const nodesByKind: Record<NodeKind, number> = {
    token: 0,
    issuer: 0,
    ammPool: 0,
    orderBook: 0,
    account: 0,
    paymentPath: 0,
    escrow: 0,
    check: 0,
    payChannel: 0,
    nft: 0,
    nftOffer: 0,
    signerList: 0,
    did: 0,
    credential: 0,
    mpToken: 0,
    oracle: 0,
    depositPreauth: 0,
    offer: 0,
    permissionedDomain: 0,
    ticket: 0,
    bridge: 0,
    vault: 0,
  };
  let totalRiskFlags = 0;
  let highRiskCount = 0;
  let medRiskCount = 0;
  let lowRiskCount = 0;

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
