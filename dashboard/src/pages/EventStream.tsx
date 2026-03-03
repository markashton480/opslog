import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EventRow } from "@/components/EventRow";
import { FilterBar, EMPTY_FILTERS, type FilterValues } from "@/components/FilterBar";
import { NewEventsToast } from "@/components/NewEventsToast";
import { Pagination } from "@/components/Pagination";
import { useCategories } from "@/hooks/useCategories";
import { useEvents } from "@/hooks/useEvents";
import { useServers } from "@/hooks/useServers";

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
  const [newEventCount, setNewEventCount] = useState(0);
  const prevTopEventRef = useRef<string | null>(null);

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

  const eventsQuery = useEvents(apiParams, { refetchInterval: 30_000 });

  // Detect new events on refetch
  useEffect(() => {
    if (eventsQuery.events.length === 0) return;
    const topId = eventsQuery.events[0].id;
    if (prevTopEventRef.current === null) {
      prevTopEventRef.current = topId;
      return;
    }
    if (prevTopEventRef.current !== topId) {
      const prevIndex = eventsQuery.events.findIndex((e) => e.id === prevTopEventRef.current);
      if (prevIndex > 0) {
        setNewEventCount(prevIndex);
      }
    }
  }, [eventsQuery.events]);

  const handleRefreshFromToast = useCallback(() => {
    if (eventsQuery.events.length > 0) {
      prevTopEventRef.current = eventsQuery.events[0].id;
    }
    setNewEventCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [eventsQuery.events]);

  // Client-side text search filter
  const displayedEvents = useMemo(() => {
    if (!filters.search) return eventsQuery.events;
    const needle = filters.search.toLowerCase();
    return eventsQuery.events.filter((e) => e.summary.toLowerCase().includes(needle));
  }, [eventsQuery.events, filters.search]);

  // Derive principal options from loaded events
  const principalOptions = useMemo(() => {
    const principals = new Set(eventsQuery.events.map((e) => e.principal));
    return Array.from(principals)
      .sort()
      .map((p) => ({ label: p, value: p }));
  }, [eventsQuery.events]);

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
    <section className="space-y-4">
      {/* Page header */}
      <header>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Event Stream</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Filterable timeline of all events across the fleet.
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
            </span>
          )}
        </p>
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
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {eventsQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load events. Please check API connectivity.
        </div>
      )}

      {/* Empty state */}
      {!eventsQuery.isLoading && !eventsQuery.isError && displayedEvents.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center" data-testid="empty-state">
          <div className="text-3xl">📭</div>
          <h3 className="mt-2 text-base font-semibold text-slate-900">No events found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {activeFilterCount > 0
              ? "Try adjusting your filters to see more results."
              : "No events have been recorded yet."}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-3 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Event list */}
      {displayedEvents.length > 0 && (
        <div className="space-y-2" role="feed" aria-label="Event stream">
          {displayedEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {displayedEvents.length > 0 && (
        <div className="pt-2">
          <Pagination
            hasMore={eventsQuery.hasMore}
            loading={eventsQuery.isFetchingNextPage}
            onLoadMore={() => {
              void eventsQuery.loadMore();
            }}
          />
        </div>
      )}

      {/* Footer stats */}
      {displayedEvents.length > 0 && (
        <p className="text-xs text-slate-400">
          Showing {displayedEvents.length} event{displayedEvents.length !== 1 ? "s" : ""}
          {eventsQuery.hasMore ? " (more available)" : ""}
          {eventsQuery.warnings.length > 0 && (
            <span className="ml-2 text-amber-500">⚠ {eventsQuery.warnings.join(", ")}</span>
          )}
        </p>
      )}
    </section>
  );
}
