import { useParams } from "react-router-dom";

import { useBriefing } from "@/hooks/useBriefing";

export function ServerDetail() {
  const params = useParams<{ name: string }>();
  const briefingQuery = useBriefing(params.name);

  if (briefingQuery.isLoading) {
    return <p className="text-slate-600">Server Detail - Loading...</p>;
  }

  if (briefingQuery.isError || !briefingQuery.data) {
    return <p className="text-red-700">Server Detail - Unable to load briefing.</p>;
  }

  const { server, summary } = briefingQuery.data;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Server Detail</h2>
        <p className="text-sm text-slate-600">Situational briefing for {server.name}.</p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-slate-500">{server.display_name}</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">{server.name}</h3>
        <p className="mt-2 text-sm text-slate-700">Aliases: {server.aliases.join(", ") || "none"}</p>
        <p className="text-sm text-slate-700">Events (24h): {summary.events_last_24h}</p>
        <p className="text-sm text-slate-700">Open issues: {summary.open_issue_count}</p>
      </article>
    </section>
  );
}
