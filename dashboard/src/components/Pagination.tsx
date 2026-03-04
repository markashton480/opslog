interface PaginationProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export function Pagination({ hasMore, loading, onLoadMore }: PaginationProps) {
  if (!hasMore) {
    return <p className="text-xs font-black uppercase tracking-widest text-neo-gray-400 italic">No more results.</p>;
  }

  return (
    <button
      type="button"
      onClick={onLoadMore}
      disabled={loading}
      className="neo-button bg-neo-gray-950 text-white hover:bg-brand transition-colors text-xs py-2 px-6"
    >
      {loading ? "LOADING..." : "LOAD MORE"}
    </button>
  );
}
