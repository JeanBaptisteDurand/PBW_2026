import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout";

const Landing = lazy(() => import("./routes/Landing/Landing"));
const Home = lazy(() => import("./routes/Home"));
const Analyze = lazy(() => import("./routes/Analyze"));
const GraphView = lazy(() => import("./routes/GraphView"));
// ComplianceView removed — compliance is now SafePath-only
const Chat = lazy(() => import("./routes/Chat"));
const CorridorHealth = lazy(() => import("./routes/CorridorHealth"));
const CorridorDetail = lazy(() => import("./routes/CorridorDetail"));
const ApiDocs = lazy(() => import("./routes/ApiDocs"));
const SafePath = lazy(() => import("./routes/SafePath"));
const History = lazy(() => import("./routes/History"));
const Premium = lazy(() => import("./routes/Premium"));
const Account = lazy(() => import("./routes/Account"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
      <span className="inline-block w-7 h-7 border-4 border-xrp-500/30 border-t-xrp-500 rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route
          path="/landing"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Landing />
            </Suspense>
          }
        />
        <Route
          path="/home"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path="/analyze"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Analyze />
            </Suspense>
          }
        />
        <Route
          path="/corridors"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <CorridorHealth />
            </Suspense>
          }
        />
        <Route
          path="/corridors/:id"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <CorridorDetail />
            </Suspense>
          }
        />
        {/* /route removed — absorbed into /safe-path */}
        <Route
          path="/developers"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ApiDocs />
            </Suspense>
          }
        />
        <Route
          path="/safe-path"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <SafePath />
            </Suspense>
          }
        />
        <Route
          path="/history"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <History />
            </Suspense>
          }
        />
        <Route
          path="/premium"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Premium />
            </Suspense>
          }
        />
        <Route
          path="/account"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Account />
            </Suspense>
          }
        />
        <Route
          path="/graph/:analysisId"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <GraphView />
            </Suspense>
          }
        />
        {/* /compliance removed — compliance is now SafePath-only */}
        <Route
          path="/chat/:analysisId"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Chat />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
