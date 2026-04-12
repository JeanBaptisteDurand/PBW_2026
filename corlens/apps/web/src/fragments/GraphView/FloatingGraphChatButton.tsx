interface FloatingGraphChatButtonProps {
  onOpen: () => void;
}

export function FloatingGraphChatButton({
  onOpen,
}: FloatingGraphChatButtonProps) {
  return (
    <button
      onClick={onOpen}
      className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full border border-xrp-500/60 bg-slate-950/95 px-5 py-3 text-sm font-semibold text-xrp-300 shadow-lg shadow-xrp-900/40 backdrop-blur transition hover:scale-105 hover:border-xrp-400"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>Ask the graph</span>
    </button>
  );
}
