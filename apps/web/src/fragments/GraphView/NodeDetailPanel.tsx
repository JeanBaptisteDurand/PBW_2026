import type { GraphNode } from "@xrplens/core";
import { NODE_COLORS } from "@xrplens/core";

interface NodeDetailPanelProps {
  node: GraphNode;
  onClose: () => void;
}

function severityClasses(severity: string) {
  if (severity === "HIGH") {
    return {
      border: "border-red-500/25",
      text: "text-red-400",
    };
  }
  if (severity === "MED") {
    return {
      border: "border-amber-500/25",
      text: "text-amber-400",
    };
  }
  return {
    border: "border-slate-500/25",
    text: "text-slate-400",
  };
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const borderColor =
    NODE_COLORS[node.kind] ?? "var(--token-colors-border-default)";

  return (
    <div className="absolute right-0 top-0 z-20 h-full w-[var(--token-layout-nodeDetailWidth)] overflow-y-auto border-l border-slate-800 bg-slate-950">
      <div
        className="flex items-start justify-between border-b-2 bg-slate-900 px-4 py-3"
        style={{ borderColor }}
      >
        <div>
          <div
            className="mb-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: borderColor }}
          >
            {node.kind}
          </div>
          <div className="text-[13px] font-semibold text-slate-50">
            {node.label}
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-1 text-lg leading-none text-slate-500 hover:text-slate-200"
        >
          ×
        </button>
      </div>

      {node.riskFlags.length > 0 && (
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            Risk Flags ({node.riskFlags.length})
          </div>
          {node.riskFlags.map((flag, idx) => {
            const classes = severityClasses(flag.severity);
            return (
              <div
                key={`${flag.flag}-${idx}`}
                className={`mb-1.5 rounded-md border bg-slate-900 px-2 py-1.5 ${classes.border}`}
              >
                <div
                  className={`mb-0.5 text-[11px] font-semibold ${classes.text}`}
                >
                  {flag.flag}
                </div>
                <div className="text-[11px] text-slate-400">{flag.detail}</div>
              </div>
            );
          })}
        </div>
      )}

      {node.aiExplanation && (
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            <span className="text-xs">&#x1F916;</span> AI Analysis
          </div>
          <div className="rounded-lg border border-indigo-500/25 bg-app-bg-secondary p-3 text-xs leading-relaxed text-slate-300">
            {node.aiExplanation}
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
          Node Data
        </div>
        <pre className="overflow-auto whitespace-pre-wrap break-all rounded-md border border-slate-800 bg-slate-900 p-2.5 text-[11px] text-slate-500">
          {JSON.stringify(node.data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
