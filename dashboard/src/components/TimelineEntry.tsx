import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CategoryPill } from "@/components/CategoryPill";
import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import { StatusPill } from "@/components/StatusPill";
import { formatRelativeTime } from "@/utils/format";
import type { Event, IssueUpdate } from "@/api/types";

export type TimelineItem =
  | { kind: "update"; data: IssueUpdate }
  | { kind: "event"; data: Event };

/** Render a structured changes diff as human-readable text. */
function renderChanges(changes: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [field, diff] of Object.entries(changes)) {
    if (diff && typeof diff === "object" && "from" in diff && "to" in diff) {
      const d = diff as { from: unknown; to: unknown };
      const label = field.replace(/_/g, " ");
      if (d.from === null) {
        lines.push(`Set ${label} to "${d.to}"`);
      } else {
        lines.push(`Changed ${label} from "${d.from}" to "${d.to}"`);
      }
    }
  }
  return lines;
}

interface TimelineEntryProps {
  item: TimelineItem;
}

export function TimelineEntry({ item }: TimelineEntryProps) {
  if (item.kind === "update") {
    return <UpdateEntry update={item.data} />;
  }
  return <EventEntry event={item.data} />;
}

function UpdateEntry({ update }: { update: IssueUpdate }) {
  const changeLines = renderChanges(update.changes);
  const hasStatusTransition = update.status_from && update.status_to;

  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4" data-testid="timeline-update">
      <div className="shrink-0 pt-0.5">
        <PrincipalAvatar principal={update.principal} compact />
      </div>
      <div className="min-w-0 flex-1">
        {/* Header: principal, time, status transition */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{update.principal}</span>
          <time title={new Date(update.occurred_at).toLocaleString()}>
            {formatRelativeTime(update.occurred_at)}
          </time>
          {hasStatusTransition && (
            <span className="flex items-center gap-1">
              <StatusPill status={update.status_from!} />
              <span className="text-slate-400">→</span>
              <StatusPill status={update.status_to!} />
            </span>
          )}
        </div>

        {/* Content */}
        {update.content && (
          <div className="prose prose-sm prose-slate mt-2 max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{update.content}</Markdown>
          </div>
        )}

        {/* Structured changes */}
        {changeLines.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {changeLines.map((line, i) => (
              <li key={i} className="text-xs text-slate-600">
                <span className="mr-1 text-slate-400">•</span>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EventEntry({ event }: { event: Event }) {
  return (
    <div
      className="flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4"
      data-testid="timeline-event"
    >
      <div className="shrink-0 pt-0.5">
        <PrincipalAvatar principal={event.principal} compact />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{event.principal}</span>
          <CategoryPill category={event.category} />
          <time title={new Date(event.occurred_at).toLocaleString()}>
            {formatRelativeTime(event.occurred_at)}
          </time>
          {event.server_name && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {event.server_name}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-900">{event.summary}</p>
        {event.detail && (
          <div className="prose prose-sm prose-slate mt-1.5 max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{event.detail}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
