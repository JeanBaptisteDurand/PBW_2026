import { Handle, Position, type NodeProps } from "reactflow";
import type { GraphNode, AMMPoolNodeData } from "@corlens/core";
import { NODE_COLORS } from "@corlens/core";
import { RiskBadge } from "../RiskBadge";

type AMMPoolNodeProps = NodeProps<GraphNode & { data: AMMPoolNodeData }>;

function assetLabel(asset: { currency: string; issuer?: string }): string {
  return asset.currency === "XRP" ? "XRP" : asset.currency;
}

function formatReserve(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

export default function AMMPoolNode({ data, selected }: AMMPoolNodeProps) {
  const { data: nodeData, riskFlags } = data;
  const borderColor = NODE_COLORS.ammPool;
  const pairName = `${assetLabel(nodeData.asset1)} / ${assetLabel(nodeData.asset2)}`;

  return (
    <div
      style={{
        border: `1.5px solid ${selected ? "#3b82f6" : borderColor + "80"}`,
        borderRadius: 8,
        background: "#0f172a",
        minWidth: 150,
        maxWidth: 180,
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
        }}
      >
        <span style={{ fontSize: 9, color: "#3b82f6", fontWeight: 700, letterSpacing: 1 }}>
          AMM POOL
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>
          {pairName}
        </div>

        <div style={{ color: "#94a3b8", fontSize: 10 }}>
          {assetLabel(nodeData.asset1)}:{" "}
          <span style={{ color: "#e2e8f0" }}>{formatReserve(nodeData.reserve1)}</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 10 }}>
          {assetLabel(nodeData.asset2)}:{" "}
          <span style={{ color: "#e2e8f0" }}>{formatReserve(nodeData.reserve2)}</span>
        </div>

        {typeof nodeData.lpHolderCount === "number" && (
          <div style={{ color: "#94a3b8", fontSize: 10 }}>
            LPs: <span style={{ color: "#3b82f6" }}>{nodeData.lpHolderCount}</span>
          </div>
        )}

        {typeof nodeData.tradingFee === "number" && (
          <div style={{ color: "#64748b", fontSize: 9 }}>
            Fee: {(nodeData.tradingFee / 1000).toFixed(2)}%
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor }} />
    </div>
  );
}
