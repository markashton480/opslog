import { useState } from "react";
import { Link } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react";

import { CategoryPill } from "@/components/CategoryPill";
import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import { formatRelativeTime } from "@/utils/format";
import type { Event } from "@/api/types";

function formatMetadata(metadata: Record<string, unknown>): string {
  if (Object.keys(metadata).length === 0) return "";
  return JSON.stringify(metadata, null, 2);
}

interface EventRowProps {
  event: Event;
}

export function EventRow({ event }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);

  const hasExpandableContent =
    event.detail || Object.keys(event.metadata).length > 0 || event.corrects_event_id || event.issue_id;

  const toggleExpand = () => {
    if (hasExpandableContent) setExpanded(!expanded);
  };

  return (
    <article
      className={`neo-card transition-all p-0 overflow-hidden ${expanded ? "shadow-neo-lg -translate-x-1 -translate-y-1" : "hover:bg-neo-gray-50"}`}
      data-testid="event-row"
    >
      {/* Compact row — div with onClick for expand, links use stopPropagation */}
      <div
        role="button"
        tabIndex={hasExpandableContent ? 0 : undefined}
        onClick={toggleExpand}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpand(); }}
        className={`flex w-full items-start gap-4 p-4 text-left sm:items-center ${hasExpandableContent ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={hasExpandableContent ? expanded : undefined}
      >
        {/* Timestamp */}
        <div className="flex shrink-0 flex-col items-end min-w-[64px]" title={`Ingested: ${new Date(event.ingested_at).toLocaleString()}`}>
          <time className="text-xs font-black text-neo-gray-950 uppercase tracking-tighter">
            {new Date(event.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
          <span className="text-[10px] font-bold italic text-neo-gray-400 uppercase">
            {formatRelativeTime(event.occurred_at)}
          </span>
        </div>

        {/* Principal */}
        <div className="shrink-0 flex items-center justify-center">
          <PrincipalAvatar principal={event.principal} compact />
        </div>

        {/* Server name — clickable link to Server Detail */}
        {event.server_name && (
          <Link
            to={`/servers/${event.server_name}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden shrink-0 neo-badge bg-neo-gray-100 hover:bg-brand hover:text-white transition-colors sm:inline-block"
            data-testid="server-link"
          >
            {event.server_name}
          </Link>
        )}

        {/* Category */}
        <div className="shrink-0">
          <CategoryPill category={event.category} />
        </div>

        {/* Summary + tags */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-neo-gray-950 uppercase tracking-tight">
            {event.corrects_event_id && (
              <span className="mr-2 neo-badge bg-brand text-white border-brand">
                CORRECTION
              </span>
            )}
            {event.summary}
          </p>
          {event.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-black text-neo-gray-400 italic uppercase"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Issue link — clickable link to Issue Detail */}
        {event.issue_id && (
          <Link
            to={`/issues/${event.issue_id}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 neo-badge bg-brand-light text-white hover:shadow-neo-sm transition-all"
            title="View linked issue"
            data-testid="issue-link"
          >
            ISSUE ↗
          </Link>
        )}

        {/* Expand indicator */}
        {hasExpandableContent && (
          <div className="shrink-0 p-1 bg-neo-gray-100 border-2 border-neo-gray-950 rounded shadow-neo-sm group-hover:bg-brand group-hover:text-white transition-all">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t-2 border-neo-gray-950 bg-neo-gray-50 p-6" data-testid="event-detail">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Detail markdown */}
            {event.detail && (
              <div>
                <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-neo-gray-400">Content</h4>
                <div className="prose prose-sm prose-neo max-w-none font-bold text-neo-gray-800 italic">
                  <Markdown remarkPlugins={[remarkGfm]}>{event.detail}</Markdown>
                </div>
              </div>
            )}

            {/* Metadata JSON */}
            {Object.keys(event.metadata).length > 0 && (
              <div>
                <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-neo-gray-400">Metadata</h4>
                <pre className="overflow-x-auto border-2 border-neo-gray-950 bg-neo-gray-950 p-4 text-xs text-brand-light font-black shadow-neo-sm">
                  {formatMetadata(event.metadata)}
                </pre>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {event.corrects_event_id && (
              <div className="neo-badge bg-yellow-400 flex items-center gap-2">
                <span>CORRECTS:</span>
                <code className="font-black bg-white px-1">
                  {event.corrects_event_id.slice(0, 8)}
                </code>
              </div>
            )}
            {event.issue_id && (
              <Link
                to={`/issues/${event.issue_id}`}
                className="neo-button py-2 px-4 flex items-center gap-2 text-xs"
              >
                VIEW LINKED ISSUE <ExternalLink size={12} />
              </Link>
            )}
            {event.server_name && (
              <Link
                to={`/servers/${event.server_name}`}
                className="neo-badge bg-white hover:bg-neo-gray-100 transition-colors"
              >
                {event.server_name} DETAIL →
              </Link>
            )}
          </div>

          {/* Full timestamps */}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 pt-4 border-t-2 border-neo-gray-950/10 text-[10px] font-black uppercase tracking-widest text-neo-gray-400">
            <span>OCCURRED: {new Date(event.occurred_at).toLocaleString()}</span>
            <span>INGESTED: {new Date(event.ingested_at).toLocaleString()}</span>
            <span>UUID: {event.id}</span>
          </div>
        </div>
      )}
    </article>
  );
}
