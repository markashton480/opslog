import { RefreshCcw } from "lucide-react";

interface NewEventsToastProps {
  count: number;
  onRefresh: () => void;
}

export function NewEventsToast({ count, onRefresh }: NewEventsToastProps) {
  if (count <= 0) return null;

  return (
    <div
      className="sticky top-20 z-10 mx-auto max-w-md animate-slide-down"
      role="status"
      aria-live="polite"
      data-testid="new-events-toast"
    >
      <button
        type="button"
        onClick={onRefresh}
        className="neo-button w-full bg-brand flex items-center justify-center gap-3 py-3 shadow-neo hover:shadow-neo-lg"
      >
        <span className="flex h-6 w-6 items-center justify-center border-2 border-white bg-white text-[10px] font-black text-brand">
          {count > 99 ? "99+" : count}
        </span>
        <span className="text-sm font-black uppercase tracking-tight text-white">
          {count === 1 ? "NEW EVENT" : "NEW EVENTS"} AVAILABLE — REFRESH
        </span>
        <RefreshCcw size={16} className="text-white" />
      </button>
    </div>
  );
}
