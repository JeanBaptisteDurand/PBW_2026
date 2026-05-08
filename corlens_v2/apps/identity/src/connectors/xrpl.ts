import { Client, Wallet, convertStringToHex, xrpToDrops } from "xrpl";

const RLUSD_HEX = "524C555344000000000000000000000000000000";

export interface XrplPaymentClient {
  pollIncomingByMemo(input: {
    destination: string;
    memo: string;
  }): Promise<{ txHash: string; sourceAccount: string } | null>;

  submitDemoPayment(input: {
    demoWalletSecret: string;
    destination: string;
    memo: string;
    amount: string;
    currency: "XRP" | "RLUSD";
  }): Promise<{ txHash: string }>;

  close(): Promise<void>;
}

export function createXrplPaymentClient(opts: { rpcUrl: string }): XrplPaymentClient {
  let client: Client | null = null;
  async function getClient(): Promise<Client> {
    if (client?.isConnected()) return client;
    if (client) {
      try { await client.disconnect(); } catch {}
    }
    client = new Client(opts.rpcUrl);
    await client.connect();
    return client;
  }

  return {
    async pollIncomingByMemo({ destination, memo }) {
      const c = await getClient();
      const resp = await c.request({
        command: "account_tx",
        account: destination,
        limit: 20,
      });
      const txs = ((resp.result as { transactions?: unknown[] }).transactions ?? []) as unknown[];
      for (const entry of txs) {
        const e = entry as { tx_json?: { TransactionType?: string; Destination?: string; Account?: string; Memos?: unknown[] }; tx?: unknown; hash?: string };
        const tx = e.tx_json ?? (e.tx as typeof e.tx_json | undefined);
        if (!tx || tx.TransactionType !== "Payment") continue;
        if (tx.Destination !== destination) continue;
        const memos = (tx.Memos ?? []) as Array<{ Memo?: { MemoData?: string } }>;
        for (const m of memos) {
          const data = m.Memo?.MemoData;
          if (!data) continue;
          const decoded = Buffer.from(data, "hex").toString("utf-8");
          if (decoded === memo) {
            const hash = e.hash ?? (tx as { hash?: string }).hash;
            if (!hash) continue;
            return { txHash: hash, sourceAccount: tx.Account ?? "" };
          }
        }
      }
      return null;
    },

    async submitDemoPayment({ demoWalletSecret, destination, memo, amount, currency }) {
      const c = await getClient();
      const wallet = Wallet.fromSeed(demoWalletSecret);

      const blob: Record<string, unknown> = {
        TransactionType: "Payment",
        Account: wallet.address,
        Destination: destination,
        Memos: [{ Memo: { MemoData: convertStringToHex(memo), MemoType: convertStringToHex("text/plain") } }],
      };
      if (currency === "XRP") {
        blob.Amount = xrpToDrops(amount);
      } else {
        blob.Amount = { currency: RLUSD_HEX, issuer: destination, value: amount };
      }
      const prepared = await c.autofill(blob as unknown as Parameters<typeof c.autofill>[0]);
      const signed = wallet.sign(prepared);
      const result = await c.submitAndWait(signed.tx_blob);
      const hash = (result.result as { hash?: string }).hash ?? signed.hash;
      return { txHash: hash };
    },

    async close() {
      if (client) {
        try { await client.disconnect(); } catch {}
        client = null;
      }
    },
  };
}
