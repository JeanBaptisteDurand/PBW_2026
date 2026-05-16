import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout.js";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card.js";

const Landing = lazy(() => import("./routes/Landing/Landing.js"));
const Home = lazy(() => import("./routes/Home.js"));
const Analyze = lazy(() => import("./routes/Analyze.js"));
const GraphView = lazy(() => import("./routes/GraphView.js"));
const History = lazy(() => import("./routes/History.js"));
const CorridorHealth = lazy(() => import("./routes/CorridorHealth.js"));
const CorridorDetail = lazy(() => import("./routes/CorridorDetail.js"));
const CorridorRoute = lazy(() => import("./routes/CorridorRoute.js"));
const SafePath = lazy(() => import("./routes/SafePath.js"));
const Premium = lazy(() => import("./routes/Premium.js"));
const Account = lazy(() => import("./routes/Account.js"));
const ApiDocs = lazy(() => import("./routes/ApiDocs.js"));
const Chat = lazy(() => import("./routes/Chat.js"));
const ComplianceView = lazy(() => import("./routes/ComplianceView.js"));

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

function LandingFallback(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <span className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-xrp-500/30 border-t-xrp-500" />
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route
          path="/landing"
          element={
            <Suspense fallback={<LandingFallback />}>
              <Landing />
            </Suspense>
          }
        />
        <Route
          path="/home"
          element={
            <Suspense fallback={<LandingFallback />}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path="/corridors"
          element={
            <Suspense fallback={<LandingFallback />}>
              <CorridorHealth />
            </Suspense>
          }
        />
        <Route
          path="/corridors/:id"
          element={
            <Suspense fallback={<LandingFallback />}>
              <CorridorDetail />
            </Suspense>
          }
        />
        <Route
          path="/corridor-route/:id/:routeId"
          element={
            <Suspense fallback={<LandingFallback />}>
              <CorridorRoute />
            </Suspense>
          }
        />
        <Route
          path="/analyze"
          element={
            <Suspense fallback={<LandingFallback />}>
              <Analyze />
            </Suspense>
          }
        />
        <Route
          path="/graph/:analysisId"
          element={
            <Suspense fallback={<LandingFallback />}>
              <GraphView />
            </Suspense>
          }
        />
        <Route
          path="/chat/:analysisId"
          element={
            <Suspense fallback={<LandingFallback />}>
              <Chat />
            </Suspense>
          }
        />
        <Route
          path="/safe-path"
          element={
            <Suspense fallback={<LandingFallback />}>
              <SafePath />
            </Suspense>
          }
        />
        <Route
          path="/history"
          element={
            <Suspense fallback={<LandingFallback />}>
              <History />
            </Suspense>
          }
        />
        <Route
          path="/developers"
          element={
            <Suspense fallback={<LandingFallback />}>
              <ApiDocs />
            </Suspense>
          }
        />
        <Route
          path="/premium"
          element={
            <Suspense fallback={<LandingFallback />}>
              <Premium />
            </Suspense>
          }
        />
        <Route
          path="/account"
          element={
            <Suspense fallback={<LandingFallback />}>
              <Account />
            </Suspense>
          }
        />
        <Route
          path="/compliance/:analysisId"
          element={
            <Suspense fallback={<LandingFallback />}>
              <ComplianceView />
            </Suspense>
          }
        />
        <Route path="/verify" element={<PlaceholderPage title="Compliance Verify" />} />
        <Route path="*" element={<PlaceholderPage title="Not Found" />} />
      </Route>
    </Routes>
  );
}
