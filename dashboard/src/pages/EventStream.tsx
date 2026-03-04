import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EventRow } from "@/components/EventRow";
import { FilterBar, EMPTY_FILTERS, type FilterValues } from "@/components/FilterBar";
import { NewEventsToast } from "@/components/NewEventsToast";
import { Pagination } from "@/components/Pagination";
import { useCategories } from "@/hooks/useCategories";
import { useEvents } from "@/hooks/useEvents";
import { useServers } from "@/hooks/useServers";
import type { Event } from "@/api/types";

const FILTER_KEYS: (keyof FilterValues)[] = ["search", "server", "category", "principal", "tag", "since", "until"];

function filtersFromParams(params: URLSearchParams): FilterValues {
  const values = { ...EMPTY_FILTERS };
  for (const key of FILTER_KEYS) {
    const val = params.get(key);
    if (val) values[key] = val;
  }
  return values;
}

function paramsFromFilters(filters: FilterValues): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    if (filters[key]) result[key] = filters[key];
  }
  return result;
}

export function EventStream() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFiltersState] = useState<FilterValues>(() => filtersFromParams(searchParams));

  // Frozen snapshot: the events the user actually sees.
  // Only updates on: initial load, filter change, load more, or toast refresh.
  const [frozenEvents, setFrozenEvents] = useState<Event[]>([]);
  const [frozenHasMore, setFrozenHasMore] = useState(false);
  const [newEventCount, setNewEventCount] = useState(0);
  const lastFilterKeyRef = useRef("");
  const lastPageCountRef = useRef(0);

  const categoriesQuery = useCategories();
  const serversQuery = useServers();

  // Sync filters → URL
  const setFilters = useCallback(
    (next: FilterValues) => {
      setFiltersState(next);
      setSearchParams(paramsFromFilters(next), { replace: true });
    },
    [setSearchParams]
  );

  // Sync URL → filters (on browser back/forward)
  useEffect(() => {
    const fromUrl = filtersFromParams(searchParams);
    setFiltersState(fromUrl);
  }, [searchParams]);

  // Build API query params (excluding search which is client-side)
  const apiParams = useMemo(
    () => ({
      limit: 30,
      server: filters.server || undefined,
      category: filters.category || undefined,
      principal: filters.principal || undefined,
      tag: filters.tag || undefined,
      since: filters.since || undefined,
      until: filters.until || undefined,
    }),
    [filters.server, filters.category, filters.principal, filters.tag, filters.since, filters.until]
  );

  const filterKey = JSON.stringify(apiParams);
  const eventsQuery = useEvents(apiParams, { refetchInterval: 30_000 });

  // Sync frozen snapshot only on: initial load, filter change, or load more (page added).
  // Background refetches update eventsQuery but NOT the frozen list.
  useEffect(() => {
    const filterChanged = filterKey !== lastFilterKeyRef.current;
    const pageAdded = eventsQuery.pageCount > lastPageCountRef.current;
    const isInitialLoad = frozenEvents.length === 0 && eventsQuery.events.length > 0;

    if (isInitialLoad || filterChanged || pageAdded) {
      setFrozenEvents(eventsQuery.events);
      setFrozenHasMore(eventsQuery.hasMore);
      setNewEventCount(0);
      lastFilterKeyRef.current = filterKey;
      lastPageCountRef.current = eventsQuery.pageCount;
    } else if (eventsQuery.events.length > 0 && frozenEvents.length > 0) {
      // Background refetch — detect new events without updating the list
      if (eventsQuery.events[0].id !== frozenEvents[0].id) {
        const idx = eventsQuery.events.findIndex((e) => e.id === frozenEvents[0].id);
        setNewEventCount(idx > 0 ? idx : 1);
      }
    }
  }, [eventsQuery.events, eventsQuery.hasMore, eventsQuery.pageCount, filterKey, frozenEvents]);

  // Toast refresh: adopt live data into the frozen snapshot
  const handleRefreshFromToast = useCallback(() => {
    setFrozenEvents(eventsQuery.events);
    setFrozenHasMore(eventsQuery.hasMore);
    lastPageCountRef.current = eventsQuery.pageCount;
    setNewEventCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [eventsQuery.events, eventsQuery.hasMore, eventsQuery.pageCount]);

  // Client-side text search filter (applied to frozen snapshot)
  const displayedEvents = useMemo(() => {
    if (!filters.search) return frozenEvents;
    const needle = filters.search.toLowerCase();
    return frozenEvents.filter((e) => e.summary.toLowerCase().includes(needle));
  }, [frozenEvents, filters.search]);

  // Derive principal options from loaded events
  const principalOptions = useMemo(() => {
    const principals = new Set(frozenEvents.map((e) => e.principal));
    return Array.from(principals)
      .sort()
      .map((p) => ({ label: p, value: p }));
  }, [frozenEvents]);

  const serverOptions = useMemo(
    () => (serversQuery.data ?? []).map((s) => ({ label: s.display_name || s.name, value: s.name })),
    [serversQuery.data]
  );

  const categoryOptions = useMemo(
    () => (categoriesQuery.data ?? []).map((c) => ({ label: c.name, value: c.name })),
    [categoriesQuery.data]
  );

  const activeFilterCount = FILTER_KEYS.filter((k) => filters[k]).length;

  return (
    <section className="space-y-10">
      {/* Page header */}
      <header>
        <h2 className="text-5xl font-black tracking-tighter uppercase mb-3">Event Stream</h2>
        <div className="flex items-center gap-4">
          <p className="text-neo-gray-800 font-bold italic border-l-4 border-brand pl-4">
            Filterable timeline of all events across the fleet.
          </p>
          {activeFilterCount > 0 && (
            <span className="neo-badge bg-neo-gray-950 text-white">
              {activeFilterCount} active filter{activeFilterCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      {/* Filters */}
      <FilterBar
        values={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
        serverOptions={serverOptions}
        categoryOptions={categoryOptions}
        principalOptions={principalOptions}
      />

      {/* New events toast */}
      <NewEventsToast count={newEventCount} onRefresh={handleRefreshFromToast} />

      {/* Loading / error states */}
      {eventsQuery.isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse neo-card opacity-50 border-dashed" />
          ))}
        </div>
      )}
      {eventsQuery.isError && (
        <div className="neo-card bg-red-100 text-red-700 font-bold">
          Unable to load events. Please check API connectivity.
        </div>
      )}

      {/* Empty state */}
      {!eventsQuery.isLoading && !eventsQuery.isError && displayedEvents.length === 0 && (
        <div className="neo-card bg-neo-gray-100 p-20 text-center" data-testid="empty-state">
          <h3 className="text-2xl font-black uppercase tracking-tighter text-neo-gray-400 mb-2">No events found</h3>
          <p className="font-bold italic text-neo-gray-400 mb-6">
            {activeFilterCount > 0
              ? "Try adjusting your filters to see more results."
              : "No events have been recorded yet."}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="neo-button"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Event list */}
      {displayedEvents.length > 0 && (
        <div className="space-y-4" role="feed" aria-label="Event stream">
          {displayedEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {displayedEvents.length > 0 && (
        <div className="pt-2">
          <Pagination
            hasMore={frozenHasMore}
            loading={eventsQuery.isFetchingNextPage}
            onLoadMore={() => {
              void eventsQuery.loadMore();
            }}
          />
        </div>
      )}

      {/* Footer stats */}
      {displayedEvents.length > 0 && (
        <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-neo-gray-400 pt-4 border-t-2 border-neo-gray-950/10">
          <span>Showing {displayedEvents.length} event{displayedEvents.length !== 1 ? "s" : ""}</span>
          {frozenHasMore && <span className="neo-badge bg-neo-gray-100">More available</span>}
          {eventsQuery.warnings.length > 0 && (
            <span className="text-amber-500">⚠ {eventsQuery.warnings.join(", ")}</span>
          )}
        </div>
      )}
    </section>
  );
}
