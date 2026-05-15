import type { identity as id } from "@corlens/contracts";
import sdk from "@crossmarkio/sdk";
import { api } from "../api/index.js";
import { saveAuth } from "./authStorage.js";

export function isCrossmarkInstalled(): boolean {
  return Boolean(sdk.sync?.isInstalled?.());
}

async function ensureAddress(): Promise<string> {
  const known = sdk.sync.getAddress?.();
  if (known) return known;
  const res = await sdk.methods.signInAndWait();
  const address = res?.response?.data?.address;
  if (!address) throw new Error("Crossmark sign-in cancelled");
  return address;
}

async function signChallenge(challenge: string): Promise<{ signature: string; publicKey: string }> {
  const res = await sdk.methods.signInAndWait(challenge);
  const data = res?.response?.data;
  const signature = data?.signature;
  const publicKey = data?.publicKey;
  if (!signature || !publicKey) throw new Error("Crossmark did not return a signature");
  return { signature, publicKey };
}

/**
 * Crossmark SIWE flow:
 *   1. discover the wallet address (re-uses an existing session if any),
 *   2. fetch a server-issued challenge,
 *   3. ask Crossmark to sign it,
 *   4. submit the signature for JWT verification,
 *   5. persist the JWT + user locally.
 */
export async function connectCrossmark(): Promise<id.LoginVerifyResponse> {
  const walletAddress = await ensureAddress();
  const { challenge } = await api.identity.loginChallenge(walletAddress);
  const { signature, publicKey } = await signChallenge(challenge);
  const result = await api.identity.loginVerify({
    walletAddress,
    challenge,
    signature,
    publicKey,
  });
  saveAuth({ token: result.token, user: result.user });
  return result;
}
