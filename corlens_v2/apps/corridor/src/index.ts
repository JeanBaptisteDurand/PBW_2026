import { buildApp } from "./app.js";
import { loadCorridorEnv } from "./env.js";

async function main() {
  const env = loadCorridorEnv();
  const app = await buildApp(env);
  const shutdown = async () => { app.log.info("shutting down"); await app.close(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  try { await app.listen({ host: env.HOST, port: env.PORT }); } catch (err) { app.log.error({ err }, "failed to start"); process.exit(1); }
}
main().catch((err) => { console.error(err); process.exit(1); });
