import { Handle, Position, type NodeProps } from "reactflow";
import type { GraphNode } from "@xrplens/core";
import { NODE_COLORS } from "@xrplens/core";
import { shortenAddress } from "../../../lib/utils";
import { RiskBadge } from "../RiskBadge";

type AccountNodeProps = NodeProps<GraphNode>;

export default function AccountNode({ data, selected }: AccountNodeProps) {
  const { data: nodeData, riskFlags, label, kind } = data;
  const borderColor = NODE_COLORS[kind] ?? NODE_COLORS.account;

  // Safely extract address — not all fallback node kinds have it
  const address = (nodeData as any)?.address as string | undefined;
  const tag = (nodeData as any)?.tag as string | undefined;
  const domain = (nodeData as any)?.domain as string | undefined;

  const displayLabel = label && address && label !== address ? label : null;

  return (
    <div
      style={{
        border: `1.5px solid ${selected ? "#6b7280" : borderColor + "70"}`,
        borderRadius: 8,
        background: "#0f172a",
        minWidth: 130,
        maxWidth: 160,
        fontSize: 11,
        color: "#e2e8f0",
        position: "relative",
        boxShadow: selected ? `0 0 10px ${borderColor}50` : "none",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor }} />

      <RiskBadge riskFlags={riskFlags} />

      {/* Header */}
      <div
        style={{
          background: borderColor + "15",
          borderBottom: `1px solid ${borderColor}25`,
          borderRadius: "6px 6px 0 0",
          padding: "4px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 9, color: borderColor, fontWeight: 700, letterSpacing: 1 }}>
          {kind.toUpperCase()}
        </span>
        {tag && (
          <span
            style={{
              fontSize: 8,
              color: "#0ea5e9",
              fontWeight: 600,
              background: "#0ea5e920",
              padding: "1px 4px",
              borderRadius: 4,
            }}
          >
            {tag}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
        {displayLabel && (
          <div style={{ fontSize: 11, fontWeight: 600, color: "#f8fafc" }}>
            {displayLabel}
          </div>
        )}

        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "#64748b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {address ? shortenAddress(address, 7) : label}
        </div>

        {domain && (
          <div style={{ color: "#94a3b8", fontSize: 9 }}>{domain}</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor }} />
    </div>
  );
}
