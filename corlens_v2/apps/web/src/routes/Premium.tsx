import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../auth/useAuth.js";
import { api } from "../api/index.js";
import sdk from "@crossmarkio/sdk";

type PaymentStep = "choose" | "paying" | "confirming" | "done";

// Convert a string to hex (for XRPL Memo fields)
function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export default function Premium() {
  const navigate = useNavigate();
  const { user, token, connect, refresh, isPremium } = useAuth();
  const [step, setStep] = useState<PaymentStep>("choose");
  const currency = "XRP" as const;
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoWallet, setDemoWallet] = useState("");
  const [crossmarkAvailable, setCrossmarkAvailable] = useState(false);

  // Check if Crossmark is installed
  useEffect(() => {
    const checkCrossmark = async () => {
      try {
        const detected = await sdk.methods.isInstalled();
        setCrossmarkAvailable(Boolean(detected));
      } catch {
        setCrossmarkAvailable(false);
      }
    };
    // Small delay to let extension inject
    setTimeout(checkCrossmark, 500);
  }, []);

  // Fetch demo wallet address on mount (don't auto-connect — wait for user action)
  useEffect(() => {
    api
      .getPaymentInfo()
      .then((info) => {
        setDemoWallet(info.demoWalletAddress);
      })
      .catch(() => {});
  }, []);

  // Poll for payment confirmation
  useEffect(() => {
    if (step !== "confirming" || !paymentId) return;
    const interval = setInterval(async () => {
      try {
        const result = await api.getPaymentStatus(paymentId);
        if (result.status === "confirmed") {
          setTxHash(result.txHash ?? null);
          setStep("done");
          await refresh();
          clearInterval(interval);
        } else if (result.status === "expired") {
          setError("Payment expired. Please try again.");
          setStep("choose");
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [step, paymentId, refresh]);

  // Pay with Crossmark wallet extension
  const handleCrossmarkPay = useCallback(async () => {
    setError(null);
    try {
      // Step 1: Sign in with Crossmark to get the wallet address
      const signIn = await sdk.methods.signInAndWait();
      const walletAddress = signIn?.response?.data?.address;
      if (!walletAddress) throw new Error("Crossmark sign-in cancelled");

      // Step 2: Verified login via Crossmark SIWE — reuses the just-acquired
      // sign-in session, no second popup. (v1 passed `walletAddress`; v2's
      // SIWE flow discovers it via `sdk.sync.getAddress`.)
      await connect();

      setStep("paying");

      // Step 3: Create a payment request on our server
      const request = await api.createPaymentRequest(currency);
      setPaymentId(request.paymentId);

      // Step 4: Build the Payment transaction
      // Omit Account — Crossmark fills it from the signed-in wallet
      const xrpDrops = String(Number(request.amount) * 1_000_000);
      const tx: any = {
        TransactionType: "Payment",
        Destination: request.destination,
        Amount: xrpDrops,
        Memos: [
          {
            Memo: {
              MemoData: toHex(request.memo),
              MemoType: toHex("text/plain"),
            },
          },
        ],
      };

      // Step 5: Sign and submit via Crossmark
      const result = await sdk.methods.signAndSubmitAndWait(tx);
      const hash =
        (result?.response?.data?.resp?.result as any)?.hash ??
        (result?.response?.data?.resp as any)?.hash;
      if (!hash) throw new Error("Transaction rejected or failed");

      // Step 6: Poll for confirmation
      setStep("confirming");
    } catch (err: any) {
      const msg = err?.message ?? "Crossmark payment failed";
      if (!msg.includes("cancelled")) setError(msg);
      setStep("choose");
    }
  }, [currency, connect]);

  // Pay with demo wallet (server-side)
  const handleDemoPay = useCallback(async () => {
    setError(null);
    try {
      if (!token && demoWallet) {
        // v1 passed the demo wallet address directly; v2's verified flow
        // ignores the arg and prompts Crossmark.
        await connect();
      }
      setStep("paying");
      const request = await api.createPaymentRequest(currency);
      setPaymentId(request.paymentId);
      await api.demoPay(request.paymentId);
      setStep("confirming");
    } catch (err: any) {
      setError(err?.message ?? "Payment failed");
      setStep("choose");
    }
  }, [currency, token, demoWallet, connect]);

  // Already premium (and not just paid)
  if (isPremium && step !== "done") {
    return (
      <div className="app-content-min-height relative overflow-hidden">
        <div className="route-atmosphere absolute inset-0 -z-10" aria-hidden />
        <section className="mx-auto max-w-lg px-6 pt-28 pb-20 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/16 border border-emerald-500/32">
            <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">Premium Active</h1>
          <p className="mb-8 text-slate-400">All features are unlocked.</p>
          <Button size="lg" onClick={() => navigate("/safe-path")}>
            Go to Safe Path Agent
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-content-min-height relative overflow-hidden">
      <div className="route-atmosphere absolute inset-0 -z-10" aria-hidden />

      <section className="mx-auto max-w-2xl px-6 pt-20 pb-16">
        <div className="flex flex-col items-center gap-4 text-center mb-10">
          <Badge variant="info" className="px-3 py-1 text-xs">
            On-chain Payment
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Unlock Premium
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-400">
            Pay once to unlock the Safe Path Agent and Compliance PDF export.
            Payment settles on XRPL Testnet.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Price */}
        <div className="mb-8">
          <div className="app-glass-surface rounded-xl p-5 text-center border-[color:var(--page-accent-400)] bg-[color:color-mix(in_srgb,var(--page-accent-500)_8%,transparent)]">
            <h3 className="text-2xl font-bold text-slate-100">10 XRP</h3>
            <p className="mt-1 text-sm text-slate-400">One-time payment on XRPL Testnet</p>
          </div>
        </div>

        {/* Payment buttons */}
        <div className="flex flex-col gap-3">
          {/* Crossmark button — primary when available */}
          <Button
            size="lg"
            onClick={handleCrossmarkPay}
            disabled={step !== "choose" || !crossmarkAvailable}
            className="w-full py-3"
          >
            {step === "choose" &&
              `Pay ${currency === "XRP" ? "10 XRP" : "5 RLUSD"} with Crossmark`}
            {step === "paying" && "Signing transaction..."}
            {step === "confirming" && "Waiting for confirmation..."}
            {step === "done" && "Payment confirmed"}
          </Button>

          {!crossmarkAvailable && step === "choose" && (
            <p className="text-center text-xs text-slate-500">
              Crossmark extension not detected.{" "}
              <a
                href="https://crossmark.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--page-accent-400)] hover:underline"
              >
                Install Crossmark
              </a>
            </p>
          )}

          <div className="flex items-center gap-3 my-1">
            <div className="h-px flex-1 bg-slate-700/50" />
            <span className="text-xs text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-700/50" />
          </div>

          {/* Demo wallet button — always available (for testing) */}
          <Button
            variant="secondary"
            size="lg"
            onClick={handleDemoPay}
            disabled={step !== "choose"}
            className="w-full py-3"
          >
            {step === "choose" && "Pay with Demo Wallet (testnet)"}
            {step !== "choose" && ""}
          </Button>
        </div>

        {step === "confirming" && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
            <span className="inline-block h-4 w-4 border-2 border-[color:var(--page-accent-500)]/30 border-t-[color:var(--page-accent-500)] rounded-full animate-spin" />
            Checking XRPL Testnet for your transaction...
          </div>
        )}

        {step === "done" && txHash && (
          <div className="mt-6 app-glass-surface rounded-xl p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/16 border border-emerald-500/32">
              <svg
                className="h-5 w-5 text-emerald-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="mb-2 text-sm font-medium text-emerald-300">
              Payment confirmed on XRPL Testnet
            </p>
            <a
              href={`https://testnet.xrpl.org/transactions/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[color:var(--page-accent-400)] hover:underline break-all"
            >
              View on Explorer: {txHash}
            </a>
            <div className="mt-4">
              <Button size="sm" onClick={() => navigate("/safe-path")}>
                Go to Safe Path Agent
              </Button>
            </div>
          </div>
        )}

        {/* Info box */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-sm">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal ml-4 space-y-1 text-xs text-slate-400">
              <li>
                Choose your payment method — Crossmark wallet or demo wallet
              </li>
              <li>
                A real XRPL Testnet Payment transaction is signed and submitted
              </li>
              <li>We verify the on-chain payment via the transaction memo</li>
              <li>Your account is upgraded to Premium instantly</li>
            </ol>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
