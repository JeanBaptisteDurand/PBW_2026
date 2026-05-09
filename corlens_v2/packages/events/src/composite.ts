import type { EventBus, EventHandler, EventName, EventPayload } from "./index.js";

export class CompositeEventBus implements EventBus {
  private readonly buses: readonly EventBus[];

  constructor(buses: readonly EventBus[]) {
    this.buses = buses;
  }

  subscribe<E extends EventName>(name: E, handler: EventHandler<E>): void {
    for (const bus of this.buses) {
      bus.subscribe(name, handler);
    }
  }

  async publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void> {
    await Promise.all(this.buses.map((b) => b.publish(name, payload)));
  }

  async close(): Promise<void> {
    await Promise.all(this.buses.map((b) => b.close()));
  }
}
