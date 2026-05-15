import { Route, Routes } from "react-router-dom";

function BootstrapPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="rounded-2xl border border-xrp-700/40 bg-slate-900/60 px-8 py-6 text-center shadow-xl">
        <h1 className="font-mono text-2xl tracking-tight text-xrp-300">corlens v2</h1>
        <p className="mt-2 text-sm text-slate-400">SPA bootstrap OK</p>
      </div>
    </main>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="*" element={<BootstrapPage />} />
    </Routes>
  );
}
