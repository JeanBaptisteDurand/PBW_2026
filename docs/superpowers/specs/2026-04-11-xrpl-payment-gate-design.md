# XRPL Payment Gate — Design Spec

## Purpose

Add an XRP/RLUSD subscription payment to unlock premium features (Safe Path Agent, Compliance PDF export). Generates real on-chain transactions on XRPL Testnet. Two payment paths: server-side demo wallet (Playwright-testable) and Crossmark browser extension (demo-quality UX for judges).

## Gated Features

- **Safe Path Agent** (`/api/safe-path`) — SSE endpoint, gated by JWT `role: "premium"`
- **Compliance PDF export** (`POST /api/compliance/:id`) — gated by JWT `role: "premium"`
- All other features remain free

## Auth: Wallet-as-Identity

No email/password. The user's XRPL wallet address IS their identity.

### Flow

1. `POST /api/auth/connect` — body: `{ walletAddress }` → creates or finds User → returns JWT
2. JWT payload: `{ userId, walletAddress, role: "free" | "premium" }`
3. `POST /api/auth/refresh` — requires JWT → checks User role in DB → returns fresh JWT
4. After payment confirmed, User.role is updated to "premium" in DB

### Middleware

- `verifyJwt()` — parses and validates JWT from `Authorization: Bearer <token>`
- `requirePremium()` — calls verifyJwt, then checks `role === "premium"`, returns 403 if not

### Dependencies

- `jsonwebtoken` (new dependency, server only)
- `JWT_SECRET` env var

## Payment Flow

```
User clicks "Unlock Premium"
  → Frontend calls POST /api/payment/create (JWT required)
  → Server creates PaymentRequest row with unique memo
  → Returns { paymentId, destination, amount, currency, memo }

User pays (two paths):
  Path A (Demo): clicks "Pay with Demo Wallet"
    → Frontend calls POST /api/payment/demo-pay { paymentId }
    → Server signs + submits Payment tx from demo wallet to app wallet
    → Real on-chain tx on XRPL Testnet

  Path B (Crossmark, added later): clicks "Pay with Crossmark"
    → Crossmark extension popup → user approves
    → Extension submits Payment tx directly to XRPL Testnet
    → Same destination + memo

Frontend polls GET /api/payment/status/:paymentId every 2s
  → Server calls account_tx on app wallet
  → Scans for Payment tx matching the memo
  → If found: updates PaymentRequest, creates PremiumSubscription, sets User.role = "premium"
  → Returns { status: "confirmed", txHash }

Frontend gets new JWT via POST /api/auth/refresh → features unlocked
```

### Memo as Link

The `memo` field in the XRPL Payment transaction is a unique ID (uuid). This is how the server knows which PaymentRequest a given on-chain transaction satisfies. The server never trusts the frontend — it verifies on-chain.

### Accepted Currencies

- **XRP**: 10 XRP (10,000,000 drops). Primary, zero setup.
- **RLUSD**: 5 RLUSD. Secondary, requires TrustLine to RLUSD issuer. Shows stablecoin business model for bounty scoring.

## Database Schema (Prisma)

```prisma
model User {
  id            String   @id @default(uuid())
  walletAddress String   @unique
  role          String   @default("free")  // "free" | "premium"
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
  currency      String   // "XRP" | "RLUSD"
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
  status      String   @default("pending")  // "pending" | "confirmed" | "expired"
  txHash      String?
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@index([memo])
  @@index([status])
}
```

## API Routes

### New routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/connect` | POST | None | Create user from wallet address, return JWT |
| `/api/auth/refresh` | POST | JWT | Return fresh JWT with current role |
| `/api/payment/create` | POST | JWT | Create PaymentRequest, return payment details |
| `/api/payment/status/:id` | GET | JWT | Poll XRPL for matching tx, return status |
| `/api/payment/demo-pay` | POST | JWT | Demo: server signs + submits Payment from demo wallet |

### Modified routes (add premium gate)

| Route | Method | Change |
|-------|--------|--------|
| `/api/safe-path` | GET (SSE) | Add `requirePremium()` middleware |
| `/api/compliance/:id` | POST | Add `requirePremium()` middleware |

## New Server Files

```
apps/server/src/
├── routes/auth.ts            # /api/auth/connect, /api/auth/refresh
├── routes/payment.ts         # /api/payment/create, status, demo-pay
├── middleware/auth.ts         # verifyJwt(), requirePremium()
└── services/paymentService.ts # createRequest, checkPayment, sendDemoPayment
```

### paymentService.ts

- `createRequest(userId, currency)` — generates uuid memo, picks amount, saves PaymentRequest
- `checkPayment(paymentId)` — fetches account_tx from XRPL, scans for memo match, updates DB
- `sendDemoPayment(paymentId)` — loads demo wallet seed from env, builds + signs + submits Payment tx

## Frontend Changes

### New files

```
apps/web/src/
├── routes/Premium.tsx              # Payment page with options
├── hooks/useAuth.ts                # JWT state management
└── components/ui/PremiumGate.tsx   # Lock overlay component
```

### Modified files

- `api/client.ts` — add auth headers, auth + payment API methods
- `routes/SafePath.tsx` — wrap with PremiumGate
- `routes/ComplianceView.tsx` — gate the "Generate Report" button
- `App.tsx` — add /premium route

### PremiumGate component

Renders over gated content when user role is "free". Shows:
- Lock icon
- "Unlock with XRP" message
- "Go to Premium" button → navigates to /premium

### Premium page

- Shows current plan (free/premium)
- Two payment options: "Pay 10 XRP" (primary), "Pay 5 RLUSD" (secondary)
- "Pay with Demo Wallet" button (Phase 1)
- "Pay with Crossmark" button (Phase 2, disabled initially)
- Polling status indicator during payment
- Success state with tx hash link to testnet explorer

## Environment Variables

```env
# Auth
JWT_SECRET=any-random-string-for-signing

# Payment (testnet)
XRPL_PAYMENT_WALLET_ADDRESS=rAppWallet...    # receives payments
XRPL_PAYMENT_WALLET_SECRET=sAppSecret...     # not used in Phase 1, needed for future refunds
XRPL_DEMO_WALLET_SECRET=sDemoCustomer...     # demo customer wallet (signs demo payments)
XRPL_TESTNET_RPC=wss://s.altnet.rippletest.net:51233
```

User must manually:
1. Generate 2 testnet wallets from https://faucet.altnet.rippletest.net/
2. Paste credentials in `.env`

## Playwright E2E Test

```
tests/payment-flow.spec.ts

1. Navigate to Safe Path → see PremiumGate overlay
2. Click "Unlock Premium" → navigate to /premium
3. See payment options (10 XRP / 5 RLUSD)
4. Click "Pay with Demo Wallet" (XRP)
5. Wait for confirmation (~5-10s on testnet)
6. See "Payment Confirmed" + tx hash link
7. Navigate to Safe Path → overlay gone, feature accessible
8. Refresh page → still premium (JWT persists)
```

Env requirements: `XRPL_TESTNET_RPC`, `XRPL_PAYMENT_WALLET_ADDRESS`, `XRPL_DEMO_WALLET_SECRET`, `JWT_SECRET`

## Phases

### Phase 1: Demo wallet path (fully automatable)
- All server code (auth, payment, verification)
- Frontend (Premium page, PremiumGate, auth hooks)
- Playwright E2E test
- Server signs demo payments — no browser extension needed

### Phase 2: Crossmark extension (judge-facing demo)
- Add Crossmark SDK to frontend
- "Pay with Crossmark" button on Premium page
- Same backend verification — just a different tx origin
- User installs Crossmark + funds testnet wallet before demo

## Non-Goals

- No email/password auth
- No payment refunds
- No subscription expiry/renewal
- No mainnet support
- No RLUSD TrustLine auto-creation (user must have TrustLine if paying RLUSD)
