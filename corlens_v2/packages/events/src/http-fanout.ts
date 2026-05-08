import { events as eventContracts } from "@corlens/contracts";
import type { EventBus, EventHandler, EventName, EventPayload } from "./index.js";

export type HttpFanoutOptions = {
  subscribers: Partial<Record<EventName, string[]>>;
  fetch?: typeof fetch;
  signal?: (body: string) => Record<string, string>;
};

export class HttpFanoutEventBus implements EventBus {
  private readonly subscribers: Partial<Record<EventName, string[]>>;
  private readonly fetchImpl: typeof fetch;
  private readonly signal?: (body: string) => Record<string, string>;

  constructor(opts: HttpFanoutOptions) {
    this.subscribers = opts.subscribers;
    this.fetchImpl = opts.fetch ?? fetch;
    this.signal = opts.signal;
  }

  subscribe<E extends EventName>(_name: E, _handler: EventHandler<E>): void {
    // Cross-process delivery is HTTP — the subscriber lives in another service
    // and exposes its own /events endpoint. In-process subscribers should use
    // InMemoryEventBus.
  }

  async publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void> {
    const schema = eventContracts.EventRegistry[name];
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new Error(`Invalid payload for ${name}: ${result.error.message}`);
    }
    const urls = this.subscribers[name] ?? [];
    if (urls.length === 0) return;

    const body = JSON.stringify({ name, payload });
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(this.signal ? this.signal(body) : {}),
    };

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          await this.fetchImpl(url, { method: "POST", headers, body });
        } catch {
          // intentionally swallow — best-effort delivery; future Redis Streams
          // adapter handles durability and retries
        }
      }),
    );
  }

  async close(): Promise<void> {}
}
