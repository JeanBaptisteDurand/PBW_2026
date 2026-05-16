import { useState } from "react";
import { EDGE_COLORS, NODE_COLORS } from "../../lib/core-types.js";
import type { EdgeKind, NodeKind } from "../../lib/core-types.js";

const NODE_LABELS: Record<NodeKind, string> = {
  token: "Token",
  issuer: "Issuer",
  ammPool: "AMM Pool",
  orderBook: "Order Book",
  account: "Account",
  paymentPath: "Payment Path",
  escrow: "Escrow",
  check: "Check",
  payChannel: "Payment Channel",
  nft: "NFT",
  signerList: "Signer List",
  did: "DID",
  credential: "Credential",
  mpToken: "MP Token",
  oracle: "Oracle",
  depositPreauth: "Deposit Preauth",
  offer: "DEX Offer",
  permissionedDomain: "Permissioned Domain",
  nftOffer: "NFT Offer",
  ticket: "Ticket",
  bridge: "Bridge",
  vault: "Vault",
};

const EDGE_LABELS: Record<EdgeKind, string> = {
  ISSUED_BY: "Issued By",
  TRUSTS: "Trusts",
  PROVIDES_LIQUIDITY: "Provides Liquidity",
  TRADES_ON: "Trades On",
  ROUTES_THROUGH: "Routes Through",
  ESCROWS_TO: "Escrows To",
  GOVERNS: "Governs",
  POOLS_WITH: "Pools With",
  CHECKS_TO: "Checks To",
  CHANNELS_TO: "Channels To",
  OWNS_NFT: "Owns NFT",
  SIGNED_BY: "Signed By",
  HAS_DID: "Has DID",
  HAS_CREDENTIAL: "Has Credential",
  ISSUED_MPT: "Issued MPT",
  PROVIDES_ORACLE: "Provides Oracle",
  PREAUTHORIZES: "Preauthorizes",
  HAS_OFFER: "Has Offer",
  HAS_DOMAIN: "Has Domain",
  NFT_OFFER_FOR: "NFT Offer For",
  HAS_TICKET: "Has Ticket",
  HAS_BRIDGE: "Has Bridge",
  HAS_VAULT: "Has Vault",
};

export interface LegendProps {
  /** Set of node kinds currently hidden. Empty set = all visible. */
  disabledNodeKinds: Set<NodeKind>;
  /** Set of edge kinds currently hidden. Empty set = all visible. */
  disabledEdgeKinds: Set<EdgeKind>;
  /** Counts per node kind actually present in the loaded graph. */
  nodeCounts?: Partial<Record<NodeKind, number>>;
  /** Counts per edge kind actually present in the loaded graph. */
  edgeCounts?: Partial<Record<EdgeKind, number>>;
  onToggleNodeKind: (kind: NodeKind) => void;
  onToggleEdgeKind: (kind: EdgeKind) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function Legend({
  disabledNodeKinds,
  disabledEdgeKinds,
  nodeCounts = {},
  edgeCounts = {},
  onToggleNodeKind,
  onToggleEdgeKind,
  onShowAll,
  onHideAll,
}: LegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Only show kinds that exist in the graph — avoids a 22-item wall when the
  // graph only has 6 kinds. Fallback to all if no counts provided.
  const nodeKinds = (Object.keys(NODE_COLORS) as NodeKind[]).filter((k) =>
    Object.keys(nodeCounts).length === 0 ? true : (nodeCounts[k] ?? 0) > 0,
  );
  const edgeKinds = (Object.keys(EDGE_COLORS) as EdgeKind[]).filter((k) =>
    Object.keys(edgeCounts).length === 0 ? true : (edgeCounts[k] ?? 0) > 0,
  );

  return (
    <div
      data-testid="graph-legend"
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        background: "rgba(2, 6, 23, 0.92)",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: collapsed ? "8px 12px" : "10px 14px",
        backdropFilter: "blur(8px)",
        fontSize: 11,
        color: "#94a3b8",
        maxWidth: 230,
        maxHeight: collapsed ? undefined : "calc(100vh - 180px)",
        overflowY: collapsed ? "visible" : "auto",
      }}
    >
      {/* Header row with collapse toggle + show/hide all */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: collapsed ? 0 : 8,
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand legend" : "Collapse legend"}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#cbd5e1",
            letterSpacing: 1,
            textTransform: "uppercase",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 10 }}>{collapsed ? "▸" : "▾"}</span>
          Filter
        </button>
        {!collapsed && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={onShowAll}
              style={filterButtonStyle}
              title="Show all node and edge kinds"
            >
              All
            </button>
            <button
              type="button"
              onClick={onHideAll}
              style={filterButtonStyle}
              title="Hide all node and edge kinds"
            >
              None
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Node types */}
          <div style={sectionHeaderStyle}>Node Types</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            {nodeKinds.map((kind) => {
              const hidden = disabledNodeKinds.has(kind);
              const count = nodeCounts[kind];
              return (
                <label
                  key={kind}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    opacity: hidden ? 0.4 : 1,
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => onToggleNodeKind(kind)}
                    aria-label={`Toggle ${NODE_LABELS[kind]}`}
                    style={{ margin: 0, accentColor: NODE_COLORS[kind] }}
                  />
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: NODE_COLORS[kind],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 10, flex: 1 }}>{NODE_LABELS[kind]}</span>
                  {count !== undefined && (
                    <span style={{ fontSize: 9, color: "#475569" }}>{count}</span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #1e293b", marginBottom: 8 }} />

          {/* Edge types */}
          <div style={sectionHeaderStyle}>Edge Types</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {edgeKinds.map((kind) => {
              const hidden = disabledEdgeKinds.has(kind);
              const count = edgeCounts[kind];
              return (
                <label
                  key={kind}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    opacity: hidden ? 0.4 : 1,
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => onToggleEdgeKind(kind)}
                    aria-label={`Toggle ${EDGE_LABELS[kind]}`}
                    style={{ margin: 0, accentColor: EDGE_COLORS[kind] }}
                  />
                  <span
                    style={{
                      width: 16,
                      height: 2,
                      background: EDGE_COLORS[kind],
                      flexShrink: 0,
                      borderRadius: 1,
                    }}
                  />
                  <span style={{ fontSize: 10, flex: 1 }}>{EDGE_LABELS[kind]}</span>
                  {count !== undefined && (
                    <span style={{ fontSize: 9, color: "#475569" }}>{count}</span>
                  )}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1,
  color: "#475569",
  marginBottom: 6,
  textTransform: "uppercase",
};

const filterButtonStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  color: "#cbd5e1",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 4,
  padding: "2px 6px",
  cursor: "pointer",
};
