import { Handle, Position, type NodeProps } from "reactflow";
import type { GraphNode, IssuerNodeData } from "@corlens/core";
import { NODE_COLORS } from "@corlens/core";
import { shortenAddress } from "../../../lib/utils";
import { RiskBadge } from "../RiskBadge";

type IssuerNodeProps = NodeProps<GraphNode & { data: IssuerNodeData }>;

export default function IssuerNode({ data, selected }: IssuerNodeProps) {
  const { data: nodeData, riskFlags, label } = data;
  const borderColor = NODE_COLORS.issuer;

  return (
    <div
      style={{
        border: `2px solid ${selected ? "#ef4444" : borderColor + "90"}`,
        borderRadius: 10,
        background: "#0f172a",
        minWidth: 180,
        maxWidth: 200,
        fontSize: 11,
        color: "#e2e8f0",
        position: "relative",
        boxShadow: selected
          ? `0 0 16px ${borderColor}60`
          : `0 0 8px ${borderColor}20`,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor }} />

      <RiskBadge riskFlags={riskFlags} />

      {/* Header */}
      <div
        style={{
          background: borderColor + "25",
          borderBottom: `1px solid ${borderColor}40`,
          borderRadius: "8px 8px 0 0",
          padding: "5px 10px",
        }}
      >
        <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700, letterSpacing: 1 }}>
          ISSUER
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#f8fafc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>

        {nodeData.domain && (
          <div style={{ color: "#94a3b8", fontSize: 10 }}>
            {nodeData.domain}
          </div>
        )}

        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "#64748b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {shortenAddress(nodeData.address, 8)}
        </div>

        {nodeData.tokens.length > 0 && (
          <div style={{ color: "#94a3b8", fontSize: 10 }}>
            Tokens:{" "}
            <span style={{ color: "#ef4444" }}>
              {nodeData.tokens.length}
            </span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor }} />
    </div>
  );
}
