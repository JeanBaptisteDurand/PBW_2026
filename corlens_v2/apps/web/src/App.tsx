import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout.js";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card.js";

function PlaceholderPage({ title }: { title: string }): JSX.Element {
  return (
    <div className="app-content-min-height flex items-center justify-center px-6 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400">
          This route is part of Phase F — the implementation lands in a later WI. The Layout,
          Navbar, design tokens, and API client are already in place.
        </CardContent>
      </Card>
    </div>
  );
}

function LandingPlaceholder(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="rounded-2xl border border-xrp-700/40 bg-slate-900/60 px-8 py-6 text-center shadow-xl">
        <h1 className="font-mono text-2xl tracking-tight text-xrp-300">corlens v2</h1>
        <p className="mt-2 text-sm text-slate-400">
          SPA bootstrap OK — Landing scene ships in WI-3
        </p>
      </div>
    </main>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/landing" element={<LandingPlaceholder />} />
        <Route path="/home" element={<PlaceholderPage title="Home" />} />
        <Route path="/corridors" element={<PlaceholderPage title="Corridor Atlas" />} />
        <Route path="/corridors/:id" element={<PlaceholderPage title="Corridor Detail" />} />
        <Route path="/analyze" element={<PlaceholderPage title="Entity Audit" />} />
        <Route path="/graph/:analysisId" element={<PlaceholderPage title="Graph" />} />
        <Route path="/chat/:analysisId" element={<PlaceholderPage title="Chat" />} />
        <Route path="/safe-path" element={<PlaceholderPage title="Safe Path Agent" />} />
        <Route path="/history" element={<PlaceholderPage title="History" />} />
        <Route path="/developers" element={<PlaceholderPage title="API Docs" />} />
        <Route path="/premium" element={<PlaceholderPage title="Premium" />} />
        <Route path="/account" element={<PlaceholderPage title="Account" />} />
        <Route path="/verify" element={<PlaceholderPage title="Compliance Verify" />} />
        <Route path="*" element={<PlaceholderPage title="Not Found" />} />
      </Route>
    </Routes>
  );
}
