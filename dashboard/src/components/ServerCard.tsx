import { Link, useNavigate } from "react-router-dom";

import { formatRelativeTime } from "@/utils/format";
import type { Briefing, Issue, Severity } from "@/api/types";

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const severityBorderColor: Record<Severity, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-slate-400",
};

function worstSeverity(issues: Issue[]): Severity | null {
  if (issues.length === 0) return null;
  return issues.reduce<Severity>(
    (worst, issue) =>
      severityRank[issue.severity] > severityRank[worst] ? issue.severity : worst,
    issues[0].severity,
  );
}

function issueCountColor(issues: Issue[]): string {
  if (issues.length === 0) return "text-emerald-600 bg-emerald-50";
  const worst = worstSeverity(issues);
  if (worst && severityRank[worst] >= 3) return "text-red-600 bg-red-50";
  return "text-amber-600 bg-amber-50";
}

interface ServerCardProps {
  briefing: Briefing;
}

export function ServerCard({ briefing }: ServerCardProps) {
  const navigate = useNavigate();
  const { server, summary, recent_events, open_issues } = briefing;
  const worst = worstSeverity(open_issues);
  const lastEvent = recent_events[0] ?? null;
  const borderClass = worst
    ? `border-l-4 ${severityBorderColor[worst]}`
    : "border-l-4 border-l-emerald-400";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/servers/${server.name}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") navigate(`/servers/${server.name}`);
      }}
      className={`group cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md hover:border-slate-300 ${borderClass}`}
      data-testid="server-card"
    >
      <div className="p-4">
        {/* Header: status dot + name */}
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${server.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`}
            title={server.status}
            data-testid="status-dot"
          />
          <h3 className="truncate text-base font-semibold text-slate-900">{server.name}</h3>
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-500">{server.display_name}</p>

        {/* Stat badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            <span className="font-semibold">{summary.events_last_24h}</span>
            <span className="text-slate-500">events&nbsp;24h</span>
          </span>
          <Link
            to={`/issues?server=${server.name}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition hover:opacity-80 ${issueCountColor(open_issues)}`}
            data-testid="issues-link"
          >
            <span>{open_issues.length}</span>
            <span className="font-medium">issues</span>
          </Link>
        </div>

        {/* Timestamps */}
        <div className="mt-3 space-y-1 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Last event</span>
            <span className="font-medium text-slate-700" data-testid="last-event">
              {lastEvent ? formatRelativeTime(lastEvent.occurred_at) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last deploy</span>
            <span className="font-medium text-slate-700" data-testid="last-deploy">
              {summary.last_deployment ? formatRelativeTime(summary.last_deployment) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Loading skeleton placeholder for a ServerCard. */
export function ServerCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse border-l-4 border-l-slate-200"
      data-testid="server-card-skeleton"
    >
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        <div className="h-5 w-32 rounded bg-slate-200" />
      </div>
      <div className="mt-1.5 h-4 w-24 rounded bg-slate-100" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-24 rounded-md bg-slate-100" />
        <div className="h-6 w-20 rounded-md bg-slate-100" />
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-full rounded bg-slate-100" />
      </div>
    </div>
  );
}
