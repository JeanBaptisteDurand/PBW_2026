import { describe, it, expect } from "vitest";
import { buildGraph } from "../../src/analysis/graphBuilder.js";
import type { CrawlResult } from "../../src/analysis/crawler.js";

// ─── Mock CrawlResult factory ─────────────────────────────────────────────────

const RLUSD_HEX = "524C555344000000000000000000000000000000";
const SEED = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const POOL_ACCOUNT = "rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3";
const HOLDER_1 = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const HOLDER_2 = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";

function makeMockCrawl(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    issuerInfo: {
      Account: SEED,
      Flags: 0,
      Domain: "726970706c652e636f6d", // "ripple.com" in hex
      Balance: "1000000000",
      OwnerCount: 5,
      Sequence: 1,
    },
    trustLines: [
      { account: HOLDER_1, currency: RLUSD_HEX, balance: "500", limit: "1000000" },
      { account: HOLDER_2, currency: RLUSD_HEX, balance: "200", limit: "1000000" },
    ],
    gatewayBalances: {
      account: SEED,
      obligations: {
        [RLUSD_HEX]: "1000",
      },
    },
    ammPool: {
      account: POOL_ACCOUNT,
      amount: "50000000000", // 50000 XRP in drops
      amount2: { currency: RLUSD_HEX, issuer: SEED, value: "100000" },
      lp_token: { value: "70710.6781" },
      trading_fee: 500,
      vote_slots: [],
    },
    lpHolders: [
      { account: HOLDER_1, currency: "03461E52", balance: "-35355.339" },
      { account: HOLDER_2, currency: "03461E52", balance: "-35355.339" },
    ],
    asks: [
      { quality: "0.000002", TakerGets: "1000000000", TakerPays: { currency: RLUSD_HEX, value: "2000", issuer: SEED } },
    ],
    bids: [
      { quality: "0.0000019", TakerGets: { currency: RLUSD_HEX, value: "2000", issuer: SEED }, TakerPays: "1050000000" },
    ],
    paths: [],
    accountObjects: [
      {
        LedgerEntryType: "Escrow",
        Account: SEED,
        Destination: HOLDER_1,
        Amount: "10000000",
        index: "ABCDEF1234567890",
      },
    ],
    currencies: {
      receive_currencies: [RLUSD_HEX],
      send_currencies: [RLUSD_HEX],
    },
    topAccounts: new Map([
      [
        HOLDER_1,
        {
          Account: HOLDER_1,
          Balance: "500000000",
          Flags: 0,
          OwnerCount: 2,
          Sequence: 10,
        },
      ],
    ]),
    accountTransactions: [],
    nfts: [],
    channels: [],
    txTypeSummary: [],
    accountOffers: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildGraph", () => {
  it("creates an issuer node", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED, "RippleIssuer");

    const issuerNode = graph.nodes.find((n) => n.kind === "issuer");
    expect(issuerNode).toBeDefined();
    expect(issuerNode!.id).toBe(`issuer:${SEED}`);
    expect((issuerNode!.data as any).address).toBe(SEED);
    expect((issuerNode!.data as any).domain).toBeTruthy();
  });

  it("decodes hex domain on issuer node", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const issuerNode = graph.nodes.find((n) => n.kind === "issuer");
    expect(issuerNode).toBeDefined();
    // "726970706c652e636f6d" decodes to "ripple.com"
    expect((issuerNode!.data as any).domain).toBe("ripple.com");
  });

  it("creates token nodes", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const tokenNodes = graph.nodes.filter((n) => n.kind === "token");
    expect(tokenNodes.length).toBeGreaterThan(0);
    // RLUSD hex should decode to "RLUSD"
    const rlusdToken = tokenNodes.find((n) => (n.data as any).currency === "RLUSD");
    expect(rlusdToken).toBeDefined();
    expect((rlusdToken!.data as any).issuer).toBe(SEED);
  });

  it("creates AMM pool node", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const ammNode = graph.nodes.find((n) => n.kind === "ammPool");
    expect(ammNode).toBeDefined();
    expect(ammNode!.id).toBe(`ammPool:${POOL_ACCOUNT}`);
    expect((ammNode!.data as any).account).toBe(POOL_ACCOUNT);
    expect((ammNode!.data as any).lpHolderCount).toBe(2);
  });

  it("creates order book node", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const orderBookNode = graph.nodes.find((n) => n.kind === "orderBook");
    expect(orderBookNode).toBeDefined();
    expect(orderBookNode!.id).toBe("orderBook:XRP/RLUSD");
    expect((orderBookNode!.data as any).offerCount).toBe(2);
  });

  it("does NOT create an order book node when there are no offers", () => {
    const crawl = makeMockCrawl({ asks: [], bids: [] });
    const graph = buildGraph(crawl, SEED);

    const orderBookNode = graph.nodes.find((n) => n.kind === "orderBook");
    expect(orderBookNode).toBeUndefined();
  });

  it("creates ISSUED_BY edge from token to issuer", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const issuedByEdges = graph.edges.filter((e) => e.kind === "ISSUED_BY");
    expect(issuedByEdges.length).toBeGreaterThan(0);
    const edge = issuedByEdges[0];
    expect(edge.source).toMatch(/^token:/);
    expect(edge.target).toBe(`issuer:${SEED}`);
  });

  it("creates TRUSTS edges from accounts to tokens", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const trustsEdges = graph.edges.filter((e) => e.kind === "TRUSTS");
    expect(trustsEdges.length).toBeGreaterThan(0);
    for (const edge of trustsEdges) {
      expect(edge.source).toMatch(/^account:/);
      expect(edge.target).toMatch(/^token:/);
    }
  });

  it("creates account nodes for trust line holders", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const accountNodes = graph.nodes.filter((n) => n.kind === "account");
    expect(accountNodes.length).toBeGreaterThan(0);
    const holder1Node = accountNodes.find((n) => (n.data as any).address === HOLDER_1);
    expect(holder1Node).toBeDefined();
  });

  it("enriches account nodes from topAccounts", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const accountNodes = graph.nodes.filter((n) => n.kind === "account");
    const enrichedNode = accountNodes.find((n) => (n.data as any).address === HOLDER_1);
    expect(enrichedNode).toBeDefined();
    // HOLDER_1 is in topAccounts so balance should be set
    expect((enrichedNode!.data as any).balance).toBe("500000000");
  });

  it("creates PROVIDES_LIQUIDITY edges from LP holders to AMM pool", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const liquidityEdges = graph.edges.filter((e) => e.kind === "PROVIDES_LIQUIDITY");
    expect(liquidityEdges.length).toBeGreaterThan(0);
    for (const edge of liquidityEdges) {
      expect(edge.source).toMatch(/^account:/);
      expect(edge.target).toMatch(/^ammPool:/);
    }
  });

  it("creates POOLS_WITH edge from AMM pool to token", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const poolsWithEdges = graph.edges.filter((e) => e.kind === "POOLS_WITH");
    expect(poolsWithEdges.length).toBeGreaterThan(0);
    expect(poolsWithEdges[0].source).toMatch(/^ammPool:/);
    expect(poolsWithEdges[0].target).toMatch(/^token:/);
  });

  it("creates escrow nodes from accountObjects", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const escrowNodes = graph.nodes.filter((n) => n.kind === "escrow");
    expect(escrowNodes.length).toBe(1);
    expect((escrowNodes[0].data as any).destination).toBe(HOLDER_1);
    expect((escrowNodes[0].data as any).amount).toBe("10000000");
  });

  it("creates ESCROWS_TO edge from issuer to escrow", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    const escrowsToEdges = graph.edges.filter((e) => e.kind === "ESCROWS_TO");
    expect(escrowsToEdges.length).toBe(1);
    expect(escrowsToEdges[0].source).toBe(`issuer:${SEED}`);
    expect(escrowsToEdges[0].target).toMatch(/^escrow:/);
  });

  it("populates graph stats", () => {
    const crawl = makeMockCrawl();
    const graph = buildGraph(crawl, SEED);

    expect(graph.stats.totalNodes).toBe(graph.nodes.length);
    expect(graph.stats.totalEdges).toBe(graph.edges.length);
    expect(graph.stats.nodesByKind.issuer).toBe(1);
    expect(graph.stats.nodesByKind.token).toBeGreaterThan(0);
    expect(graph.stats.nodesByKind.ammPool).toBe(1);
    expect(graph.stats.nodesByKind.orderBook).toBe(1);
    expect(graph.stats.nodesByKind.account).toBeGreaterThan(0);
    expect(graph.stats.nodesByKind.escrow).toBe(1);
  });

  it("builds graph without AMM pool when ammPool is null", () => {
    const crawl = makeMockCrawl({ ammPool: null, lpHolders: [] });
    const graph = buildGraph(crawl, SEED);

    const ammNode = graph.nodes.find((n) => n.kind === "ammPool");
    expect(ammNode).toBeUndefined();
    const liquidityEdges = graph.edges.filter((e) => e.kind === "PROVIDES_LIQUIDITY");
    expect(liquidityEdges.length).toBe(0);
  });

  it("builds graph without escrows when accountObjects is empty", () => {
    const crawl = makeMockCrawl({ accountObjects: [] });
    const graph = buildGraph(crawl, SEED);

    const escrowNodes = graph.nodes.filter((n) => n.kind === "escrow");
    expect(escrowNodes.length).toBe(0);
  });

  // ─── New node type tests ─────────────────────────────────────────────────

  it("creates check nodes from accountObjects", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        {
          LedgerEntryType: "Check",
          Account: SEED,
          Destination: HOLDER_1,
          SendMax: "50000000",
          index: "CHECK001",
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const checkNodes = graph.nodes.filter((n) => n.kind === "check");
    expect(checkNodes.length).toBe(1);
    expect((checkNodes[0].data as any).destination).toBe(HOLDER_1);
    expect((checkNodes[0].data as any).currency).toBe("XRP");

    const checksToEdges = graph.edges.filter((e) => e.kind === "CHECKS_TO");
    expect(checksToEdges.length).toBe(1);
  });

  it("creates payChannel nodes from accountObjects", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        {
          LedgerEntryType: "PayChannel",
          Account: SEED,
          Destination: HOLDER_2,
          Amount: "100000000",
          Balance: "50000000",
          SettleDelay: 3600,
          index: "CHANNEL001",
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const channelNodes = graph.nodes.filter((n) => n.kind === "payChannel");
    expect(channelNodes.length).toBe(1);
    expect((channelNodes[0].data as any).destination).toBe(HOLDER_2);
    expect((channelNodes[0].data as any).settleDelay).toBe(3600);

    const channelsToEdges = graph.edges.filter((e) => e.kind === "CHANNELS_TO");
    expect(channelsToEdges.length).toBe(1);
  });

  it("creates NFT nodes from nfts array", () => {
    const crawl = makeMockCrawl({
      nfts: [
        {
          NFTokenID: "00010000ABC123",
          Issuer: SEED,
          NFTokenTaxon: 1,
          nft_serial: 42,
          URI: "68747470733a2f2f6578616d706c652e636f6d", // "https://example.com"
          Flags: 8,
          TransferFee: 500,
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const nftNodes = graph.nodes.filter((n) => n.kind === "nft");
    expect(nftNodes.length).toBe(1);
    expect((nftNodes[0].data as any).nftId).toBe("00010000ABC123");
    expect((nftNodes[0].data as any).taxon).toBe(1);

    const ownsNftEdges = graph.edges.filter((e) => e.kind === "OWNS_NFT");
    expect(ownsNftEdges.length).toBe(1);
  });

  it("creates signerList nodes from accountObjects", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        {
          LedgerEntryType: "SignerList",
          SignerQuorum: 2,
          SignerEntries: [
            { SignerEntry: { Account: HOLDER_1, SignerWeight: 1 } },
            { SignerEntry: { Account: HOLDER_2, SignerWeight: 1 } },
          ],
          index: "SIGNERLIST001",
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const signerListNodes = graph.nodes.filter((n) => n.kind === "signerList");
    expect(signerListNodes.length).toBe(1);
    expect((signerListNodes[0].data as any).signerQuorum).toBe(2);
    expect((signerListNodes[0].data as any).signers).toHaveLength(2);

    const signedByEdges = graph.edges.filter((e) => e.kind === "SIGNED_BY");
    expect(signedByEdges.length).toBe(1);
  });

  it("creates DID nodes from accountObjects", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        {
          LedgerEntryType: "DID",
          Account: SEED,
          URI: "68747470733a2f2f6469642e6578616d706c65", // "https://did.example"
          index: "DID001",
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const didNodes = graph.nodes.filter((n) => n.kind === "did");
    expect(didNodes.length).toBe(1);

    const hasDIDEdges = graph.edges.filter((e) => e.kind === "HAS_DID");
    expect(hasDIDEdges.length).toBe(1);
  });

  it("creates credential nodes from accountObjects", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        {
          LedgerEntryType: "Credential",
          Subject: SEED,
          Issuer: HOLDER_1,
          CredentialType: "4b5943", // "KYC" in hex
          index: "CRED001",
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const credNodes = graph.nodes.filter((n) => n.kind === "credential");
    expect(credNodes.length).toBe(1);
    expect((credNodes[0].data as any).credentialType).toBe("KYC");
  });

  it("creates mpToken nodes from accountObjects", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        {
          LedgerEntryType: "MPTokenIssuance",
          Issuer: SEED,
          MPTokenIssuanceID: "MPT00001",
          MaximumAmount: "1000000",
          OutstandingAmount: "500000",
          index: "MPT001",
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const mptNodes = graph.nodes.filter((n) => n.kind === "mpToken");
    expect(mptNodes.length).toBe(1);
    expect((mptNodes[0].data as any).mptIssuanceID).toBe("MPT00001");
  });

  it("creates oracle nodes from accountObjects", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        {
          LedgerEntryType: "Oracle",
          Owner: SEED,
          OracleDocumentID: 1,
          Provider: "426974737461",  // "Bitsta" in hex
          PriceDataSeries: [
            {
              PriceData: {
                BaseAsset: { currency: "XRP" },
                QuoteAsset: { currency: "USD" },
                AssetPrice: "500000",
                Scale: 3,
              },
            },
          ],
          index: "ORACLE001",
        },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    const oracleNodes = graph.nodes.filter((n) => n.kind === "oracle");
    expect(oracleNodes.length).toBe(1);
    expect((oracleNodes[0].data as any).oracleDocumentID).toBe(1);
  });

  it("handles mixed accountObjects (escrow, check, payChannel, signerList)", () => {
    const crawl = makeMockCrawl({
      accountObjects: [
        { LedgerEntryType: "Escrow", Account: SEED, Destination: HOLDER_1, Amount: "10000000", index: "ESC001" },
        { LedgerEntryType: "Check", Account: SEED, Destination: HOLDER_2, SendMax: "5000000", index: "CHK001" },
        { LedgerEntryType: "PayChannel", Account: SEED, Destination: HOLDER_1, Amount: "20000000", Balance: "10000000", SettleDelay: 7200, index: "CH001" },
        { LedgerEntryType: "SignerList", SignerQuorum: 3, SignerEntries: [{ SignerEntry: { Account: HOLDER_1, SignerWeight: 2 } }], index: "SL001" },
      ],
    });
    const graph = buildGraph(crawl, SEED);

    expect(graph.nodes.filter((n) => n.kind === "escrow").length).toBe(1);
    expect(graph.nodes.filter((n) => n.kind === "check").length).toBe(1);
    expect(graph.nodes.filter((n) => n.kind === "payChannel").length).toBe(1);
    expect(graph.nodes.filter((n) => n.kind === "signerList").length).toBe(1);

    // All new node kinds should be reflected in stats
    expect(graph.stats.nodesByKind.check).toBe(1);
    expect(graph.stats.nodesByKind.payChannel).toBe(1);
    expect(graph.stats.nodesByKind.signerList).toBe(1);
  });
});
