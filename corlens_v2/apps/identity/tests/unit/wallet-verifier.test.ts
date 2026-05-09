import { deriveAddress, deriveKeypair, generateSeed, sign } from "ripple-keypairs";
import { describe, expect, it } from "vitest";
import { RippleKeypairsWalletVerifier } from "../../src/connectors/wallet-verifier.js";

const verifier = new RippleKeypairsWalletVerifier();

function newWallet() {
  const seed = generateSeed();
  const { publicKey, privateKey } = deriveKeypair(seed);
  const address = deriveAddress(publicKey);
  return { publicKey, privateKey, address };
}

function hexFromUtf8(text: string): string {
  return Buffer.from(text, "utf8").toString("hex").toUpperCase();
}

describe("RippleKeypairsWalletVerifier", () => {
  it("accepts a real signature from the matching wallet", () => {
    const { publicKey, privateKey, address } = newWallet();
    const challenge = "Sign in to CORLens\nNonce: abc123\nIssued: 2026-05-08T12:00:00Z";
    const signature = sign(hexFromUtf8(challenge), privateKey);

    const ok = verifier.verify({
      walletAddress: address,
      challenge,
      signature,
      publicKey,
    });

    expect(ok).toBe(true);
  });

  it("rejects when the public key does not derive to the claimed address", () => {
    const a = newWallet();
    const b = newWallet();
    const challenge = "Sign in to CORLens\nNonce: x\nIssued: now";
    const signature = sign(hexFromUtf8(challenge), a.privateKey);

    const ok = verifier.verify({
      walletAddress: b.address,
      challenge,
      signature,
      publicKey: a.publicKey,
    });

    expect(ok).toBe(false);
  });

  it("rejects a tampered challenge", () => {
    const { publicKey, privateKey, address } = newWallet();
    const original = "Sign in to CORLens\nNonce: 1\nIssued: 2026";
    const tampered = "Sign in to CORLens\nNonce: 2\nIssued: 2026";
    const signature = sign(hexFromUtf8(original), privateKey);

    const ok = verifier.verify({
      walletAddress: address,
      challenge: tampered,
      signature,
      publicKey,
    });

    expect(ok).toBe(false);
  });

  it("rejects garbage signature gracefully (no throw)", () => {
    const { publicKey, address } = newWallet();
    const ok = verifier.verify({
      walletAddress: address,
      challenge: "anything",
      signature: "DEADBEEF",
      publicKey,
    });
    expect(ok).toBe(false);
  });
});
