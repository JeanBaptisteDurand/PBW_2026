import { deriveAddress, verify } from "ripple-keypairs";

export type WalletVerifyInput = {
  walletAddress: string;
  challenge: string;
  signature: string;
  publicKey: string;
};

export interface WalletVerifier {
  verify(input: WalletVerifyInput): boolean;
}

export class RippleKeypairsWalletVerifier implements WalletVerifier {
  verify(input: WalletVerifyInput): boolean {
    let derivedAddress: string;
    try {
      derivedAddress = deriveAddress(input.publicKey);
    } catch {
      return false;
    }
    if (derivedAddress !== input.walletAddress) return false;

    const messageHex = Buffer.from(input.challenge, "utf8").toString("hex").toUpperCase();
    try {
      return verify(messageHex, input.signature, input.publicKey);
    } catch {
      return false;
    }
  }
}
