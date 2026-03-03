interface NewEventsToastProps {
  count: number;
  onRefresh: () => void;
}

export function NewEventsToast({ count, onRefresh }: NewEventsToastProps) {
  if (count <= 0) return null;

  return (
    <div
      className="sticky top-16 z-10 mx-auto max-w-md animate-slide-down"
      role="status"
      aria-live="polite"
      data-testid="new-events-toast"
    >
      <button
        type="button"
        onClick={onRefresh}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-md transition hover:bg-blue-100"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
        <span>new event{count !== 1 ? "s" : ""} available — click to refresh</span>
      </button>
    </div>
  );
}
