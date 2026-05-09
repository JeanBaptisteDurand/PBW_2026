import fp from "fastify-plugin";
import { type XrplClient, createXrplClient } from "../connectors/xrpl-client.js";

declare module "fastify" {
  interface FastifyInstance {
    xrpl: XrplClient;
  }
}

export interface XrplPluginOptions {
  primaryEndpoints: string[];
  pathfindEndpoints: string[];
  rateLimitIntervalMs: number;
}

export const xrplPlugin = fp<XrplPluginOptions>(
  async (app, opts) => {
    const client = createXrplClient(opts);
    await client.connect();
    app.decorate("xrpl", client);
    app.addHook("onClose", async () => {
      await client.disconnect();
    });
  },
  { name: "xrpl" },
);
