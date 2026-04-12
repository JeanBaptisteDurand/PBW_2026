import { ChatInterface } from "../../components/chat/ChatInterface";

interface ChatViewportProps {
  analysisId: string;
}

export function ChatViewport({ analysisId }: ChatViewportProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatInterface analysisId={analysisId} />
    </div>
  );
}
