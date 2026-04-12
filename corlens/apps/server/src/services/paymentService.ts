import { Client, Wallet, xrpToDrops, convertStringToHex } from "xrpl";
import { prisma } from "../db/client.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import crypto from "crypto";

const PRICES = { XRP: "10", RLUSD: "5" } as const;
const XRP_DROPS = xrpToDrops(PRICES.XRP);
const RLUSD_HEX = "524C555344000000000000000000000000000000";

// Memoized demo wallet address — derived once from seed
let _demoAddress: string | null = null;
export function getDemoWalletAddress(): string {
  if (_demoAddress !== null) return _demoAddress;
  if (!config.XRPL_DEMO_WALLET_SECRET) return (_demoAddress = "");
  try {
    _demoAddress = Wallet.fromSeed(config.XRPL_DEMO_WALLET_SECRET).address;
  } catch {
    _demoAddress = "";
  }
  return _demoAddress;
}

// Shared XRPL testnet client with lazy connect
let _paymentClient: Client | null = null;
async function getPaymentClient(): Promise<Client> {
  if (_paymentClient?.isConnected()) return _paymentClient;
  if (_paymentClient) {
    try { await _paymentClient.disconnect(); } catch {}
  }
  _paymentClient = new Client(config.XRPL_TESTNET_RPC);
  await _paymentClient.connect();
  return _paymentClient;
}

export async function createPaymentRequest(
  userId: string,
  currency: "XRP" | "RLUSD" = "XRP",
) {
  const memo = crypto.randomUUID();
  const amount = PRICES[currency];
  const destination = config.XRPL_PAYMENT_WALLET_ADDRESS;

  const request = await prisma.paymentRequest.create({
    data: {
      userId,
      amount,
      currency,
      destination,
      memo,
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  return { paymentId: request.id, destination, amount, currency, memo };
}

export async function checkPayment(paymentId: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
  if (!request) return { status: "not_found" as const };
  if (request.status === "confirmed") return { status: "confirmed" as const, txHash: request.txHash };

  if (new Date() > request.expiresAt) {
    await prisma.paymentRequest.update({ where: { id: paymentId }, data: { status: "expired" } });
    return { status: "expired" as const };
  }

  const client = await getPaymentClient();
  const response = await client.request({
    command: "account_tx",
    account: config.XRPL_PAYMENT_WALLET_ADDRESS,
    limit: 20,
  });

  const txs = (response.result as any).transactions ?? [];

  for (const entry of txs) {
    const tx = entry.tx_json ?? entry.tx;
    if (!tx || tx.TransactionType !== "Payment") continue;
    if (tx.Destination !== config.XRPL_PAYMENT_WALLET_ADDRESS) continue;

    const memos = tx.Memos ?? [];
    for (const m of memos) {
      const memoData = m.Memo?.MemoData;
      if (!memoData) continue;
      const decoded = Buffer.from(memoData, "hex").toString("utf-8");
      if (decoded !== request.memo) continue;

      const hash = entry.hash ?? tx.hash;

      // Confirm payment + create subscription + upgrade role atomically
      await prisma.$transaction([
        prisma.paymentRequest.update({
          where: { id: paymentId },
          data: { status: "confirmed", txHash: hash },
        }),
        prisma.premiumSubscription.create({
          data: {
            userId: request.userId,
            txHash: hash,
            amount: request.amount,
            currency: request.currency,
            walletAddress: tx.Account,
            memo: request.memo,
          },
        }),
        prisma.user.update({
          where: { id: request.userId },
          data: { role: "premium" },
        }),
      ]);

      logger.info("[payment] Payment confirmed", { paymentId, txHash: hash });
      return { status: "confirmed" as const, txHash: hash };
    }
  }

  return { status: "pending" as const };
}

export async function sendDemoPayment(paymentId: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
  if (!request) throw new Error("Payment request not found");
  if (request.status === "confirmed") throw new Error("Already paid");

  const demoWallet = Wallet.fromSeed(config.XRPL_DEMO_WALLET_SECRET);
  const client = await getPaymentClient();

  const txBlob: any = {
    TransactionType: "Payment",
    Account: demoWallet.address,
    Destination: request.destination,
    Memos: [
      {
        Memo: {
          MemoData: convertStringToHex(request.memo),
          MemoType: convertStringToHex("text/plain"),
        },
      },
    ],
  };

  if (request.currency === "XRP") {
    txBlob.Amount = XRP_DROPS;
  } else {
    txBlob.Amount = {
      currency: RLUSD_HEX,
      issuer: request.destination,
      value: request.amount,
    };
  }

  const prepared = await client.autofill(txBlob);
  const signed = demoWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const hash = (result.result as any).hash ?? signed.hash;
  logger.info("[payment] Demo payment submitted", { paymentId, hash });
  return { txHash: hash };
}
