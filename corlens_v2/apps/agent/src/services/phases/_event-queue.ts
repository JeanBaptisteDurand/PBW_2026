import type { SafePathEvent } from "./types.js";

export class EventQueue {
  private buf: SafePathEvent[] = [];
  private waiter: (() => void) | null = null;
  private done = false;

  push(e: SafePathEvent): void {
    this.buf.push(e);
    const w = this.waiter;
    this.waiter = null;
    w?.();
  }

  end(): void {
    this.done = true;
    const w = this.waiter;
    this.waiter = null;
    w?.();
  }

  async *drain(): AsyncGenerator<SafePathEvent> {
    while (true) {
      while (this.buf.length > 0) {
        const next = this.buf.shift();
        if (next) yield next;
      }
      if (this.done) return;
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
    }
  }
}
