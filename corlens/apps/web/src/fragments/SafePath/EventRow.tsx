import type { SafePathEvent } from "./types";

interface EventRowProps {
  event: SafePathEvent;
}

export function EventRow({ event }: EventRowProps) {
  switch (event.type) {
    case "step":
      return (
        <div className="text-xrp-300">
          ▸ <span className="font-semibold">{event.step}</span>
          {event.detail && (
            <span className="text-slate-400"> - {event.detail}</span>
          )}
        </div>
      );
    case "tool_call":
      return (
        <div className="text-amber-300">
          ↳ <span className="font-semibold">{event.name}</span>
          <span className="text-slate-500">({JSON.stringify(event.args)})</span>
        </div>
      );
    case "tool_result":
      return (
        <div className="pl-4 text-emerald-300">
          ✓ <span className="text-slate-300">{event.summary}</span>
        </div>
      );
    case "reasoning":
      return <div className="italic text-slate-200">{event.text}</div>;
    case "result":
      return (
        <div className="font-semibold text-xrp-300">
          ★ verdict: {event.result.verdict}
        </div>
      );
    case "error":
      return <div className="text-red-400">✗ {event.error}</div>;
    default:
      return null;
  }
}
