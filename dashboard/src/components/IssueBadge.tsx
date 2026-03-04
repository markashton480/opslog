import { Link } from "react-router-dom";

import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { formatRelativeTime } from "@/utils/format";
import type { Issue, Severity } from "@/api/types";

const severityBorder: Record<Severity, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-slate-400",
};

interface IssueBadgeProps {
  issue: Issue;
}

export function IssueBadge({ issue }: IssueBadgeProps) {
  return (
    <Link
      to={`/issues/${issue.id}`}
      className={`block rounded-lg border border-slate-200 bg-white p-3 transition hover:shadow-md hover:border-slate-300 border-l-4 ${severityBorder[issue.severity]}`}
      data-testid="issue-badge"
    >
      <p className="truncate text-sm font-semibold text-slate-900">{issue.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusPill status={issue.status} />
        <SeverityBadge severity={issue.severity} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        {issue.server_name && (
          <span className="truncate font-medium text-slate-600">{issue.server_name}</span>
        )}
        <span className="shrink-0">{formatRelativeTime(issue.last_occurrence)}</span>
      </div>
    </Link>
  );
}
