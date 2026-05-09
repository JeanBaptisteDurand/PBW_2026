import type { MarketDataClient } from "../connectors/market-data.js";
import { computeStatus } from "./status-compute.service.js";

export type ScanInput = {
  id: string;
  source: { currency: string; issuer?: string } | null;
  dest: { currency: string; issuer?: string } | null;
  amount: string | null;
};

export type ScanResult = {
  corridorId: string;
  status: "GREEN" | "AMBER" | "RED" | "UNKNOWN";
  pathCount: number;
  recRiskScore: number | null;
  recCost: string | null;
  flagsJson: unknown;
  routesJson: unknown;
  liquidityJson: unknown;
  error: string | null;
};

export type ScannerServiceOptions = {
  marketData: MarketDataClient;
  timeoutMs: number;
};

export type ScannerService = ReturnType<typeof createScannerService>;

export function createScannerService(opts: ScannerServiceOptions) {
  return {
    async scan(input: ScanInput): Promise<ScanResult> {
      if (!input.source || !input.dest || !input.amount) {
        return {
          corridorId: input.id,
          status: "RED",
          pathCount: 0,
          recRiskScore: null,
          recCost: null,
          flagsJson: { reason: "missing_source_or_dest" },
          routesJson: [],
          liquidityJson: null,
          error: "missing_source_or_dest",
        };
      }

      try {
        const result = (await Promise.race([
          opts.marketData.pathFind({
            sourceAccount: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
            destinationAccount: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
            destinationAmount:
              input.dest.currency === "XRP"
                ? input.amount
                : {
                    currency: input.dest.currency,
                    issuer: input.dest.issuer ?? "",
                    value: input.amount,
                  },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("scan_timeout")), opts.timeoutMs),
          ),
        ])) as { result?: { alternatives?: unknown[] } };

        const pathCount = (result.result?.alternatives ?? []).length;
        const status = computeStatus({ pathCount, hasError: false, lastRefreshedAt: new Date() });
        return {
          corridorId: input.id,
          status,
          pathCount,
          recRiskScore: null,
          recCost: null,
          flagsJson: [],
          routesJson: result.result?.alternatives ?? [],
          liquidityJson: null,
          error: null,
        };
      } catch (err) {
        return {
          corridorId: input.id,
          status: "RED",
          pathCount: 0,
          recRiskScore: null,
          recCost: null,
          flagsJson: { reason: (err as Error).message },
          routesJson: [],
          liquidityJson: null,
          error: (err as Error).message,
        };
      }
    },
  };
}
