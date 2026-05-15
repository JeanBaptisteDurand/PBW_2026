import type { identity as id } from "@corlens/contracts";
import { fetchJSON } from "./client.js";

type LoginChallengeResponse = id.LoginChallengeResponse;
type LoginVerifyResponse = id.LoginVerifyResponse;
type PaymentInfoResponse = id.PaymentInfoResponse;
type CreatePaymentResponse = id.CreatePaymentResponse;
type PaymentStatusResponse = id.PaymentStatusResponse;

export type ProfileResponse = {
  id: string;
  walletAddress: string;
  role: "free" | "premium" | "api-key";
  apiKey: string | null;
  createdAt: string;
  updatedAt: string;
  subscriptions: Array<{
    id: string;
    txHash: string;
    amount: string;
    currency: string;
    paidAt: string;
  }>;
  analyses: Array<{
    id: string;
    status: string;
    seedAddress: string;
    seedLabel?: string;
    depth: number;
    error?: string;
    createdAt: string;
  }>;
};

export const identityApi = {
  loginChallenge(walletAddress: string): Promise<LoginChallengeResponse> {
    return fetchJSON<LoginChallengeResponse>("/auth/login/challenge", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
  },

  loginVerify(input: {
    walletAddress: string;
    challenge: string;
    signature: string;
    publicKey: string;
  }): Promise<LoginVerifyResponse> {
    return fetchJSON<LoginVerifyResponse>("/auth/login/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  refresh(): Promise<{ token: string }> {
    return fetchJSON<{ token: string }>("/auth/refresh", { method: "POST" });
  },

  getProfile(): Promise<ProfileResponse> {
    return fetchJSON<ProfileResponse>("/auth/profile");
  },

  generateApiKey(force = false): Promise<{ apiKey: string }> {
    return fetchJSON<{ apiKey: string }>(`/auth/api-key${force ? "?force=true" : ""}`, {
      method: "POST",
    });
  },

  revokeApiKey(): Promise<{ ok: boolean }> {
    return fetchJSON<{ ok: boolean }>("/auth/api-key", { method: "DELETE" });
  },

  getPaymentInfo(): Promise<PaymentInfoResponse> {
    return fetchJSON<PaymentInfoResponse>("/payment/info");
  },

  createPaymentRequest(currency: "XRP" | "RLUSD" = "XRP"): Promise<CreatePaymentResponse> {
    return fetchJSON<CreatePaymentResponse>("/payment/create", {
      method: "POST",
      body: JSON.stringify({ currency }),
    });
  },

  getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    return fetchJSON<PaymentStatusResponse>(`/payment/status/${paymentId}`);
  },

  demoPay(paymentId: string): Promise<{ txHash: string }> {
    return fetchJSON<{ txHash: string }>("/payment/demo-pay", {
      method: "POST",
      body: JSON.stringify({ paymentId }),
    });
  },
};
