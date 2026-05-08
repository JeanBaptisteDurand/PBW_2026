import { events as eventContracts } from "@corlens/contracts";

export type EventName = eventContracts.EventName;
export type EventPayload<E extends EventName> = eventContracts.EventPayload<E>;

export type EventHandler<E extends EventName> = (payload: EventPayload<E>) => Promise<void> | void;

export interface EventBus {
  publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void>;
  subscribe<E extends EventName>(name: E, handler: EventHandler<E>): void;
  close(): Promise<void>;
}

export { InMemoryEventBus } from "./in-memory.js";
export { HttpFanoutEventBus } from "./http-fanout.js";
