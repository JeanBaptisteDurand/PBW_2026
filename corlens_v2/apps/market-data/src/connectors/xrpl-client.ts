import { Client } from "xrpl";

export interface XrplClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  request(command: string, params?: Record<string, unknown>): Promise<unknown>;
  pathFind(params: Record<string, unknown>): Promise<unknown>;
}

export type ClientFactory = (url: string, options: { timeout: number }) => Client;

export type XrplClientOptions = {
  primaryEndpoints: string[];
  pathfindEndpoints: string[];
  rateLimitIntervalMs: number;
  clientFactory?: ClientFactory;
  maxConnectRetries?: number;
  connectRetryBaseMs?: number;
  requestRetryCount?: number;
  requestRetryDelayMs?: number;
  loadWarningBackoffMs?: number;
  loadWarningResetMs?: number;
};

const defaultFactory: ClientFactory = (url, opts) => new Client(url, opts);

export function createXrplClient(opts: XrplClientOptions): XrplClient {
  const factory = opts.clientFactory ?? defaultFactory;
  const maxConnectRetries = opts.maxConnectRetries ?? 3;
  const connectRetryBaseMs = opts.connectRetryBaseMs ?? 2_000;
  const requestRetryCount = opts.requestRetryCount ?? 2;
  const requestRetryDelayMs = opts.requestRetryDelayMs ?? 1_000;
  const loadWarningBackoffMs = opts.loadWarningBackoffMs ?? 2_000;
  const loadWarningResetMs = opts.loadWarningResetMs ?? 10_000;

  let primary: Client | null = null;
  let pathfind: Client | null = null;
  let primaryLast = 0;
  let pathfindLast = 0;
  let loadWarningActive = false;

  async function connectWithFallback(endpoints: string[]): Promise<Client> {
    for (let i = 0; i < endpoints.length; i++) {
      const url = endpoints[i] as string;
      for (let attempt = 1; attempt <= maxConnectRetries; attempt++) {
        try {
          const client = factory(url, { timeout: 30_000 });
          await client.connect();
          if (!client.isConnected()) throw new Error("dropped after connect");
          return client;
        } catch (err) {
          if (attempt < maxConnectRetries) {
            const delay = connectRetryBaseMs * 2 ** (attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          if (i === endpoints.length - 1) throw err;
        }
      }
    }
    throw new Error("all endpoints exhausted");
  }

  async function rateLimited(
    client: Client,
    lastRef: { v: number },
    command: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const interval = loadWarningActive ? loadWarningBackoffMs : opts.rateLimitIntervalMs;
    const elapsed = Date.now() - lastRef.v;
    if (elapsed < interval) {
      await new Promise((r) => setTimeout(r, interval - elapsed));
    }
    lastRef.v = Date.now();

    for (let attempt = 1; attempt <= requestRetryCount; attempt++) {
      try {
        const resp = (await client.request({ command, ...params } as never)) as { warning?: string };
        if (resp?.warning === "load") {
          loadWarningActive = true;
          setTimeout(() => { loadWarningActive = false; }, loadWarningResetMs);
        } else if (loadWarningActive) {
          loadWarningActive = false;
        }
        return resp;
      } catch (err) {
        const msg = (err as Error).message ?? "";
        const transient = ["WebSocket is not open", "CONNECTING", "IP limit", "threshold exceeded", "overloaded"].some(
          (s) => msg.includes(s),
        );
        if (!transient || attempt >= requestRetryCount) throw err;
        await new Promise((r) => setTimeout(r, requestRetryDelayMs * attempt));
      }
    }
    throw new Error(`all retries failed for ${command}`);
  }

  return {
    async connect() {
      primary = await connectWithFallback(opts.primaryEndpoints);
      if (opts.pathfindEndpoints.join(",") === opts.primaryEndpoints.join(",")) {
        pathfind = primary;
      } else {
        try {
          pathfind = await connectWithFallback(opts.pathfindEndpoints);
        } catch {
          // fall back to using primary for path-finding when dedicated endpoints fail
          pathfind = primary;
        }
      }
    },
    async disconnect() {
      await Promise.allSettled([
        primary?.disconnect(),
        pathfind && pathfind !== primary ? pathfind.disconnect() : Promise.resolve(),
      ]);
      primary = null;
      pathfind = null;
    },
    isConnected() {
      return !!primary?.isConnected() && !!pathfind?.isConnected();
    },
    async request(command, params) {
      if (!primary) throw new Error("not connected");
      const lastRef = { v: primaryLast };
      const result = await rateLimited(primary, lastRef, command, params);
      primaryLast = lastRef.v;
      return result;
    },
    async pathFind(params) {
      if (!pathfind) throw new Error("not connected");
      const lastRef = { v: pathfindLast };
      const result = await rateLimited(pathfind, lastRef, "ripple_path_find", params);
      pathfindLast = lastRef.v;
      return result;
    },
  };
}
