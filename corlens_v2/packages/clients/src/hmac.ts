import { createHmac, timingSafeEqual } from "node:crypto";

export interface HmacSignerOptions {
  secret: string;
  nowSeconds?: () => number;
}

export interface HmacVerifierOptions {
  secret: string;
  maxAgeSeconds: number;
  nowSeconds?: () => number;
}

const TS_HEADER = "x-corlens-ts";
const SIG_HEADER = "x-corlens-sig";

function compute(secret: string, ts: string, body: string): string {
  return createHmac("sha256", secret).update(`${ts}\n${body}`).digest("hex");
}

export function hmacSigner(
  opts: HmacSignerOptions,
): (body: string | undefined) => Record<string, string> {
  const now = opts.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  return (body) => {
    const ts = String(now());
    const sig = compute(opts.secret, ts, body ?? "");
    return { [TS_HEADER]: ts, [SIG_HEADER]: sig };
  };
}

export function hmacVerifier(
  opts: HmacVerifierOptions,
): (body: string | undefined, headers: Record<string, string>) => boolean {
  const now = opts.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  return (body, headers) => {
    const ts = headers[TS_HEADER];
    const sig = headers[SIG_HEADER];
    if (!ts || !sig) return false;

    const parsedTs = Number.parseInt(ts, 10);
    if (!Number.isFinite(parsedTs)) return false;
    if (Math.abs(now() - parsedTs) > opts.maxAgeSeconds) return false;

    const expected = compute(opts.secret, ts, body ?? "");
    if (expected.length !== sig.length) return false;
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  };
}
