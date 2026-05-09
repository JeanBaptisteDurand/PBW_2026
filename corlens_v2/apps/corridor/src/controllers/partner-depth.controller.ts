import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { MarketDataClient } from "../connectors/market-data.js";

export async function registerPartnerDepthRoutes(
  app: FastifyInstance,
  marketData: MarketDataClient,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    "/api/corridors/partner-depth/:actor/:book",
    {
      schema: {
        params: z.object({ actor: z.string(), book: z.string() }),
        response: { 200: z.object({}).passthrough() },
        tags: ["corridor"],
      },
    },
    async (req) =>
      marketData.partnerDepth(req.params.actor, req.params.book) as Promise<
        Record<string, unknown>
      >,
  );
}
