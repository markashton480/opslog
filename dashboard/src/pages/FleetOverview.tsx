import { Link } from "react-router-dom";

import { useServers } from "@/hooks/useServers";

export function FleetOverview() {
  const serversQuery = useServers();

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Fleet Overview</h2>
        <p className="text-sm text-slate-600">Live server inventory with direct navigation into briefings.</p>
      </header>

      {serversQuery.isLoading ? <p className="text-slate-600">Loading...</p> : null}
      {serversQuery.isError ? <p className="text-red-700">Unable to load servers.</p> : null}

      {serversQuery.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {serversQuery.data.map((server) => (
            <Link
              key={server.id}
              to={`/servers/${server.name}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{server.display_name}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{server.name}</p>
              <p className="mt-2 text-xs text-slate-600">Aliases: {server.aliases.length > 0 ? server.aliases.join(", ") : "none"}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
