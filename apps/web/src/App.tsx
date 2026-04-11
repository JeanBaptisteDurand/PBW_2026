import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout";

const Analyze = lazy(() => import("./routes/Analyze"));
const GraphView = lazy(() => import("./routes/GraphView"));
const ComplianceView = lazy(() => import("./routes/ComplianceView"));
const Chat = lazy(() => import("./routes/Chat"));

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
        <Route path="/" element={<Navigate to="/analyze" replace />} />
        <Route
          path="/analyze"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Analyze />
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
        <Route
          path="/compliance/:analysisId"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ComplianceView />
            </Suspense>
          }
        />
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
