import { Router, type IRouter } from "express";
import { logger } from "../logger.js";
import { createXRPLClient } from "../xrpl/client.js";
import { analyzeCorridors } from "../analysis/corridorAnalyzer.js";
import type { CorridorRequest } from "@corlens/core";

export const corridorRouter: IRouter = Router();

// POST /api/corridor — Analyze payment corridor
corridorRouter.post("/", async (req, res) => {
  try {
    const { sourceCurrency, sourceIssuer, destCurrency, destIssuer, amount, sourceAccount } =
      req.body ?? {};

    if (!destCurrency || !destIssuer || !amount) {
      res.status(400).json({
        error: "destCurrency, destIssuer, and amount are required",
      });
      return;
    }

    const request: CorridorRequest = {
      sourceCurrency: sourceCurrency ?? "XRP",
      sourceIssuer,
      destCurrency,
      destIssuer,
      amount: String(amount),
      sourceAccount,
    };

    const client = createXRPLClient();
    try {
      await client.connect();
      const result = await analyzeCorridors(client, request);
      res.json(result);
    } finally {
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
    }
  } catch (err: any) {
    logger.error("[corridor] Analysis failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});
