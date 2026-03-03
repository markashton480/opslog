interface PaginationProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export function Pagination({ hasMore, loading, onLoadMore }: PaginationProps) {
  if (!hasMore) {
    return <p className="text-sm text-slate-500">No more results.</p>;
  }

  return (
    <button
      type="button"
      onClick={onLoadMore}
      disabled={loading}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {loading ? "Loading..." : "Load More"}
    </button>
  );
}
