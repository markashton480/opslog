import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, MessageSquare, Activity } from "lucide-react";

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
      const label = field.replace(/_/g, " ").toUpperCase();
      if (d.from === null) {
        lines.push(`SET ${label} TO "${d.to}"`);
      } else if (d.to === null) {
        lines.push(`CLEARED ${label}`);
      } else {
        lines.push(`CHANGED ${label} FROM "${d.from}" TO "${d.to}"`);
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
    <div className="neo-card bg-white p-6 relative" data-testid="timeline-update">
      <div className="flex gap-4">
        <div className="shrink-0">
          <PrincipalAvatar principal={update.principal} compact />
        </div>
        <div className="min-w-0 flex-1">
          {/* Header: principal, time, status transition */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-neo-gray-950 uppercase italic tracking-tight">@{update.principal}</span>
              <div className="px-2 py-0.5 bg-neo-gray-100 border-2 border-neo-gray-950 text-[10px] font-black uppercase flex items-center gap-1">
                <MessageSquare size={10} /> UPDATE
              </div>
            </div>
            <time className="text-[10px] font-bold text-neo-gray-400 uppercase italic" title={new Date(update.occurred_at).toLocaleString()}>
              {formatRelativeTime(update.occurred_at)}
            </time>
          </div>

          {hasStatusTransition && (
            <div className="mb-4 flex items-center gap-3 p-2 bg-neo-gray-50 border-2 border-neo-gray-950 shadow-neo-sm w-fit">
              <StatusPill status={update.status_from!} />
              <ArrowRight size={14} className="text-neo-gray-400" />
              <StatusPill status={update.status_to!} />
            </div>
          )}

          {/* Content */}
          {update.content && (
            <div className="prose prose-sm prose-neo max-w-none font-bold text-neo-gray-800 italic bg-neo-gray-50/50 p-4 border-l-4 border-brand">
              <Markdown remarkPlugins={[remarkGfm]}>{update.content}</Markdown>
            </div>
          )}

          {/* Structured changes */}
          {changeLines.length > 0 && (
            <ul className="mt-4 space-y-2">
              {changeLines.map((line, i) => (
                <li key={i} className="text-[10px] font-black uppercase tracking-widest text-neo-gray-500 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-brand border border-neo-gray-950" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EventEntry({ event }: { event: Event }) {
  return (
    <div
      className="neo-card bg-neo-gray-100/50 border-dashed p-6"
      data-testid="timeline-event"
    >
      <div className="flex gap-4">
        <div className="shrink-0">
          <PrincipalAvatar principal={event.principal} compact />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-neo-gray-950 uppercase italic tracking-tight">@{event.principal}</span>
              <CategoryPill category={event.category} />
              {event.server_name && (
                <span className="neo-badge bg-white">
                  {event.server_name}
                </span>
              )}
            </div>
            <time className="text-[10px] font-bold text-neo-gray-400 uppercase italic" title={new Date(event.occurred_at).toLocaleString()}>
              {formatRelativeTime(event.occurred_at)}
            </time>
          </div>
          <p className="text-sm font-black text-neo-gray-800 uppercase tracking-tight flex items-center gap-2">
            <Activity size={14} className="text-brand" />
            {event.summary}
          </p>
          {event.detail && (
            <div className="prose prose-sm prose-neo mt-3 max-w-none text-neo-gray-500 italic">
              <Markdown remarkPlugins={[remarkGfm]}>{event.detail}</Markdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
