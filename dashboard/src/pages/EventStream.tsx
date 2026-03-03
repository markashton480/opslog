import { useMemo, useState } from "react";

import { CategoryPill } from "@/components/CategoryPill";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import { useCategories } from "@/hooks/useCategories";
import { useEvents } from "@/hooks/useEvents";
import { useServers } from "@/hooks/useServers";

export function EventStream() {
  const [filters, setFilters] = useState({ search: "", server: "", category: "", principal: "" });
  const categoriesQuery = useCategories();
  const serversQuery = useServers();

  const params = useMemo(
    () => ({
      limit: 20,
      server: filters.server || undefined,
      category: filters.category || undefined,
      principal: filters.principal || undefined,
    }),
    [filters.category, filters.principal, filters.server]
  );
  const eventsQuery = useEvents(params);

  const filteredData = useMemo(() => {
    const events = eventsQuery.data?.data ?? [];
    if (!filters.search) {
      return events;
    }
    const needle = filters.search.toLowerCase();
    return events.filter((event) => event.summary.toLowerCase().includes(needle));
  }, [eventsQuery.data?.data, filters.search]);

  const principalOptions = useMemo(() => {
    const principals = new Set((eventsQuery.data?.data ?? []).map((event) => event.principal));
    return Array.from(principals)
      .sort()
      .map((principal) => ({ label: principal, value: principal }));
  }, [eventsQuery.data?.data]);

  const serverOptions = useMemo(
    () => (serversQuery.data ?? []).map((server) => ({ label: server.name, value: server.name })),
    [serversQuery.data]
  );

  const categoryOptions = useMemo(
    () => (categoriesQuery.data ?? []).map((category) => ({ label: category.name, value: category.name })),
    [categoriesQuery.data]
  );

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Event Stream</h2>
        <p className="text-sm text-slate-600">Filterable event timeline backed by the live API.</p>
      </header>

      <FilterBar
        values={filters}
        onChange={setFilters}
        onClear={() => setFilters({ search: "", server: "", category: "", principal: "" })}
        serverOptions={serverOptions}
        categoryOptions={categoryOptions}
        principalOptions={principalOptions}
      />

      {eventsQuery.isLoading ? <p className="text-slate-600">Loading...</p> : null}
      {eventsQuery.isError ? <p className="text-red-700">Unable to load events.</p> : null}

      <div className="space-y-3">
        {filteredData.map((event) => (
          <article key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CategoryPill category={event.category} />
              <time className="text-xs text-slate-500">{new Date(event.occurred_at).toLocaleString()}</time>
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900">{event.summary}</h3>
            <div className="mt-2">
              <PrincipalAvatar principal={event.principal} />
            </div>
          </article>
        ))}
      </div>

      <Pagination hasMore={eventsQuery.data?.has_more ?? false} loading={eventsQuery.isFetching} onLoadMore={() => void 0} />
    </section>
  );
}
