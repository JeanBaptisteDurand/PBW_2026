import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getActiveRun, subscribe as subscribeStore } from "../stores/safePathStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../hooks/useAuth";
import { api } from "../api/client";

const History = lazy(() => import("./History"));

type Tab = "profile" | "safe-path" | "audits" | "history";

interface ProfileData {
  id: string;
  walletAddress: string;
  role: string;
  apiKey: string | null;
  createdAt: string;
  updatedAt: string;
  subscriptions: Array<{
    id: string;
    txHash: string;
    amount: string;
    currency: string;
    paidAt: string;
  }>;
  analyses: Array<{
    id: string;
    status: string;
    seedAddress: string;
    seedLabel?: string;
    depth: number;
    error?: string;
    createdAt: string;
  }>;
}

interface SafePathRunSummary {
  id: string;
  srcCcy: string;
  dstCcy: string;
  amount: string;
  verdict: string;
  reasoning: string;
  corridorId?: string;
  createdAt: string;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "safe-path", label: "Safe Path" },
  { key: "audits", label: "Entity Audits" },
  { key: "history", label: "Account History" },
];

export default function Account() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isPremium, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [safePathRuns, setSafePathRuns] = useState<SafePathRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTab = (searchParams.get("tab") as Tab) || "profile";
  const setTab = (t: Tab) => setSearchParams({ tab: t });

  useEffect(() => {
    if (!user) {
      navigate("/landing");
      return;
    }
    setLoading(true);
    Promise.all([
      api.getProfile(),
      api.getSafePathHistory().catch(() => []),
    ])
      .then(([p, runs]) => {
        setProfile(p);
        setSafePathRuns(runs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="app-content-min-height px-6 py-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Account</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 pb-px">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === key
                ? "bg-slate-900/80 text-white border border-slate-700 border-b-transparent -mb-px"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && activeTab !== "history" && (
        <div className="flex justify-center py-16">
          <span className="inline-block w-7 h-7 border-4 border-xrp-500/30 border-t-xrp-500 rounded-full animate-spin" />
        </div>
      )}

      {error && activeTab !== "history" && (
        <Card>
          <CardContent className="py-8 text-center text-red-400">
            {error}
          </CardContent>
        </Card>
      )}

      {activeTab === "profile" && !loading && !error && profile && (
        <ProfileTab
          profile={profile}
          isPremium={isPremium}
          logout={logout}
          navigate={navigate}
          onProfileUpdate={setProfile}
        />
      )}

      {activeTab === "safe-path" && !loading && (
        <SafePathTab runs={safePathRuns} navigate={navigate} />
      )}

      {activeTab === "audits" && !loading && !error && profile && (
        <AnalysesTab analyses={profile.analyses} navigate={navigate} />
      )}

      {activeTab === "history" && (
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <span className="inline-block w-7 h-7 border-4 border-xrp-500/30 border-t-xrp-500 rounded-full animate-spin" />
            </div>
          }
        >
          <History embedded />
        </Suspense>
      )}
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────

function ProfileTab({
  profile,
  isPremium,
  logout,
  navigate,
  onProfileUpdate,
}: {
  profile: ProfileData;
  isPremium: boolean;
  logout: () => void;
  navigate: ReturnType<typeof useNavigate>;
  onProfileUpdate: (p: ProfileData) => void;
}) {
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleGenerateApiKey = async (force = false) => {
    setApiKeyLoading(true);
    try {
      const { apiKey } = await api.generateApiKey(force);
      onProfileUpdate({ ...profile, apiKey });
      setShowApiKey(true);
    } catch {
      // ignore
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRevokeApiKey = async () => {
    setApiKeyLoading(true);
    try {
      await api.revokeApiKey();
      onProfileUpdate({ ...profile, apiKey: null });
      setShowApiKey(false);
    } catch {
      // ignore
    } finally {
      setApiKeyLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="Wallet Address">
            <span className="font-mono text-sm text-slate-200">
              {profile.walletAddress}
            </span>
          </Row>
          <Row label="Member since">
            <span className="text-sm text-slate-200">
              {new Date(profile.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </Row>
          <Row label="Status">
            {isPremium ? (
              <Badge className="bg-emerald-500/16 text-emerald-300 border-emerald-500/32">
                Premium
              </Badge>
            ) : (
              <Badge className="bg-slate-700/50 text-slate-300 border-slate-600/50">
                Free
              </Badge>
            )}
          </Row>
        </CardContent>
      </Card>

      {isPremium && profile.subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {sub.amount} {sub.currency}
                  </div>
                  <div className="text-xs text-slate-400">
                    Paid on{" "}
                    {new Date(sub.paidAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <a
                  href={`https://livenet.xrpl.org/transactions/${sub.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-xrp-400 hover:text-xrp-300 transition-colors"
                >
                  {sub.txHash.slice(0, 8)}...
                </a>
              </div>
            ))}
            <div className="text-xs text-slate-500">
              Lifetime access -- no expiration
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Key section — premium only */}
      {isPremium && (
        <Card>
          <CardHeader>
            <CardTitle>API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              Use your API key to connect XRPLens to Claude via the MCP server,
              or to call the REST API programmatically. See the{" "}
              <button
                onClick={() => navigate("/developers?tab=mcp")}
                className="text-xrp-400 hover:underline"
              >
                MCP docs
              </button>{" "}
              for setup instructions.
            </p>

            {profile.apiKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-slate-950/60 border border-slate-800 rounded px-3 py-2 text-slate-300 overflow-x-auto">
                    {showApiKey
                      ? profile.apiKey
                      : `${profile.apiKey.slice(0, 10)}${"*".repeat(30)}`}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="shrink-0"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(profile.apiKey!);
                    }}
                    className="shrink-0"
                  >
                    Copy
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGenerateApiKey(true)}
                    disabled={apiKeyLoading}
                  >
                    {apiKeyLoading ? "Generating..." : "Regenerate"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRevokeApiKey}
                    disabled={apiKeyLoading}
                    className="text-red-400 hover:text-red-300"
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => handleGenerateApiKey()}
                disabled={apiKeyLoading}
                size="sm"
              >
                {apiKeyLoading ? "Generating..." : "Generate API Key"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isPremium && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-slate-400 mb-4">
              Upgrade to Premium to unlock Safe Path Agent, Compliance Reports,
              MCP Server access, and more.
            </p>
            <Button onClick={() => navigate("/premium")}>
              Upgrade to Premium
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            logout();
            navigate("/landing");
          }}
          className="text-slate-400 hover:text-red-400"
        >
          Disconnect Wallet
        </Button>
      </div>
    </div>
  );
}

// ─── Safe Path Tab ───────────────────────────────────────────

function SafePathTab({
  runs,
  navigate,
}: {
  runs: SafePathRunSummary[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const globalRun = useSyncExternalStore(subscribeStore, getActiveRun);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDetail = (id: string) => {
    if (selectedId === id) {
      // Double-click: go to full SafePath page with saved data
      navigate(`/safe-path?runId=${id}`);
      return;
    }
    setSelectedId(id);
    setLoadingDetail(true);
    api
      .getSafePathRun(id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  };

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-slate-400 mb-4">No Safe Path runs yet</p>
          <Button onClick={() => navigate("/safe-path")}>
            Run your first Safe Path analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active run banner */}
      {globalRun && (
        <button
          onClick={() => navigate("/safe-path")}
          className="w-full text-left rounded-lg border border-xrp-500/50 bg-xrp-500/10 px-4 py-3 hover:bg-xrp-500/15 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {globalRun.running && (
                <span className="inline-block w-2 h-2 bg-xrp-400 rounded-full animate-pulse" />
              )}
              <span className="text-sm font-medium text-white">
                {globalRun.srcCcy} &rarr; {globalRun.dstCcy}
              </span>
              <span className="text-xs text-slate-400">
                {globalRun.amount} {globalRun.srcCcy}
              </span>
            </div>
            <span className="text-xs text-xrp-400">
              {globalRun.running
                ? `Running (${globalRun.events.length} events)`
                : globalRun.result
                  ? "Completed -- click to view"
                  : "Stopped"}
            </span>
          </div>
        </button>
      )}

      <div className="space-y-2">
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => loadDetail(r.id)}
            className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
              selectedId === r.id
                ? "border-xrp-500/50 bg-slate-900/70"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">
                  {r.srcCcy} &rarr; {r.dstCcy}
                </span>
                <span className="text-xs text-slate-400">
                  {r.amount} {r.srcCcy}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <VerdictBadge verdict={r.verdict} />
                <span className="text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {r.reasoning}
            </p>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {selectedId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Run Details</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetail && (
              <div className="flex justify-center py-8">
                <span className="inline-block w-5 h-5 border-2 border-xrp-500/30 border-t-xrp-500 rounded-full animate-spin" />
              </div>
            )}
            {!loadingDetail && detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <Row label="Corridor">
                    <span className="text-slate-200">
                      {detail.srcCcy} &rarr; {detail.dstCcy}
                    </span>
                  </Row>
                  <Row label="Amount">
                    <span className="text-slate-200">
                      {detail.amount} {detail.srcCcy}
                    </span>
                  </Row>
                  <Row label="Risk Tolerance">
                    <span className="text-slate-200">
                      {detail.maxRiskTolerance}
                    </span>
                  </Row>
                  <Row label="Verdict">
                    <VerdictBadge verdict={detail.verdict} />
                  </Row>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Reasoning
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {detail.reasoning}
                  </p>
                </div>

                {detail.reportMarkdown && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Compliance Report Preview
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-[#0f172a] p-4 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {detail.reportMarkdown.slice(0, 600)}
                      {detail.reportMarkdown.length > 600 && "..."}
                    </div>
                  </div>
                )}

                {detail.analysisIds && detail.analysisIds.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Deep Analyses
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.analysisIds.map((id: string) => (
                        <a
                          key={id}
                          href={`/graph/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-xrp-400 hover:text-xrp-300 underline underline-offset-2"
                        >
                          {id.slice(0, 8)}...
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/safe-path?runId=${detail.id}`)}
                  >
                    View full analysis
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/safe-path?srcCcy=${detail.srcCcy}&dstCcy=${detail.dstCcy}&amount=${detail.amount}`,
                      )
                    }
                  >
                    Re-run
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Analyses Tab ────────────────────────────────────────────

function AnalysesTab({
  analyses,
  navigate,
}: {
  analyses: ProfileData["analyses"];
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (analyses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-slate-400 mb-4">No analyses yet</p>
          <Button onClick={() => navigate("/analyze")}>
            Start your first audit
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {analyses.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            if (a.status === "done") navigate(`/graph/${a.id}`);
            else if (a.status === "running" || a.status === "queued")
              navigate(`/analyze?id=${a.id}`);
          }}
          className="w-full text-left rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-slate-600 hover:bg-slate-900/60 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-sm text-slate-200">
                {a.seedLabel || a.seedAddress.slice(0, 12) + "..."}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                depth {a.depth}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={a.status} />
              <span className="text-xs text-slate-500">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          {a.error && (
            <p className="text-xs text-red-400 mt-1">{a.error}</p>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: "bg-emerald-500/16 text-emerald-300 border-emerald-500/32",
    running: "bg-blue-500/16 text-blue-300 border-blue-500/32",
    queued: "bg-yellow-500/16 text-yellow-300 border-yellow-500/32",
    error: "bg-red-500/16 text-red-400 border-red-500/32",
  };

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full border ${
        styles[status] || styles.queued
      }`}
    >
      {status}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    SAFE: "bg-emerald-500/16 text-emerald-300 border-emerald-500/32",
    REJECTED: "bg-red-500/16 text-red-400 border-red-500/32",
    NO_PATHS: "bg-slate-700/50 text-slate-300 border-slate-600/50",
    OFF_CHAIN_ROUTED: "bg-blue-500/16 text-blue-300 border-blue-500/32",
  };

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full border ${
        styles[verdict] || styles.NO_PATHS
      }`}
    >
      {verdict}
    </span>
  );
}
