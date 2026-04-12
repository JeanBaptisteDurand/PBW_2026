import { Router, type IRouter } from "express";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";

export const permissionedDomainSeedRouter: IRouter = Router();

// ─── Hand-crafted XLS-80 Permissioned Domain demo ────────────────────────
// XLS-80 (Permissioned Domains) and XLS-81 (Permissioned DEX) are currently
// open for voting on mainnet — no live mainnet account carries a real
// PermissionedDomain ledger entry yet. The strategy doc explicitly says to
// fall back to a hand-crafted seed if no devnet/testnet account can be
// found in time, so this endpoint builds the credential topology the pitch
// needs directly as database rows, returning an analysisId the frontend
// can navigate to via /graph/:id the same way as any live crawl.
//
// Topology (matching the Beat B narration):
//   - 1 domain admin (the venue operator)
//   - 2 credential issuers (the KYC providers)
//   - 3 whitelisted member accounts (participants)
//   - 1 dependent venue (permissioned DEX book)
//
// Risk flag: PERMISSIONED_DOMAIN_DEPENDENCY (HIGH) — the venue depends on
// a single domain admin, so if the admin revokes credentials, every member
// loses access.

const DEMO_SEED_ADDRESS = "rXLSDemo80DomainAdminDemoAccountXXXX";
const DOMAIN_ADMIN = "rDomainAdmin" + "X".repeat(25);
const CRED_ISSUER_1 = "rKycProviderAlpha" + "X".repeat(17);
const CRED_ISSUER_2 = "rKycProviderBeta" + "X".repeat(18);
const MEMBER_1 = "rMemberAccountOne" + "X".repeat(17);
const MEMBER_2 = "rMemberAccountTwo" + "X".repeat(17);
const MEMBER_3 = "rMemberAccountThree" + "X".repeat(15);
const DEPENDENT_VENUE = "rPermissionedDEXVenue" + "X".repeat(13);

// POST /api/permissioned-domain/seed — Create (or re-use) the demo analysis.
// Idempotent: if a demo analysis already exists, returns its id; otherwise
// creates a fresh one with the topology above.
permissionedDomainSeedRouter.post("/seed", async (_req, res) => {
  try {
    // Re-use an existing demo record if present so repeated clicks don't
    // bloat the database during rehearsal.
    const existing = await prisma.analysis.findFirst({
      where: { seedAddress: DEMO_SEED_ADDRESS, status: "done" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      res.json({ id: existing.id, reused: true });
      return;
    }

    const analysis = await prisma.analysis.create({
      data: {
        seedAddress: DEMO_SEED_ADDRESS,
        seedLabel: "XLS-80/81 Permissioned Domain (devnet seed)",
        status: "done",
      },
    });

    // ── Nodes ───────────────────────────────────────────────────────────
    const nodes = [
      {
        nodeId: `permissionedDomain:${DOMAIN_ADMIN}`,
        kind: "permissionedDomain",
        label: "Institutional DEX Domain",
        data: {
          account: DOMAIN_ADMIN,
          domainID: "0xDEMO80DOMAIN" + "0".repeat(50),
          acceptedCredentials: [
            { issuer: CRED_ISSUER_1, credentialType: "KYC_LEVEL_2" },
            { issuer: CRED_ISSUER_2, credentialType: "ACCREDITED_INVESTOR" },
          ],
        },
      },
      {
        nodeId: `issuer:${DOMAIN_ADMIN}`,
        kind: "issuer",
        label: "Domain Admin",
        data: {
          address: DOMAIN_ADMIN,
          domain: "institutional-dex.example",
          flags: 0,
          tokens: [],
        },
      },
      {
        nodeId: `credential:issuer1-kyc2`,
        kind: "credential",
        label: "KYC Level 2 Credentials",
        data: {
          subject: MEMBER_1,
          issuer: CRED_ISSUER_1,
          credentialType: "KYC_LEVEL_2",
        },
      },
      {
        nodeId: `credential:issuer2-accredited`,
        kind: "credential",
        label: "Accredited Investor Credentials",
        data: {
          subject: MEMBER_2,
          issuer: CRED_ISSUER_2,
          credentialType: "ACCREDITED_INVESTOR",
        },
      },
      {
        nodeId: `account:${CRED_ISSUER_1}`,
        kind: "account",
        label: "KYC Provider Alpha",
        data: { address: CRED_ISSUER_1, domain: "kyc-alpha.example" },
      },
      {
        nodeId: `account:${CRED_ISSUER_2}`,
        kind: "account",
        label: "KYC Provider Beta",
        data: { address: CRED_ISSUER_2, domain: "kyc-beta.example" },
      },
      {
        nodeId: `account:${MEMBER_1}`,
        kind: "account",
        label: "Member — Bank A",
        data: { address: MEMBER_1, domain: "bank-a.example" },
      },
      {
        nodeId: `account:${MEMBER_2}`,
        kind: "account",
        label: "Member — Fund B",
        data: { address: MEMBER_2, domain: "fund-b.example" },
      },
      {
        nodeId: `account:${MEMBER_3}`,
        kind: "account",
        label: "Member — Treasury C",
        data: { address: MEMBER_3, domain: "treasury-c.example" },
      },
      {
        nodeId: `orderBook:permissioned-dex`,
        kind: "orderBook",
        label: "Permissioned DEX (XLS-81)",
        data: {
          takerGets: { currency: "RLUSD", issuer: DOMAIN_ADMIN },
          takerPays: { currency: "EUR", issuer: DOMAIN_ADMIN },
          offerCount: 0,
        },
      },
    ];

    const edges = [
      // Domain admin governs the permissioned domain
      {
        edgeId: `${DOMAIN_ADMIN}-governs-domain`,
        source: `issuer:${DOMAIN_ADMIN}`,
        target: `permissionedDomain:${DOMAIN_ADMIN}`,
        kind: "HAS_DOMAIN",
        label: "owns domain",
      },
      // Credential issuers issue credentials that the domain accepts
      {
        edgeId: `issuer1-issues-kyc2`,
        source: `account:${CRED_ISSUER_1}`,
        target: `credential:issuer1-kyc2`,
        kind: "HAS_CREDENTIAL",
        label: "issues",
      },
      {
        edgeId: `issuer2-issues-accredited`,
        source: `account:${CRED_ISSUER_2}`,
        target: `credential:issuer2-accredited`,
        kind: "HAS_CREDENTIAL",
        label: "issues",
      },
      // Members hold credentials
      {
        edgeId: `member1-has-kyc2`,
        source: `account:${MEMBER_1}`,
        target: `credential:issuer1-kyc2`,
        kind: "HAS_CREDENTIAL",
        label: "holds",
      },
      {
        edgeId: `member2-has-accredited`,
        source: `account:${MEMBER_2}`,
        target: `credential:issuer2-accredited`,
        kind: "HAS_CREDENTIAL",
        label: "holds",
      },
      {
        edgeId: `member3-has-kyc2`,
        source: `account:${MEMBER_3}`,
        target: `credential:issuer1-kyc2`,
        kind: "HAS_CREDENTIAL",
        label: "holds",
      },
      // Dependent venue trades on the permissioned domain
      {
        edgeId: `venue-trades-on-domain`,
        source: `orderBook:permissioned-dex`,
        target: `permissionedDomain:${DOMAIN_ADMIN}`,
        kind: "TRADES_ON",
        label: "gated by",
      },
      // Members route through the venue
      {
        edgeId: `member1-routes-venue`,
        source: `account:${MEMBER_1}`,
        target: `orderBook:permissioned-dex`,
        kind: "ROUTES_THROUGH",
        label: "trades on",
      },
      {
        edgeId: `member2-routes-venue`,
        source: `account:${MEMBER_2}`,
        target: `orderBook:permissioned-dex`,
        kind: "ROUTES_THROUGH",
        label: "trades on",
      },
    ];

    await prisma.node.createMany({
      data: nodes.map((n) => ({
        analysisId: analysis.id,
        nodeId: n.nodeId,
        kind: n.kind,
        label: n.label,
        data: n.data as any,
      })),
    });

    await prisma.edge.createMany({
      data: edges.map((e) => ({
        analysisId: analysis.id,
        edgeId: e.edgeId,
        source: e.source,
        target: e.target,
        kind: e.kind,
        label: e.label,
      })),
    });

    // PERMISSIONED_DOMAIN_DEPENDENCY flag on the permissioned domain node
    const dbNodes = await prisma.node.findMany({ where: { analysisId: analysis.id } });
    const domainRow = dbNodes.find((n) => n.kind === "permissionedDomain");
    if (domainRow) {
      await prisma.riskFlag.create({
        data: {
          analysisId: analysis.id,
          nodeId: domainRow.id,
          flag: "PERMISSIONED_DOMAIN_DEPENDENCY",
          severity: "HIGH",
          detail:
            "All 3 member accounts and the dependent permissioned DEX venue depend on a single domain admin. If the admin revokes credentials or disables the domain, every member loses access and the venue goes dark.",
          data: {
            xlsAmendment: "XLS-80",
            memberCount: 3,
            credentialIssuerCount: 2,
            dependentVenues: 1,
          } as any,
        },
      });
    }

    logger.info("[seed] Permissioned domain demo created", { id: analysis.id });
    res.json({ id: analysis.id, reused: false });
  } catch (err: any) {
    logger.error("[seed] Failed to seed permissioned domain demo", {
      error: err?.message,
      stack: err?.stack,
    });
    res.status(500).json({ error: "Seed failed" });
  }
});
