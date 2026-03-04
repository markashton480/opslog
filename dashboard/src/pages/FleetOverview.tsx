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
    <section className="space-y-10">
      <header className="mb-12">
        <h2 className="text-5xl font-black tracking-tighter uppercase mb-3">
          Fleet Overview
        </h2>
        <p className="text-neo-gray-800 font-bold italic border-l-4 border-brand pl-4">
          Live server inventory — is everything okay right now?
        </p>
      </header>

      {serversQuery.isError ? (
        <div className="neo-card bg-red-100 text-center py-10">
          <p className="text-lg font-black uppercase tracking-tighter text-red-700">Unable to load servers.</p>
        </div>
      ) : serversQuery.isLoading ? (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3" data-testid="skeleton-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <ServerCardSkeleton key={i} />
          ))}
        </div>
      ) : serversQuery.data && serversQuery.data.length === 0 ? (
        <div className="neo-card bg-neo-gray-100 text-center py-20" data-testid="empty-state">
          <p className="text-2xl font-black uppercase tracking-tighter text-neo-gray-400">No servers registered</p>
          <p className="mt-2 font-bold italic text-neo-gray-400">
            Servers will appear here once they are added via the API.
          </p>
        </div>
      ) : (
        <>
          {anyError && (
            <div className="neo-badge bg-yellow-400 mb-6">
              Partial data shown: Some briefings failed to load.
            </div>
          )}
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
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
