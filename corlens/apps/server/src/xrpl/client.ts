import { Client } from "xrpl";
import { config } from "../config.js";
import { logger } from "../logger.js";

// ─── Rate Limit Configuration ───────────────────────────────────────────────
// QuickNode dedicated endpoint: 50 req/sec limit
// Fallback public nodes: ~10 req/sec (xrplcluster.com, ripple.com)
const MIN_REQUEST_INTERVAL_MS = 20; // ~50 req/sec, QuickNode dedicated endpoint
const MAX_CONNECT_RETRIES = 3;
const CONNECT_RETRY_BASE_MS = 2000;
const REQUEST_RETRY_COUNT = 2;
const REQUEST_RETRY_DELAY_MS = 1000;
const LOAD_WARNING_BACKOFF_MS = 2000; // When server sends "warning": "load"

export interface XRPLClientWrapper {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request(command: string, params?: Record<string, unknown>): Promise<unknown>;
  pathFind(params: Record<string, unknown>): Promise<unknown>;
  serverInfo(): Promise<unknown>;
  isConnected(): boolean;
}

// QuickNode primary, public nodes as fallback
const PRIMARY_ENDPOINTS = [
  config.XRPL_PRIMARY_RPC,
  "wss://xrplcluster.com",
  "wss://s2.ripple.com",
  "wss://xrpl.ws",
];

const PATHFIND_ENDPOINTS = [
  config.XRPL_PATHFIND_RPC,
  "wss://xrplcluster.com",
  "wss://s1.ripple.com",
  "wss://s2.ripple.com",
];

export function createXRPLClient(): XRPLClientWrapper {
  let primaryClient: Client;
  let pathfindClient: Client;
  let loadWarningActive = false;

  async function connectWithFallback(endpoints: string[], label: string): Promise<Client> {
    for (let i = 0; i < endpoints.length; i++) {
      const url = endpoints[i];
      for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
        try {
          logger.info(`Connecting to XRPL ${label} (${url}, attempt ${attempt})...`);
          const client = new Client(url, { timeout: 30_000 });
          await client.connect();

          // Verify connection is actually usable (xrplcluster sometimes accepts then drops)
          if (!client.isConnected()) {
            throw new Error("Connection dropped immediately after connect");
          }

          logger.info(`Connected to XRPL ${label}: ${url}`);
          return client;
        } catch (err: any) {
          const msg = err?.message ?? "";
          logger.warn(`XRPL ${label} ${url} attempt ${attempt} failed`, { error: msg });

          if (attempt === MAX_CONNECT_RETRIES && i < endpoints.length - 1) {
            logger.info(`Falling back to next endpoint for ${label}...`);
            break; // try next endpoint
          }

          if (attempt < MAX_CONNECT_RETRIES) {
            const delay = CONNECT_RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          if (attempt === MAX_CONNECT_RETRIES && i === endpoints.length - 1) {
            throw err; // all endpoints exhausted
          }
        }
      }
    }
    throw new Error(`All XRPL ${label} endpoints exhausted`);
  }

  async function rateLimitedRequest(
    client: Client,
    lastRequestRef: { value: number },
    command: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    // Enforce minimum interval between requests
    const interval = loadWarningActive ? LOAD_WARNING_BACKOFF_MS : MIN_REQUEST_INTERVAL_MS;
    const now = Date.now();
    const elapsed = now - lastRequestRef.value;
    if (elapsed < interval) {
      await new Promise((resolve) => setTimeout(resolve, interval - elapsed));
    }
    lastRequestRef.value = Date.now();

    // Request with retry
    for (let attempt = 1; attempt <= REQUEST_RETRY_COUNT; attempt++) {
      try {
        const response = await client.request(
          { command, ...params } as Parameters<Client["request"]>[0],
        );

        // Check for load warning in response
        if ((response as any)?.warning === "load") {
          logger.warn("[xrpl] Server sent load warning — backing off", { command });
          loadWarningActive = true;
          // Reset after 10 seconds
          setTimeout(() => { loadWarningActive = false; }, 10_000);
        } else if (loadWarningActive) {
          // Response came back without warning — server recovered
          loadWarningActive = false;
        }

        return response;
      } catch (err: any) {
        const msg = err?.message ?? "";
        const isTransient =
          msg.includes("WebSocket is not open") ||
          msg.includes("CONNECTING") ||
          msg.includes("IP limit") ||
          msg.includes("threshold exceeded") ||
          msg.includes("overloaded");

        if (isTransient && attempt < REQUEST_RETRY_COUNT) {
          const delay = REQUEST_RETRY_DELAY_MS * attempt + Math.random() * 500;
          logger.warn(`[xrpl] Transient error on ${command}, retrying in ${Math.round(delay)}ms`, {
            attempt,
            error: msg,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Reconnect if websocket is closed
          if (!client.isConnected()) {
            try {
              await client.connect();
              logger.info("[xrpl] Reconnected after transient error");
            } catch {
              // Will fail on next attempt
            }
          }
          continue;
        }

        throw err;
      }
    }

    throw new Error(`[xrpl] All ${REQUEST_RETRY_COUNT} attempts failed for ${command}`);
  }

  const primaryLastRef = { value: 0 };
  const pathfindLastRef = { value: 0 };

  return {
    async connect(): Promise<void> {
      primaryClient = await connectWithFallback(PRIMARY_ENDPOINTS, "primary");
      pathfindClient = await connectWithFallback(PATHFIND_ENDPOINTS, "pathfind");
    },

    async disconnect(): Promise<void> {
      logger.info("Disconnecting from XRPL nodes...");
      await Promise.allSettled([
        primaryClient?.disconnect(),
        pathfindClient?.disconnect(),
      ]);
      logger.info("Disconnected from XRPL nodes");
    },

    async request(command: string, params?: Record<string, unknown>): Promise<unknown> {
      return rateLimitedRequest(primaryClient, primaryLastRef, command, params);
    },

    async pathFind(params: Record<string, unknown>): Promise<unknown> {
      return rateLimitedRequest(pathfindClient, pathfindLastRef, "ripple_path_find", params);
    },

    async serverInfo(): Promise<unknown> {
      return rateLimitedRequest(primaryClient, primaryLastRef, "server_info", {});
    },

    isConnected(): boolean {
      return primaryClient?.isConnected() && pathfindClient?.isConnected();
    },
  };
}
