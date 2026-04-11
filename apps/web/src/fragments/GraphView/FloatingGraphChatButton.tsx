interface FloatingGraphChatButtonProps {
  onOpen: () => void;
}

export function FloatingGraphChatButton({
  onOpen,
}: FloatingGraphChatButtonProps) {
  return (
    <button
      onClick={onOpen}
      className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-md bg-xrp-500 px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-xrp-600"
    >
      <span>💬</span>
      Ask the graph
    </button>
  );
}
