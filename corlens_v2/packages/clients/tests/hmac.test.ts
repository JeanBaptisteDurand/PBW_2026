import { describe, expect, it } from "vitest";
import { hmacSigner, hmacVerifier } from "../src/hmac.js";

describe("hmacSigner / hmacVerifier", () => {
  const secret = "test-secret-do-not-ship";

  it("verifier accepts a request signed by the matching signer", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const body = '{"hello":"world"}';
    const headers = sign(body);
    expect(verify(body, headers)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const headers = sign('{"hello":"world"}');
    expect(verify('{"hello":"tampered"}', headers)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret: "different", maxAgeSeconds: 60 });
    const body = '{"x":1}';
    const headers = sign(body);
    expect(verify(body, headers)).toBe(false);
  });

  it("rejects a stale signature past maxAge", () => {
    const past = Math.floor(Date.now() / 1000) - 120;
    const sign = hmacSigner({ secret, nowSeconds: () => past });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const body = "{}";
    const headers = sign(body);
    expect(verify(body, headers)).toBe(false);
  });

  it("signs an empty body", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const headers = sign(undefined);
    expect(verify(undefined, headers)).toBe(true);
  });
});
