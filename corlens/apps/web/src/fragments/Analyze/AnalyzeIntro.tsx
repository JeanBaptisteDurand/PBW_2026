export function AnalyzeIntro() {
  return (
    <div className="mb-8">
      <h1 className="mb-2 text-3xl font-bold text-white">
        Entity Audit
      </h1>
      <p className="text-sm leading-relaxed text-slate-400">
        The same crawler the{" "}
        <a href="/safe-path" className="text-xrp-400 hover:underline">
          Safe Path Agent
        </a>{" "}
        calls internally — exposed as a standalone tool. Enter any XRPL
        address and CorLens crawls live mainnet to build a knowledge graph
        with 18 node types and 19 edge types. This is the proof the agent's
        tools are not mocked — verifiable by anyone in 30 seconds.
      </p>
    </div>
  );
}
