import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { RLUSD_ISSUER } from "@xrplens/core";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useStartAnalysis, useAnalysisStatus, useAnalysisHistory } from "../hooks/useAnalysis";
import { AnalyzeIntro } from "../fragments/Analyze/AnalyzeIntro";
import { QuickStartPresets } from "../fragments/Analyze/QuickStartPresets";
import { AnalysisStatusCard } from "../fragments/Analyze/AnalysisStatusCard";

// Corridor analysis is not part of this page anymore — it lives on its own
// /corridors page (live health board) and inside the Safe Path Agent
// (treasury-intent routing). Keeping them in sync is simpler when there's
// only one surface per product area.

const ENTITY_PRESETS = [
  { label: "RLUSD Issuer", address: RLUSD_ISSUER, seedLabel: "RLUSD" },
  {
    label: "Bitstamp (8 currencies)",
    address: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
    seedLabel: "Bitstamp",
  },
  {
    label: "Sologenic SOLO",
    address: "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
    seedLabel: "Sologenic",
  },
  {
    label: "XRP/RLUSD AMM Pool",
    address: "rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3",
    seedLabel: "AMM XRP/RLUSD",
  },
  {
    label: "Binance Hot Wallet",
    address: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh",
    seedLabel: "Binance",
  },
  {
    label: "DIA Oracle",
    address: "rP24Lp7bcUHvEW7T7c8xkxtQKKd9fZyra7",
    seedLabel: "DIA Oracle",
  },
];

export default function Analyze() {
  const [searchParams] = useSearchParams();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <AnalyzeIntro />

      <EntityForm
        initialAddress={searchParams.get("address") ?? ""}
        initialLabel={searchParams.get("label") ?? ""}
      />

      <RecentAudits />
    </div>
  );
}

function RecentAudits() {
  const { data: analyses } = useAnalysisHistory();
  const done = analyses?.filter((a) => a.status === "done") ?? [];

  if (done.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-sm">Recent Audits</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {done.slice(0, 10).map((a) => (
            <Link
              key={a.id}
              to={`/graph/${a.id}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-600 hover:bg-slate-900/50 transition-colors group"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-white group-hover:text-xrp-400 transition-colors truncate">
                  {a.seedLabel || a.seedAddress.slice(0, 20) + "…"}
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  {a.seedAddress}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 flex-shrink-0 ml-3">
                {new Date(a.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EntityForm({
  initialAddress = "",
  initialLabel = "",
}: {
  initialAddress?: string;
  initialLabel?: string;
}) {
  const navigate = useNavigate();
  const [address, setAddress] = useState(initialAddress);
  const [seedLabel, setSeedLabel] = useState(initialLabel);
  // BFS depth: 1 = quick (single-seed, ~seconds), 2 = deep (seed + heavy
  // neighbours each crawled as a full hub), 3 = very deep (two hops). Deep
  // mode runs multiple XRPL crawls so it can take minutes — we warn in the
  // UI. Default stays at 1 so the usual "quick look at one address" flow
  // isn't slower for users who don't opt in.
  const [depth, setDepth] = useState<1 | 2 | 3>(1);
  const [analysisId, setAnalysisId] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const startMutation = useStartAnalysis();
  const { data: status } = useAnalysisStatus(analysisId);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (status?.status === "done" && analysisId && !hasNavigated.current) {
      hasNavigated.current = true;
      navigate(`/graph/${analysisId}`);
    }
  }, [status?.status, analysisId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    hasNavigated.current = false;
    try {
      const result = await startMutation.mutateAsync({
        seedAddress: address.trim(),
        seedLabel: seedLabel.trim() || undefined,
        depth,
      });
      // Preset examples return a cached "done" analysis — navigate immediately
      if (result.status === "done") {
        hasNavigated.current = true;
        navigate(`/graph/${result.id}`);
        return;
      }
      setAnalysisId(result.id);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to start analysis",
      );
    }
  };

  const isPolling = status?.status === "queued" || status?.status === "running";
  const isError = status?.status === "error";

  return (
    <>
      <QuickStartPresets
        presets={ENTITY_PRESETS}
        onSelect={(preset) => {
          setAddress(preset.address);
          setSeedLabel(preset.seedLabel);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Entity Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="XRPL Address"
              placeholder="rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono"
              disabled={isPolling}
              required
            />
            <Input
              label="Label (optional)"
              placeholder="e.g. RLUSD Issuer, Binance, My Pool"
              value={seedLabel}
              onChange={(e) => setSeedLabel(e.target.value)}
              disabled={isPolling}
            />

            {/* Depth selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Crawl Depth
              </label>
              <div className="flex gap-2">
                {([
                  { v: 1 as const, label: "Quick", hint: "seed only · ~seconds" },
                  { v: 2 as const, label: "Deep", hint: "seed + 8 hubs · ~1-2 min" },
                  { v: 3 as const, label: "Very Deep", hint: "two hops · several min" },
                ]).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setDepth(opt.v)}
                    disabled={isPolling}
                    className={`flex-1 rounded-md border px-3 py-2 text-left transition ${
                      depth === opt.v
                        ? "border-xrp-500 bg-xrp-500/10"
                        : "border-slate-700 hover:border-slate-600"
                    } ${isPolling ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="text-xs font-semibold text-white">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.hint}</div>
                  </button>
                ))}
              </div>
              {depth >= 2 && (
                <p className="text-[11px] text-amber-400/80 mt-2">
                  Deep mode runs multiple XRPL crawls concurrently. Safe-capped
                  at 60 crawls / 800 nodes. Chat and Compliance will see every
                  crawled hub as full context.
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-red-400">{submitError}</p>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={isPolling || startMutation.isPending || !address.trim()}
              className="mt-2"
            >
              {startMutation.isPending ? "Starting..." : "Start Analysis"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {analysisId && (isPolling || isError) && (
        <AnalysisStatusCard
          isError={isError}
          statusValue={status?.status}
          errorMessage={status?.error}
        />
      )}
    </>
  );
}
