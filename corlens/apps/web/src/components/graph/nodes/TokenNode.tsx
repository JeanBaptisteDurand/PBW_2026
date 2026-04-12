import { Handle, Position, type NodeProps } from "reactflow";
import type { GraphNode, TokenNodeData } from "@corlens/core";
import { NODE_COLORS } from "@corlens/core";
import { formatNumber } from "../../../lib/utils";
import { RiskBadge } from "../RiskBadge";

type TokenNodeProps = NodeProps<GraphNode & { data: TokenNodeData }>;

export default function TokenNode({ data, selected }: TokenNodeProps) {
  const { data: nodeData, riskFlags, label } = data;
  const borderColor = NODE_COLORS.token;

  return (
    <div
      style={{
        border: `1.5px solid ${selected ? "#f59e0b" : borderColor + "80"}`,
        borderRadius: 8,
        background: "#0f172a",
        maxWidth: 160,
        minWidth: 120,
        fontSize: 11,
        color: "#e2e8f0",
        position: "relative",
        boxShadow: selected ? `0 0 12px ${borderColor}50` : "none",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor }} />

      <RiskBadge riskFlags={riskFlags} />

      {/* Header */}
      <div
        style={{
          background: borderColor + "20",
          borderBottom: `1px solid ${borderColor}30`,
          borderRadius: "6px 6px 0 0",
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700, letterSpacing: 1 }}>
          TOKEN
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#f8fafc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nodeData.currency || label}
        </div>

        {nodeData.totalSupply && (
          <div style={{ color: "#94a3b8", fontSize: 10 }}>
            Supply: <span style={{ color: "#e2e8f0" }}>{formatNumber(nodeData.totalSupply)}</span>
          </div>
        )}

        {typeof nodeData.trustLineCount === "number" && (
          <div style={{ color: "#94a3b8", fontSize: 10 }}>
            Trust lines:{" "}
            <span style={{ color: "#e2e8f0" }}>
              {formatNumber(nodeData.trustLineCount)}
            </span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor }} />
    </div>
  );
}
