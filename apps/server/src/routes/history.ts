// xrplens/apps/server/src/routes/history.ts
import { Router, type IRouter } from "express";
import { z } from "zod";
import { logger } from "../logger.js";
import { createXRPLClient } from "../xrpl/client.js";
import { streamHistory } from "../analysis/historyOrchestrator.js";
import type { HistoryEvent } from "../analysis/historyTypes.js";

export const historyRouter: IRouter = Router();

// XRPL classic address: base58, 25-35 chars, starts with 'r'.
const addressRe = /^r[a-zA-Z0-9]{24,34}$/;

const QuerySchema = z.object({
  address: z.string().regex(addressRe, "invalid XRPL address"),
  depth: z.coerce.number().int().min(1).max(3).default(2),
  maxTx: z.coerce.number().int().min(1).max(500).default(200),
  sinceDays: z.coerce.number().int().min(1).max(90).default(30),
});

historyRouter.get("/stream", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid query" });
    return;
  }
  const { address, depth, maxTx, sinceDays } = parsed.data;

  // SSE headers (same pattern as safe-path.ts — do NOT use req.on("close"),
  // use res.on("close") because req close fires on POST body parse completion
  // and would silently drop every event).
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.socket && typeof (res.socket as any).setNoDelay === "function") {
    (res.socket as any).setNoDelay(true);
  }
  res.flushHeaders();
  // Initial comment frame to flush past Vite / proxy buffering.
  res.write(":" + " ".repeat(2048) + "\n\n");

  const sendEvent = (event: HistoryEvent) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (typeof (res as any).flush === "function") (res as any).flush();
    } catch (err: any) {
      logger.warn("[history] SSE write failed", { error: err?.message });
    }
  };

  const controller = new AbortController();
  res.on("close", () => {
    controller.abort();
    logger.info("[history] client disconnected mid-stream", { address });
  });

  // Heartbeat every 15s so the EventSource connection and any intermediate
  // proxy do not time out while long crawls are in flight.
  const heartbeat = setInterval(() => {
    try {
      if (!res.writableEnded) {
        res.write(": keep-alive\n\n");
        if (typeof (res as any).flush === "function") (res as any).flush();
      }
    } catch {
      /* ignore */
    }
  }, 15_000);

  const client = createXRPLClient();
  try {
    await client.connect();
    for await (const ev of streamHistory(client, address, {
      depth,
      maxTx,
      sinceDays,
      signal: controller.signal,
    })) {
      if (controller.signal.aborted) break;
      sendEvent(ev);
    }
  } catch (err: any) {
    logger.error("[history] stream failed", { error: err?.message });
    sendEvent({ type: "fatal_error", error: err?.message ?? "stream failed" });
  } finally {
    clearInterval(heartbeat);
    try {
      await client.disconnect();
    } catch {
      /* ignore */
    }
    res.end();
  }
});
