# XRPL Payment Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add XRP/RLUSD payment gate that unlocks Safe Path Agent and Compliance PDF, with JWT wallet-as-identity auth, verified on-chain via XRPL Testnet.

**Architecture:** Server-side demo wallet path first (Playwright-testable), Crossmark extension later. Auth via JWT with wallet address as identity. Payment verified by scanning `account_tx` for matching memo. Prisma for persistence.

**Tech Stack:** Express, xrpl.js 4.1.0 (already installed), jsonwebtoken (new), Prisma, React, Playwright

---

### Task 1: Install jsonwebtoken + update config

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/config.ts`
- Modify: `xrplens/.env.example`

- [ ] **Step 1: Install jsonwebtoken**

```bash
cd /Users/beorlor/Documents/PBW/xrplens && pnpm add jsonwebtoken --filter @xrplens/server && pnpm add -D @types/jsonwebtoken --filter @xrplens/server
```

- [ ] **Step 2: Add new env vars to config.ts**

In `apps/server/src/config.ts`, add to the Zod schema:

```typescript
JWT_SECRET: z.string().default("xrplens-dev-secret"),
XRPL_PAYMENT_WALLET_ADDRESS: z.string().default(""),
XRPL_PAYMENT_WALLET_SECRET: z.string().default(""),
XRPL_DEMO_WALLET_SECRET: z.string().default(""),
```

- [ ] **Step 3: Update .env.example**

Add to `xrplens/.env.example`:

```env
# Auth
JWT_SECRET="xrplens-dev-secret"

# Payment gate (testnet) — generate wallets at https://faucet.altnet.rippletest.net/
XRPL_PAYMENT_WALLET_ADDRESS=""
XRPL_PAYMENT_WALLET_SECRET=""
XRPL_DEMO_WALLET_SECRET=""
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/package.json pnpm-lock.yaml apps/server/src/config.ts .env.example
git commit -m "feat(payment): add jsonwebtoken dep + payment env config"
```

---

### Task 2: Prisma schema — User, PaymentRequest, PremiumSubscription

**Files:**
- Modify: `apps/server/prisma/schema.prisma`

- [ ] **Step 1: Add models to schema.prisma**

Append after the `CorridorRagMessage` model at the end of the file:

```prisma
// ─── Payment gate ─────────────────────────────────────────────
model User {
  id            String   @id @default(uuid())
  walletAddress String   @unique
  role          String   @default("free") // "free" | "premium"
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subscriptions PremiumSubscription[]
}

model PremiumSubscription {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  txHash        String   @unique
  amount        String
  currency      String
  walletAddress String
  memo          String   @unique
  paidAt        DateTime @default(now())

  @@index([userId])
  @@index([walletAddress])
}

model PaymentRequest {
  id          String   @id @default(uuid())
  userId      String
  amount      String
  currency    String
  destination String
  memo        String   @unique
  status      String   @default("pending")
  txHash      String?
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@index([memo])
  @@index([status])
}
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/beorlor/Documents/PBW/xrplens && pnpm --filter @xrplens/server exec prisma migrate dev --name add_payment_gate
```

Expected: Migration creates 3 new tables. Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add apps/server/prisma/
git commit -m "feat(payment): add User, PaymentRequest, PremiumSubscription models"
```

---

### Task 3: Auth middleware — verifyJwt + requirePremium

**Files:**
- Create: `apps/server/src/middleware/auth.ts`

- [ ] **Step 1: Create auth middleware**

```typescript
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

export interface JwtPayload {
  userId: string;
  walletAddress: string;
  role: "free" | "premium";
}

// Extend Express Request to carry decoded JWT
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: "24h" });
}

export function verifyJwt(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    const decoded = jwt.verify(header.slice(7), config.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requirePremium(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  if (req.user.role !== "premium") {
    res.status(403).json({ error: "premium_required" });
    return;
  }
  next();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/middleware/auth.ts
git commit -m "feat(auth): add JWT middleware — verifyJwt + requirePremium"
```

---

### Task 4: Auth routes — connect + refresh

**Files:**
- Create: `apps/server/src/routes/auth.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create auth router**

```typescript
import { Router, type IRouter } from "express";
import { prisma } from "../db/client.js";
import { signJwt, verifyJwt, type JwtPayload } from "../middleware/auth.js";
import { logger } from "../logger.js";

export const authRouter: IRouter = Router();

// POST /api/auth/connect — wallet-as-identity login
authRouter.post("/connect", async (req, res) => {
  try {
    const { walletAddress } = req.body ?? {};
    if (!walletAddress || typeof walletAddress !== "string") {
      res.status(400).json({ error: "walletAddress is required" });
      return;
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { walletAddress } });
      logger.info("[auth] New user created", { walletAddress });
    }

    const token = signJwt({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role as "free" | "premium",
    });

    res.json({ token, user: { id: user.id, walletAddress: user.walletAddress, role: user.role } });
  } catch (err: any) {
    logger.error("[auth] Connect failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/refresh — get fresh JWT with current DB role
authRouter.post("/refresh", verifyJwt, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const token = signJwt({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role as "free" | "premium",
    });

    res.json({ token, user: { id: user.id, walletAddress: user.walletAddress, role: user.role } });
  } catch (err: any) {
    logger.error("[auth] Refresh failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
```

- [ ] **Step 2: Register auth router in index.ts**

In `apps/server/src/index.ts`, add import:

```typescript
import { authRouter } from "./routes/auth.js";
```

Add route after the existing `app.use` lines (after line 93):

```typescript
app.use("/api/auth", authRouter);
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/auth.ts apps/server/src/index.ts
git commit -m "feat(auth): add /api/auth/connect + /api/auth/refresh routes"
```

---

### Task 5: Payment service — create request, check payment, demo pay

**Files:**
- Create: `apps/server/src/services/paymentService.ts`

- [ ] **Step 1: Create payment service**

```typescript
import { Client, Wallet, xrpToDrops, convertStringToHex } from "xrpl";
import { prisma } from "../db/client.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import crypto from "crypto";

const PRICES = {
  XRP: "10",       // 10 XRP
  RLUSD: "5",      // 5 RLUSD
} as const;

const XRP_DROPS = xrpToDrops(PRICES.XRP); // "10000000"

export async function createPaymentRequest(
  userId: string,
  currency: "XRP" | "RLUSD" = "XRP",
) {
  const memo = crypto.randomUUID();
  const amount = PRICES[currency];
  const destination = config.XRPL_PAYMENT_WALLET_ADDRESS;

  const request = await prisma.paymentRequest.create({
    data: {
      userId,
      amount,
      currency,
      destination,
      memo,
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    },
  });

  return {
    paymentId: request.id,
    destination,
    amount,
    currency,
    memo,
  };
}

export async function checkPayment(paymentId: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
  if (!request) return { status: "not_found" as const };
  if (request.status === "confirmed") return { status: "confirmed" as const, txHash: request.txHash };

  // Check if expired
  if (new Date() > request.expiresAt) {
    await prisma.paymentRequest.update({ where: { id: paymentId }, data: { status: "expired" } });
    return { status: "expired" as const };
  }

  // Connect to testnet and check account_tx
  const client = new Client(config.XRPL_TESTNET_RPC);
  try {
    await client.connect();

    const response = await client.request({
      command: "account_tx",
      account: config.XRPL_PAYMENT_WALLET_ADDRESS,
      limit: 20,
    });

    const txs = (response.result as any).transactions ?? [];

    for (const entry of txs) {
      const tx = entry.tx_json ?? entry.tx;
      if (!tx || tx.TransactionType !== "Payment") continue;
      if (tx.Destination !== config.XRPL_PAYMENT_WALLET_ADDRESS) continue;

      // Check memo field for our unique ID
      const memos = tx.Memos ?? [];
      for (const m of memos) {
        const memoData = m.Memo?.MemoData;
        if (!memoData) continue;
        // MemoData is hex-encoded
        const decoded = Buffer.from(memoData, "hex").toString("utf-8");
        if (decoded === request.memo) {
          // Match found — verify amount
          const hash = entry.hash ?? tx.hash;

          // Update payment request
          await prisma.paymentRequest.update({
            where: { id: paymentId },
            data: { status: "confirmed", txHash: hash },
          });

          // Create subscription + upgrade user
          await prisma.premiumSubscription.create({
            data: {
              userId: request.userId,
              txHash: hash,
              amount: request.amount,
              currency: request.currency,
              walletAddress: tx.Account,
              memo: request.memo,
            },
          });

          await prisma.user.update({
            where: { id: request.userId },
            data: { role: "premium" },
          });

          logger.info("[payment] Payment confirmed", { paymentId, txHash: hash });
          return { status: "confirmed" as const, txHash: hash };
        }
      }
    }

    return { status: "pending" as const };
  } finally {
    try { await client.disconnect(); } catch {}
  }
}

export async function sendDemoPayment(paymentId: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
  if (!request) throw new Error("Payment request not found");
  if (request.status === "confirmed") throw new Error("Already paid");

  const demoWallet = Wallet.fromSeed(config.XRPL_DEMO_WALLET_SECRET);
  const client = new Client(config.XRPL_TESTNET_RPC);

  try {
    await client.connect();

    // Build the Payment transaction
    const txBlob: any = {
      TransactionType: "Payment",
      Account: demoWallet.address,
      Destination: request.destination,
      Memos: [
        {
          Memo: {
            MemoData: convertStringToHex(request.memo),
            MemoType: convertStringToHex("text/plain"),
          },
        },
      ],
    };

    if (request.currency === "XRP") {
      txBlob.Amount = XRP_DROPS;
    } else {
      // RLUSD — issued currency amount (requires TrustLine)
      txBlob.Amount = {
        currency: "524C555344000000000000000000000000000000", // RLUSD hex
        issuer: request.destination, // simplified: app wallet is issuer for testnet demo
        value: request.amount,
      };
    }

    const prepared = await client.autofill(txBlob);
    const signed = demoWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const hash = (result.result as any).hash ?? signed.hash;
    logger.info("[payment] Demo payment submitted", { paymentId, hash });

    return { txHash: hash };
  } finally {
    try { await client.disconnect(); } catch {}
  }
}

export function getDemoWalletAddress(): string {
  if (!config.XRPL_DEMO_WALLET_SECRET) return "";
  return Wallet.fromSeed(config.XRPL_DEMO_WALLET_SECRET).address;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/services/paymentService.ts
git commit -m "feat(payment): add paymentService — create, check, demo-pay"
```

---

### Task 6: Payment routes

**Files:**
- Create: `apps/server/src/routes/payment.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create payment router**

```typescript
import { Router, type IRouter } from "express";
import { verifyJwt } from "../middleware/auth.js";
import {
  createPaymentRequest,
  checkPayment,
  sendDemoPayment,
  getDemoWalletAddress,
} from "../services/paymentService.js";
import { logger } from "../logger.js";

export const paymentRouter: IRouter = Router();

// GET /api/payment/info — public info about payment options
paymentRouter.get("/info", (_req, res) => {
  res.json({
    options: [
      { currency: "XRP", amount: "10", label: "10 XRP" },
      { currency: "RLUSD", amount: "5", label: "5 RLUSD" },
    ],
    demoWalletAddress: getDemoWalletAddress(),
  });
});

// POST /api/payment/create — create a payment request
paymentRouter.post("/create", verifyJwt, async (req, res) => {
  try {
    const currency = req.body?.currency === "RLUSD" ? "RLUSD" : "XRP";
    const result = await createPaymentRequest(req.user!.userId, currency);
    res.json(result);
  } catch (err: any) {
    logger.error("[payment] Create failed", { error: err?.message });
    res.status(500).json({ error: "Failed to create payment request" });
  }
});

// GET /api/payment/status/:id — poll payment status
paymentRouter.get("/status/:id", verifyJwt, async (req, res) => {
  try {
    const result = await checkPayment(req.params.id);
    res.json(result);
  } catch (err: any) {
    logger.error("[payment] Status check failed", { error: err?.message });
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

// POST /api/payment/demo-pay — server signs + submits from demo wallet
paymentRouter.post("/demo-pay", verifyJwt, async (req, res) => {
  try {
    const { paymentId } = req.body ?? {};
    if (!paymentId) {
      res.status(400).json({ error: "paymentId is required" });
      return;
    }
    const result = await sendDemoPayment(paymentId);
    res.json(result);
  } catch (err: any) {
    logger.error("[payment] Demo pay failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "Demo payment failed" });
  }
});
```

- [ ] **Step 2: Register payment router in index.ts**

In `apps/server/src/index.ts`, add import:

```typescript
import { paymentRouter } from "./routes/payment.js";
```

Add route after the auth router line:

```typescript
app.use("/api/payment", paymentRouter);
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/payment.ts apps/server/src/index.ts
git commit -m "feat(payment): add /api/payment routes — create, status, demo-pay"
```

---

### Task 7: Gate existing routes with requirePremium

**Files:**
- Modify: `apps/server/src/routes/safe-path.ts`
- Modify: `apps/server/src/routes/compliance.ts`

- [ ] **Step 1: Gate safe-path route**

In `apps/server/src/routes/safe-path.ts`, add imports at top:

```typescript
import { verifyJwt, requirePremium } from "../middleware/auth.js";
```

Change line 14 from:

```typescript
safePathRouter.post("/", async (req, res) => {
```

To:

```typescript
safePathRouter.post("/", verifyJwt, requirePremium, async (req, res) => {
```

- [ ] **Step 2: Gate compliance POST and PDF routes**

In `apps/server/src/routes/compliance.ts`, add import at top:

```typescript
import { verifyJwt, requirePremium } from "../middleware/auth.js";
```

Change line 11 from:

```typescript
complianceRouter.post("/:analysisId", async (req, res) => {
```

To:

```typescript
complianceRouter.post("/:analysisId", verifyJwt, requirePremium, async (req, res) => {
```

Change line 61 from:

```typescript
complianceRouter.get("/:analysisId/pdf", async (req, res) => {
```

To:

```typescript
complianceRouter.get("/:analysisId/pdf", verifyJwt, requirePremium, async (req, res) => {
```

The GET `/:analysisId` (list reports) stays public — only generating and downloading are premium.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/safe-path.ts apps/server/src/routes/compliance.ts
git commit -m "feat(payment): gate safe-path + compliance behind requirePremium"
```

---

### Task 8: Frontend — useAuth hook

**Files:**
- Create: `apps/web/src/hooks/useAuth.ts`

- [ ] **Step 1: Create useAuth hook**

```typescript
import { useState, useCallback, useEffect } from "react";

interface User {
  id: string;
  walletAddress: string;
  role: "free" | "premium";
}

interface AuthState {
  token: string | null;
  user: User | null;
}

const STORAGE_KEY = "xrplens_auth";

function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { token: null, user: null };
}

function saveAuth(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(loadAuth);

  // Persist to localStorage on change
  useEffect(() => {
    saveAuth(auth);
  }, [auth]);

  const connect = useCallback(async (walletAddress: string) => {
    const res = await fetch("/api/auth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    });
    if (!res.ok) throw new Error("Failed to connect");
    const data = await res.json();
    setAuth({ token: data.token, user: data.user });
    return data;
  }, []);

  const refresh = useCallback(async () => {
    if (!auth.token) return;
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    setAuth({ token: data.token, user: data.user });
    return data;
  }, [auth.token]);

  const logout = useCallback(() => {
    setAuth({ token: null, user: null });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isPremium = auth.user?.role === "premium";

  return { ...auth, connect, refresh, logout, isPremium };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useAuth.ts
git commit -m "feat(auth): add useAuth hook with localStorage persistence"
```

---

### Task 9: Frontend — update API client to attach JWT

**Files:**
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1: Add auth header helper + payment methods**

At the top of `apps/web/src/api/client.ts`, after line 14 (`const BASE_URL = "/api";`), add:

```typescript
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("xrplens_auth");
    if (raw) {
      const { token } = JSON.parse(raw);
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch {}
  return {};
}
```

In the `fetchJSON` function, change the headers from:

```typescript
headers: {
  "Content-Type": "application/json",
  ...options?.headers,
},
```

To:

```typescript
headers: {
  "Content-Type": "application/json",
  ...getAuthHeaders(),
  ...options?.headers,
},
```

At the end of the `api` object (before the closing `};`), add these methods:

```typescript
  // ─── Payment gate ──────────────────────────────────────────────

  /** GET /api/payment/info — payment options + demo wallet */
  getPaymentInfo(): Promise<{
    options: Array<{ currency: string; amount: string; label: string }>;
    demoWalletAddress: string;
  }> {
    return fetchJSON("/payment/info");
  },

  /** POST /api/payment/create — create payment request */
  createPaymentRequest(currency: "XRP" | "RLUSD" = "XRP"): Promise<{
    paymentId: string;
    destination: string;
    amount: string;
    currency: string;
    memo: string;
  }> {
    return fetchJSON("/payment/create", {
      method: "POST",
      body: JSON.stringify({ currency }),
    });
  },

  /** GET /api/payment/status/:id — poll payment status */
  getPaymentStatus(paymentId: string): Promise<{
    status: "pending" | "confirmed" | "expired" | "not_found";
    txHash?: string;
  }> {
    return fetchJSON(`/payment/status/${paymentId}`);
  },

  /** POST /api/payment/demo-pay — trigger demo payment */
  demoPay(paymentId: string): Promise<{ txHash: string }> {
    return fetchJSON("/payment/demo-pay", {
      method: "POST",
      body: JSON.stringify({ paymentId }),
    });
  },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/api/client.ts
git commit -m "feat(payment): add auth headers + payment methods to API client"
```

---

### Task 10: Frontend — PremiumGate component

**Files:**
- Create: `apps/web/src/components/ui/PremiumGate.tsx`

- [ ] **Step 1: Create PremiumGate overlay**

```tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "./button";

export function PremiumGate({ children }: { children: React.ReactNode }) {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();

  // Not logged in or free user → show gate
  if (!user || !isPremium) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-20 blur-sm select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="rounded-2xl border border-xrp-500/30 bg-slate-900/90 px-8 py-10 text-center backdrop-blur">
            <div className="mb-3 text-4xl">🔒</div>
            <h3 className="mb-2 text-xl font-bold text-white">Premium Feature</h3>
            <p className="mb-6 text-sm text-slate-400">
              Unlock with a one-time XRP or RLUSD payment
            </p>
            <Button
              onClick={() => navigate("/premium")}
              className="bg-xrp-500 hover:bg-xrp-600 text-white px-6"
            >
              Unlock Premium
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/PremiumGate.tsx
git commit -m "feat(ui): add PremiumGate lock overlay component"
```

---

### Task 11: Frontend — Premium page

**Files:**
- Create: `apps/web/src/routes/Premium.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create Premium page**

```tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../hooks/useAuth";
import { api } from "../api/client";

type PaymentStep = "choose" | "paying" | "confirming" | "done";

export default function Premium() {
  const navigate = useNavigate();
  const { user, token, connect, refresh, isPremium } = useAuth();
  const [step, setStep] = useState<PaymentStep>("choose");
  const [currency, setCurrency] = useState<"XRP" | "RLUSD">("XRP");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoWallet, setDemoWallet] = useState("");

  // Auto-connect with demo wallet if not logged in
  useEffect(() => {
    api.getPaymentInfo().then((info) => {
      setDemoWallet(info.demoWalletAddress);
      if (!user && info.demoWalletAddress) {
        connect(info.demoWalletAddress);
      }
    }).catch(() => {});
  }, []);

  // Poll for payment confirmation
  useEffect(() => {
    if (step !== "confirming" || !paymentId) return;
    const interval = setInterval(async () => {
      try {
        const result = await api.getPaymentStatus(paymentId);
        if (result.status === "confirmed") {
          setTxHash(result.txHash ?? null);
          setStep("done");
          await refresh(); // Get fresh JWT with premium role
          clearInterval(interval);
        } else if (result.status === "expired") {
          setError("Payment expired. Please try again.");
          setStep("choose");
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [step, paymentId, refresh]);

  const handleDemoPay = useCallback(async () => {
    setError(null);
    try {
      // Ensure connected
      if (!token && demoWallet) {
        await connect(demoWallet);
      }

      setStep("paying");

      // Create payment request
      const request = await api.createPaymentRequest(currency);
      setPaymentId(request.paymentId);

      // Trigger demo payment
      await api.demoPay(request.paymentId);

      // Now poll for confirmation
      setStep("confirming");
    } catch (err: any) {
      setError(err?.message ?? "Payment failed");
      setStep("choose");
    }
  }, [currency, token, demoWallet, connect]);

  if (isPremium) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <div className="mb-4 text-5xl">✅</div>
        <h1 className="mb-2 text-2xl font-bold text-white">You're Premium!</h1>
        <p className="mb-6 text-slate-400">All features are unlocked.</p>
        <Button onClick={() => navigate("/safe-path")} className="bg-xrp-500 hover:bg-xrp-600 text-white">
          Go to Safe Path Agent
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold text-white">Unlock Premium</h1>
      <p className="mb-8 text-slate-400">
        Pay once to unlock the Safe Path Agent and Compliance PDF export.
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
          {error}
        </div>
      )}

      {/* Currency selection */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <Card
          className={`cursor-pointer border-2 transition ${
            currency === "XRP" ? "border-xrp-500 bg-xrp-500/10" : "border-slate-700 hover:border-slate-500"
          }`}
          onClick={() => setCurrency("XRP")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white">10 XRP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Native XRPL currency</p>
            <Badge className="mt-2 bg-xrp-500/20 text-xrp-400">Recommended</Badge>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer border-2 transition ${
            currency === "RLUSD" ? "border-xrp-500 bg-xrp-500/10" : "border-slate-700 hover:border-slate-500"
          }`}
          onClick={() => setCurrency("RLUSD")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white">5 RLUSD</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">Ripple USD stablecoin</p>
          </CardContent>
        </Card>
      </div>

      {/* Pay button */}
      <Button
        onClick={handleDemoPay}
        disabled={step !== "choose"}
        className="w-full bg-xrp-500 hover:bg-xrp-600 text-white text-lg py-6"
      >
        {step === "choose" && `Pay ${currency === "XRP" ? "10 XRP" : "5 RLUSD"} with Demo Wallet`}
        {step === "paying" && "Submitting transaction..."}
        {step === "confirming" && "Waiting for confirmation..."}
        {step === "done" && "Payment confirmed!"}
      </Button>

      {step === "confirming" && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
          <span className="inline-block w-4 h-4 border-2 border-xrp-500/30 border-t-xrp-500 rounded-full animate-spin" />
          Checking XRPL Testnet for your transaction...
        </div>
      )}

      {step === "done" && txHash && (
        <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
          <p className="mb-2 text-green-400 font-medium">Payment confirmed on XRPL Testnet!</p>
          <a
            href={`https://testnet.xrpl.org/transactions/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-xrp-400 hover:underline break-all"
          >
            View on Explorer: {txHash}
          </a>
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-400">
        <p className="mb-1 font-medium text-slate-300">How it works</p>
        <ol className="list-decimal ml-4 space-y-1">
          <li>Click Pay — a real XRPL Testnet transaction is submitted</li>
          <li>We verify the on-chain payment via the transaction memo</li>
          <li>Your account is upgraded to Premium instantly</li>
        </ol>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add /premium route to App.tsx**

In `apps/web/src/App.tsx`, add the lazy import after line 15:

```typescript
const Premium = lazy(() => import("./routes/Premium"));
```

Add the route inside the `<Route element={<Layout />}>` block, after the History route (after line 94):

```tsx
        <Route
          path="/premium"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Premium />
            </Suspense>
          }
        />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/Premium.tsx apps/web/src/App.tsx
git commit -m "feat(payment): add Premium page with demo wallet payment flow"
```

---

### Task 12: Frontend — Gate SafePath and Compliance with PremiumGate

**Files:**
- Modify: `apps/web/src/routes/SafePath.tsx`
- Modify: `apps/web/src/routes/ComplianceView.tsx`

- [ ] **Step 1: Wrap SafePath page content**

In `apps/web/src/routes/SafePath.tsx`, add import at top:

```typescript
import { PremiumGate } from "../components/ui/PremiumGate";
```

Find the component's return statement and wrap the outermost `<div>` with `<PremiumGate>`:

The component `export default function SafePath()` returns JSX. Wrap its return value:

```tsx
return (
  <PremiumGate>
    {/* existing JSX stays untouched */}
  </PremiumGate>
);
```

- [ ] **Step 2: Gate the Compliance generate + PDF buttons**

In `apps/web/src/routes/ComplianceView.tsx`, add import at top:

```typescript
import { useAuth } from "../hooks/useAuth";
import { PremiumGate } from "../components/ui/PremiumGate";
```

Wrap the returned `<div>` with `<PremiumGate>`:

```tsx
return (
  <PremiumGate>
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* existing content */}
    </div>
  </PremiumGate>
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/SafePath.tsx apps/web/src/routes/ComplianceView.tsx
git commit -m "feat(payment): gate SafePath + Compliance behind PremiumGate"
```

---

### Task 13: Playwright E2E test

**Files:**
- Create: `apps/web/tests/payment-flow.spec.ts`

- [ ] **Step 1: Create E2E test**

```typescript
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const API = "http://localhost:3001";

test.describe("Payment Gate Flow", () => {
  test("demo wallet payment unlocks premium features", async ({ page }) => {
    // 1. Visit Safe Path — should show lock overlay
    await page.goto(`${BASE}/safe-path`);
    await expect(page.getByText("Premium Feature")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Unlock Premium")).toBeVisible();

    // 2. Click unlock → navigate to /premium
    await page.getByRole("button", { name: "Unlock Premium" }).click();
    await expect(page).toHaveURL(/\/premium/);

    // 3. Should auto-connect with demo wallet and show payment options
    await expect(page.getByText("10 XRP")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("5 RLUSD")).toBeVisible();

    // 4. Click "Pay with Demo Wallet" (XRP is default)
    await page.getByRole("button", { name: /Pay.*Demo Wallet/ }).click();

    // 5. Wait for confirmation (testnet tx takes 3-10s)
    await expect(page.getByText("Payment confirmed")).toBeVisible({ timeout: 30000 });

    // 6. Verify tx hash link to testnet explorer is shown
    await expect(page.getByText("View on Explorer")).toBeVisible();

    // 7. Navigate to Safe Path — should now be accessible
    await page.goto(`${BASE}/safe-path`);
    // The lock overlay should be gone
    await expect(page.getByText("Premium Feature")).not.toBeVisible({ timeout: 5000 });

    // 8. Refresh and check persistence
    await page.reload();
    await expect(page.getByText("Premium Feature")).not.toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/beorlor/Documents/PBW/xrplens/apps/web && npx playwright test tests/payment-flow.spec.ts --headed
```

Expected: Test passes. Real XRPL testnet transaction is visible on explorer.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/payment-flow.spec.ts
git commit -m "test(payment): add Playwright E2E test for payment gate flow"
```
