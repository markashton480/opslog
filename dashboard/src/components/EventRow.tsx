import { useState } from "react";
import { Link } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CategoryPill } from "@/components/CategoryPill";
import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import type { Event } from "@/api/types";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

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

  return (
    <article
      className="group rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md"
      data-testid="event-row"
    >
      {/* Compact row */}
      <button
        type="button"
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
        className={`flex w-full items-start gap-3 p-3 text-left sm:items-center ${hasExpandableContent ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={hasExpandableContent ? expanded : undefined}
      >
        {/* Timestamp */}
        <div className="flex shrink-0 flex-col items-end" title={`Ingested: ${new Date(event.ingested_at).toLocaleString()}`}>
          <time className="text-xs font-medium text-slate-600">
            {new Date(event.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
          <span className="text-[10px] text-slate-400">
            {formatRelativeTime(event.occurred_at)}
          </span>
        </div>

        {/* Principal */}
        <div className="shrink-0">
          <PrincipalAvatar principal={event.principal} compact />
        </div>

        {/* Server name */}
        {event.server_name && (
          <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 sm:inline-block">
            {event.server_name}
          </span>
        )}

        {/* Category */}
        <div className="shrink-0">
          <CategoryPill category={event.category} />
        </div>

        {/* Summary + tags */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {event.corrects_event_id && (
              <span className="mr-1.5 inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                correction
              </span>
            )}
            {event.summary}
          </p>
          {event.tags.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Issue link indicator */}
        {event.issue_id && (
          <span className="shrink-0 text-xs text-indigo-500" title="Linked to issue">
            🔗
          </span>
        )}

        {/* Expand indicator */}
        {hasExpandableContent && (
          <span className="shrink-0 text-xs text-slate-400 transition-transform" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3" data-testid="event-detail">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Detail markdown */}
            {event.detail && (
              <div className="prose prose-sm prose-slate max-w-none">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Detail</h4>
                <Markdown remarkPlugins={[remarkGfm]}>{event.detail}</Markdown>
              </div>
            )}

            {/* Metadata JSON */}
            {Object.keys(event.metadata).length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Metadata</h4>
                <pre className="overflow-x-auto rounded-md bg-slate-800 p-3 text-xs text-slate-200">
                  {formatMetadata(event.metadata)}
                </pre>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {event.corrects_event_id && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <span>Corrects event:</span>
                <code className="rounded bg-amber-50 px-1 font-mono text-[10px]">
                  {event.corrects_event_id.slice(0, 8)}…
                </code>
              </span>
            )}
            {event.issue_id && (
              <Link
                to={`/issues/${event.issue_id}`}
                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View linked issue →
              </Link>
            )}
            {event.server_name && (
              <Link
                to={`/servers/${event.server_name}`}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {event.server_name} detail →
              </Link>
            )}
          </div>

          {/* Full timestamps */}
          <div className="mt-2 flex gap-4 text-[10px] text-slate-400">
            <span>Occurred: {new Date(event.occurred_at).toLocaleString()}</span>
            <span>Ingested: {new Date(event.ingested_at).toLocaleString()}</span>
            <span className="font-mono">ID: {event.id.slice(0, 8)}…</span>
          </div>
        </div>
      )}
    </article>
  );
}
