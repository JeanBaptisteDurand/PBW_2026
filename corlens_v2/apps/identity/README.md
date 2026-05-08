# @corlens/identity

Auth, JWT, payment, premium gating. Owns the `identity` Postgres schema.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login/challenge` | public | Issue a SIWE-style nonce challenge |
| POST | `/api/auth/login/verify` | public | Verify Crossmark signature, issue JWT |
| POST | `/api/auth/refresh` | JWT | Re-issue JWT with current DB role |
| GET | `/api/auth/profile` | JWT | User profile + subscriptions |
| POST | `/api/auth/api-key` | JWT (premium) | Generate or rotate API key |
| DELETE | `/api/auth/api-key` | JWT | Revoke API key |
| GET | `/api/payment/info` | public | Pricing + demo wallet |
| POST | `/api/payment/create` | JWT | Create payment request (XRP or RLUSD) |
| GET | `/api/payment/status/:id` | JWT | Poll payment status |
| POST | `/api/payment/demo-pay` | JWT | Server-signs payment from demo wallet |
| GET | `/verify` | internal | For Caddy `forward_auth` — validates JWT, returns user headers |
| GET | `/health` | public | Liveness probe |
| GET | `/docs` | public | Swagger UI |

Schema documentation auto-generated from Zod.

## Dev

```bash
pnpm --filter @corlens/identity dev
```

Listens on port 3001 by default.
