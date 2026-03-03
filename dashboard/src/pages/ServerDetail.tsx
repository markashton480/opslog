import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EventRow } from "@/components/EventRow";
import { IssueBadge } from "@/components/IssueBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Pagination } from "@/components/Pagination";
import { formatRelativeTime } from "@/utils/format";
import { useBriefing } from "@/hooks/useBriefing";
import { useEvents } from "@/hooks/useEvents";
import { useIssues } from "@/hooks/useIssues";
import type { Severity } from "@/api/types";

const activeStatuses = ["open", "investigating", "watching"];

export function ServerDetail() {
  const params = useParams<{ name: string }>();
  const serverName = params.name ?? "";

  const briefingQuery = useBriefing(serverName, { refetchInterval: 30_000 });

  // Stable 48h boundary — only recalculated when the toggle or server changes
  const [showAllEvents, setShowAllEvents] = useState(false);
  const sinceTimestamp = useMemo(
    () => (showAllEvents ? undefined : new Date(Date.now() - 48 * 3600_000).toISOString()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAllEvents, serverName],
  );

  const eventsQuery = useEvents(
    {
      server: serverName,
      since: sinceTimestamp,
      limit: 10,
    },
    { refetchInterval: 30_000 },
  );

  // Issues panel: server-filtered, active statuses only, 30s refresh
  const issuesQuery = useIssues(
    {
      server: serverName,
      status: activeStatuses.join(","),
      limit: 50,
    },
    { refetchInterval: 30_000 },
  );

  if (briefingQuery.isLoading) {
    return (
      <section className="space-y-6 animate-pulse" data-testid="detail-loading">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-5 w-64 rounded bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (briefingQuery.isError || !briefingQuery.data) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">Unable to load briefing for "{serverName}".</p>
        <Link to="/" className="mt-2 inline-block text-sm text-slate-600 underline hover:text-slate-900">
          ← Back to Fleet Overview
        </Link>
      </section>
    );
  }

  const { server, summary, open_issues, recent_events } = briefingQuery.data;

  // Severity breakdown from open_issues
  const severityCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of open_issues) {
    severityCounts[issue.severity]++;
  }

  const lastEventTime = recent_events[0]?.occurred_at;

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 shrink-0 rounded-full ${server.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`}
            title={server.status}
            data-testid="status-dot"
          />
          <h2 className="text-2xl font-semibold text-slate-900">{server.name}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">{server.display_name}</p>

        {server.aliases.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            <span className="italic text-slate-400">formerly known as</span>{" "}
            <span className="font-medium text-slate-600">{server.aliases.join(", ")}</span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          {server.private_ipv4 && (
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-400">IP:</span>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">{server.private_ipv4}</code>
            </span>
          )}
          {server.notes && <span className="text-slate-500">{server.notes}</span>}
        </div>
      </header>

      {/* Summary stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="summary-strip">
        <StatCard label="Events (24h)" value={String(summary.events_last_24h)} />
        <StatCard label="Events (7d)" value={String(summary.events_last_7d)} />
        <StatCard
          label="Open issues"
          value={String(summary.open_issue_count)}
          extra={
            open_issues.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {(["critical", "high", "medium", "low"] as Severity[])
                  .filter((s) => severityCounts[s] > 0)
                  .map((s) => (
                    <span key={s} className="flex items-center gap-1">
                      <SeverityBadge severity={s} />
                      <span className="text-xs text-slate-500">×{severityCounts[s]}</span>
                    </span>
                  ))}
              </div>
            ) : null
          }
        />
        <StatCard
          label="Last deploy"
          value={summary.last_deployment ? formatRelativeTime(summary.last_deployment) : "—"}
          sub={lastEventTime ? `Last event: ${formatRelativeTime(lastEventTime)}` : undefined}
        />
      </div>

      {/* Two-panel layout */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recent Events panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent Events</h3>
            <button
              type="button"
              onClick={() => setShowAllEvents(!showAllEvents)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 transition"
            >
              {showAllEvents ? "Last 48h only" : "Show all"}
            </button>
          </div>

          {eventsQuery.isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : eventsQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load events.</p>
          ) : eventsQuery.events.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No events in this period.
            </p>
          ) : (
            <div className="space-y-2">
              {eventsQuery.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
              <Pagination
                hasMore={eventsQuery.hasMore}
                loading={eventsQuery.isFetchingNextPage}
                onLoadMore={() => eventsQuery.loadMore()}
              />
            </div>
          )}
        </div>

        {/* Open Issues panel */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Open Issues</h3>

          {issuesQuery.isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : issuesQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load issues.</p>
          ) : (issuesQuery.data?.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No open issues — all clear! 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {(issuesQuery.data?.data ?? []).map((issue) => (
                <IssueBadge key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Small stat card for the summary strip. */
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  extra?: React.ReactNode;
}

function StatCard({ label, value, sub, extra }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="stat-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {extra}
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
