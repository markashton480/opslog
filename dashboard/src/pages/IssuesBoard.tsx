import { useMemo } from "react";

import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { useIssues } from "@/hooks/useIssues";

export function IssuesBoard() {
  const issuesQuery = useIssues({ limit: 20 });

  const groups = useMemo(() => {
    const rows = issuesQuery.data?.data ?? [];
    return {
      open: rows.filter((issue) => issue.status === "open"),
      investigating: rows.filter((issue) => issue.status === "investigating"),
      watching: rows.filter((issue) => issue.status === "watching"),
      closed: rows.filter((issue) => issue.status === "resolved" || issue.status === "wontfix"),
    };
  }, [issuesQuery.data?.data]);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Issues Board</h2>
        <p className="text-sm text-slate-600">Kanban-style status columns with live API-backed issue data.</p>
      </header>

      {issuesQuery.isLoading ? <p className="text-slate-600">Loading...</p> : null}
      {issuesQuery.isError ? <p className="text-red-700">Unable to load issues.</p> : null}

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { key: "open", label: "Open", rows: groups.open },
          { key: "investigating", label: "Investigating", rows: groups.investigating },
          { key: "watching", label: "Watching", rows: groups.watching },
          { key: "closed", label: "Resolved / Wontfix", rows: groups.closed },
        ].map((column) => (
          <div key={column.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {column.label} ({column.rows.length})
            </h3>
            <div className="space-y-2">
              {column.rows.map((issue) => (
                <article key={issue.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill status={issue.status} />
                    <SeverityBadge severity={issue.severity} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
