# XRPLens — Testnet Wallets & Transactions

## Wallets

### App Wallet (receives payments)

| Field | Value |
|-------|-------|
| Address | `rfLCPUcd1sAceU1T9KL52TY7UxhimQftED` |
| Secret | `sEdVgyeCg5i5NL4kFUKmXV4PxFQkzDc` |
| Network | XRPL Testnet |
| Initial balance | 1,000 XRP |
| Purpose | Receives premium subscription payments |

### Demo Wallet (simulates paying customer)

| Field | Value |
|-------|-------|
| Address | `rN6F2eMApXzMn3KASBfKtkrwZBS6MX83nR` |
| Secret | `sEd7cbQrqTz4msNwdZVi4fN1hzkxpCC` |
| Network | XRPL Testnet |
| Initial balance | 1,000 XRP |
| Purpose | Server-side demo payments (Playwright tests + demo mode) |

## Transactions

### Payment 1 — API manual test (2026-04-11)

| Field | Value |
|-------|-------|
| Tx Hash | `088680204BB22BC187E24CA0F663E43468D4CFC3EC8346D8A9858989328340B3` |
| From | `rN6F2eMApXzMn3KASBfKtkrwZBS6MX83nR` (demo wallet) |
| To | `rfLCPUcd1sAceU1T9KL52TY7UxhimQftED` (app wallet) |
| Amount | 10 XRP (10,000,000 drops) |
| Memo | `52baa660-baf9-4f7f-abe4-b63b625e0d4a` |
| Explorer | https://testnet.xrpl.org/transactions/088680204BB22BC187E24CA0F663E43468D4CFC3EC8346D8A9858989328340B3 |

### Payment 2 — Playwright E2E test (2026-04-11)

Multiple test runs generated additional transactions. Check the app wallet's transaction history:
https://testnet.xrpl.org/accounts/rfLCPUcd1sAceU1T9KL52TY7UxhimQftED

## Environment Variables

These go in `apps/server/.env`:

```env
JWT_SECRET="xrplens-dev-secret-2026"
XRPL_PAYMENT_WALLET_ADDRESS="rfLCPUcd1sAceU1T9KL52TY7UxhimQftED"
XRPL_PAYMENT_WALLET_SECRET="sEdVgyeCg5i5NL4kFUKmXV4PxFQkzDc"
XRPL_DEMO_WALLET_SECRET="sEd7cbQrqTz4msNwdZVi4fN1hzkxpCC"
```

## Faucet

Generate new testnet wallets at: https://faucet.altnet.rippletest.net/

Each wallet gets 1,000 free testnet XRP. Testnet resets periodically — if wallets stop working, generate new ones.
