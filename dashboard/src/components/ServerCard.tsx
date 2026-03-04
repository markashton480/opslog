import { Link, useNavigate } from "react-router-dom";
import { Server as ServerIcon } from "lucide-react";

import { formatRelativeTime } from "@/utils/format";
import type { Briefing, Issue, Severity } from "@/api/types";

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const severityBgColor: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-400 text-neo-gray-950",
  low: "bg-neo-gray-300 text-neo-gray-950",
};

function worstSeverity(issues: Issue[]): Severity | null {
  if (issues.length === 0) return null;
  return issues.reduce<Severity>(
    (worst, issue) =>
      severityRank[issue.severity] > severityRank[worst] ? issue.severity : worst,
    issues[0].severity,
  );
}

function issueCountBg(issues: Issue[]): string {
  if (issues.length === 0) return "bg-green-400";
  const worst = worstSeverity(issues);
  if (worst && severityRank[worst] >= 3) return "bg-red-400 text-white";
  return "bg-yellow-400";
}

interface ServerCardProps {
  briefing: Briefing;
}

export function ServerCard({ briefing }: ServerCardProps) {
  const navigate = useNavigate();
  const { server, summary, recent_events, open_issues } = briefing;
  const worst = worstSeverity(open_issues);
  const lastEvent = recent_events[0] ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/servers/${server.name}`)}
      onKeyDown={(e) => {
        if (e.currentTarget !== e.target) return;
        if (e.key === " ") {
          e.preventDefault();
          navigate(`/servers/${server.name}`);
        } else if (e.key === "Enter") {
          navigate(`/servers/${server.name}`);
        }
      }}
      className="neo-card neo-card-hover group cursor-pointer"
      data-testid="server-card"
    >
      {/* Header: status badge + name */}
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-neo-gray-100 border-2 border-neo-gray-950 group-hover:bg-brand transition-colors group-hover:text-white">
          <ServerIcon size={32} />
        </div>
        <div className={`neo-badge ${server.status === "active" ? "bg-green-400" : "bg-neo-gray-400"}`}>
          {server.status}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-xl font-black truncate uppercase tracking-tighter text-neo-gray-950">
          {server.name}
        </h3>
        <p className="text-sm font-bold italic text-neo-gray-400 truncate">
          {server.display_name}
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-neo-gray-100 p-2 border-2 border-neo-gray-950 shadow-neo-sm">
          <div className="text-[10px] font-black text-neo-gray-400 uppercase tracking-widest">Events (24h)</div>
          <div className="text-lg font-black">{summary.events_last_24h}</div>
        </div>
        <Link
          to={`/issues?server=${server.name}`}
          onClick={(e) => e.stopPropagation()}
          className={`p-2 border-2 border-neo-gray-950 shadow-neo-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo ${issueCountBg(open_issues)}`}
          data-testid="issues-link"
        >
          <div className={`text-[10px] font-black uppercase tracking-widest ${open_issues.length > 0 ? "opacity-90" : "text-neo-gray-400"}`}>Issues</div>
          <div className="text-lg font-black">{summary.open_issue_count}</div>
        </Link>
      </div>

      {/* Timestamps */}
      <div className="space-y-2 pt-4 border-t-2 border-neo-gray-950/10">
        <div className="flex items-center justify-between text-xs">
          <span className="font-black uppercase text-neo-gray-400 tracking-tighter">Last event</span>
          <span className="font-bold italic" data-testid="last-event">
            {lastEvent ? formatRelativeTime(lastEvent.occurred_at) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-black uppercase text-neo-gray-400 tracking-tighter">Last deploy</span>
          <span className="font-bold italic" data-testid="last-deploy">
            {summary.last_deployment ? formatRelativeTime(summary.last_deployment) : "—"}
          </span>
        </div>
      </div>

      {worst && (
        <div className={`mt-4 px-3 py-1 border-2 border-neo-gray-950 font-black text-[10px] uppercase tracking-[0.2em] text-center ${severityBgColor[worst]}`}>
          {worst} severity issues detected
        </div>
      )}
    </div>
  );
}

/** Loading skeleton placeholder for a ServerCard. */
export function ServerCardSkeleton() {
  return (
    <div
      className="neo-card animate-pulse opacity-50 shadow-none border-dashed border-neo-gray-400"
      data-testid="server-card-skeleton"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-neo-gray-100 border-2 border-neo-gray-950" />
        <div className="w-16 h-6 bg-neo-gray-100 border-2 border-neo-gray-950" />
      </div>
      <div className="h-6 w-3/4 bg-neo-gray-100 border-2 border-neo-gray-950 mb-2" />
      <div className="h-4 w-1/2 bg-neo-gray-100 border-2 border-neo-gray-950 mb-4" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-14 bg-neo-gray-100 border-2 border-neo-gray-950" />
        <div className="h-14 bg-neo-gray-100 border-2 border-neo-gray-950" />
      </div>
    </div>
  );
}
