import { hmacSigner } from "@corlens/clients";

export type PremiumStatus = {
  isPremium: boolean;
  expiresAt: string | null;
};

export interface IdentityClient {
  getPremiumStatus(userId: string): Promise<PremiumStatus>;
}

export type IdentityClientOptions = {
  baseUrl: string;
  hmacSecret: string;
  fetch?: typeof fetch;
};

export function createIdentityClient(opts: IdentityClientOptions): IdentityClient {
  const f = opts.fetch ?? fetch;
  const sign = hmacSigner({ secret: opts.hmacSecret });
  return {
    async getPremiumStatus(userId) {
      const url = `${opts.baseUrl.replace(/\/$/, "")}/internal/premium-status?userId=${encodeURIComponent(userId)}`;
      const headers = sign("");
      const res = await f(url, { headers });
      if (!res.ok) throw new Error(`identity premium-status -> ${res.status}`);
      return res.json() as Promise<PremiumStatus>;
    },
  };
}
