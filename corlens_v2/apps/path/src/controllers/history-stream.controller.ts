import { path as pp } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { HistoryService } from "../services/history.service.js";

export async function registerHistoryStreamRoutes(
  app: FastifyInstance,
  history: HistoryService,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    "/api/history/stream",
    {
      schema: {
        querystring: pp.HistoryStreamQuery,
        hide: true,
      },
    },
    async (req, reply) => {
      reply.hijack();
      const res = reply.raw;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      const sock = res.socket as { setNoDelay?: (b: boolean) => void } | null;
      if (sock && typeof sock.setNoDelay === "function") sock.setNoDelay(true);
      res.flushHeaders();
      // Initial 2 KB comment frame to flush past Vite / proxy buffering.
      res.write(`:${" ".repeat(2048)}\n\n`);

      const controller = new AbortController();
      // Use req.raw.on("close") and NOT req.on("close") — the Fastify wrapper
      // emits close on body-parse completion and would silently kill the
      // generator before the first event is sent.
      req.raw.on("close", () => controller.abort());

      const heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(": keep-alive\n\n");
      }, 15_000);

      const send = (ev: pp.HistoryEvent): void => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      };

      const { address, depth, maxTx, sinceDays } = req.query;

      try {
        for await (const ev of history.stream(address, {
          depth,
          maxTx,
          sinceDays,
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break;
          send(ev);
        }
      } catch (err) {
        send({
          type: "fatal_error",
          error: err instanceof Error ? err.message : "stream failed",
        });
      } finally {
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      }
    },
  );
}
