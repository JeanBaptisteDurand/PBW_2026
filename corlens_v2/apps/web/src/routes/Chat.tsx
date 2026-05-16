import { useParams, useNavigate } from "react-router-dom";
import { ChatHeader } from "../fragments/Chat/ChatHeader";
import { ChatViewport } from "../fragments/Chat/ChatViewport";

export default function Chat() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();

  if (!analysisId) {
    return (
      <div className="app-content-min-height flex items-center justify-center">
        <p className="text-slate-400">No analysis ID provided.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--token-layout-navbarHeight))] flex-col">
      <ChatHeader
        analysisId={analysisId}
        onBackToGraph={() => navigate(`/graph/${analysisId}`)}
      />
      <ChatViewport analysisId={analysisId} />
    </div>
  );
}
