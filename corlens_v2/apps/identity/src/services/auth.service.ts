import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { WalletVerifier } from "../connectors/wallet-verifier.js";
import type { UserRepo } from "../repositories/user.repo.js";
import type { JwtService } from "./jwt.service.js";

export type AuthServiceOptions = {
  users: UserRepo;
  verifier: WalletVerifier;
  jwt: JwtService;
  redis: Redis;
  challengeTtlSeconds: number;
};

export type AuthService = ReturnType<typeof createAuthService>;

function challengeKey(walletAddress: string): string {
  return `auth:challenge:${walletAddress}`;
}

function buildChallenge(walletAddress: string, nonce: string): string {
  const issued = new Date().toISOString();
  return `Sign in to CORLens\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nIssued: ${issued}`;
}

export function createAuthService(opts: AuthServiceOptions) {
  return {
    async issueChallenge(input: { walletAddress: string }): Promise<{
      challenge: string;
      expiresAt: string;
    }> {
      const nonce = randomUUID();
      const challenge = buildChallenge(input.walletAddress, nonce);
      await opts.redis.set(
        challengeKey(input.walletAddress),
        challenge,
        "EX",
        opts.challengeTtlSeconds,
      );
      const expiresAt = new Date(Date.now() + opts.challengeTtlSeconds * 1000).toISOString();
      return { challenge, expiresAt };
    },

    async verifyAndLogin(input: {
      walletAddress: string;
      challenge: string;
      signature: string;
      publicKey: string;
    }): Promise<{
      token: string;
      user: { id: string; walletAddress: string; role: "free" | "premium" };
    }> {
      const stored = await opts.redis.get(challengeKey(input.walletAddress));
      if (!stored) {
        throw new Error("no_challenge");
      }
      if (stored !== input.challenge) {
        throw new Error("challenge_mismatch");
      }

      const ok = opts.verifier.verify({
        walletAddress: input.walletAddress,
        challenge: input.challenge,
        signature: input.signature,
        publicKey: input.publicKey,
      });
      if (!ok) {
        throw new Error("bad_signature");
      }

      const user = await opts.users.upsertByWallet(input.walletAddress);
      await opts.redis.del(challengeKey(input.walletAddress));

      const token = opts.jwt.sign({
        userId: user.id,
        walletAddress: user.walletAddress,
        role: user.role,
      });

      return {
        token,
        user: { id: user.id, walletAddress: user.walletAddress, role: user.role },
      };
    },
  };
}
