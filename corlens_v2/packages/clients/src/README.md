# @corlens/clients

Typed HTTP base for service-to-service calls.

## Adding a service client

When a service is built (steps 3+ in the build order), add a typed client to this package:

```ts
// src/identity-client.ts
import { identity } from "@corlens/contracts";
import { createHttpClient, type HttpClientOptions } from "./http.js";

export function createIdentityClient(opts: HttpClientOptions) {
  const http = createHttpClient(opts);
  return {
    verify: (token: string) =>
      http.get(`/verify?token=${encodeURIComponent(token)}`, identity.JwtPayload),
  };
}
```

Re-export from `src/index.ts`. Refactoring a contract schema breaks every caller at compile time.
