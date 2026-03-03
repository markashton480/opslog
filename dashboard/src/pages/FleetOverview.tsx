import { useQueries } from "@tanstack/react-query";

import { api } from "@/api/client";
import { ServerCard, ServerCardSkeleton } from "@/components/ServerCard";
import { useServers } from "@/hooks/useServers";

export function FleetOverview() {
  const serversQuery = useServers({ refetchInterval: 60_000 });

  const briefingQueries = useQueries({
    queries: (serversQuery.data ?? []).map((server) => ({
      queryKey: ["briefing", server.name],
      queryFn: async () => {
        const response = await api.servers.briefing(server.name);
        return response.data;
      },
      refetchInterval: 60_000,
    })),
  });

  const anyError = briefingQueries.some((q) => q.isError);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Fleet Overview</h2>
        <p className="text-sm text-slate-600">
          Live server inventory — is everything okay right now?
        </p>
      </header>

      {serversQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">Unable to load servers.</p>
        </div>
      ) : serversQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="skeleton-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <ServerCardSkeleton key={i} />
          ))}
        </div>
      ) : serversQuery.data && serversQuery.data.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center" data-testid="empty-state">
          <p className="text-lg font-medium text-slate-600">No servers registered</p>
          <p className="mt-1 text-sm text-slate-500">
            Servers will appear here once they are added via the API.
          </p>
        </div>
      ) : (
        <>
          {anyError && (
            <p className="text-sm text-amber-600">
              Some briefings failed to load. Partial data shown.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {briefingQueries.map((q, idx) =>
              q.isSuccess && q.data ? (
                <ServerCard key={q.data.server.id} briefing={q.data} />
              ) : (
                <ServerCardSkeleton key={serversQuery.data?.[idx]?.id ?? idx} />
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}
