import { events as eventContracts } from "@corlens/contracts";
import type { EventBus, EventHandler, EventName, EventPayload } from "./index.js";

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<EventName, Set<EventHandler<EventName>>>();

  subscribe<E extends EventName>(name: E, handler: EventHandler<E>): void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as EventHandler<EventName>);
  }

  async publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void> {
    const schema = eventContracts.EventRegistry[name];
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new Error(`Invalid payload for ${name}: ${result.error.message}`);
    }
    const set = this.handlers.get(name);
    if (!set) return;
    await Promise.allSettled(
      [...set].map(async (h) => {
        await (h as EventHandler<E>)(payload);
      }),
    );
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}
