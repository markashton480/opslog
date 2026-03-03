import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import {
  IssueFilterBar,
  EMPTY_ISSUE_FILTERS,
  ACTIVE_STATUSES,
  type IssueFilterValues,
} from "@/components/IssueFilterBar";
import { formatRelativeTime } from "@/utils/format";
import { useIssues } from "@/hooks/useIssues";
import { useServers } from "@/hooks/useServers";
import type { Issue, IssueStatus, Severity } from "@/api/types";

/* ── Severity sort rank (higher = more severe) ─────────── */

const severityRank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const sevDiff = severityRank[b.severity] - severityRank[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.last_occurrence).getTime() - new Date(a.last_occurrence).getTime();
  });
}

/* ── URL ↔ filter helpers ──────────────────────────────── */

function filtersFromParams(params: URLSearchParams): IssueFilterValues {
  const statusRaw = params.get("status");
  const sevRaw = params.get("severity");
  return {
    statuses: statusRaw !== null
      ? (statusRaw === "" ? [] : statusRaw.split(",") as IssueStatus[])
      : [...ACTIVE_STATUSES],
    severities: sevRaw ? (sevRaw.split(",") as Severity[]) : [],
    server: params.get("server") ?? "",
    tag: params.get("tag") ?? "",
  };
}

function paramsFromFilters(f: IssueFilterValues): Record<string, string> {
  const p: Record<string, string> = {};
  const isDefault = f.statuses.length === ACTIVE_STATUSES.length && ACTIVE_STATUSES.every((s) => f.statuses.includes(s));
  if (!isDefault) {
    p.status = f.statuses.join(","); // empty string signals "none selected"
  }
  if (f.severities.length > 0) p.severity = f.severities.join(",");
  if (f.server) p.server = f.server;
  if (f.tag) p.tag = f.tag;
  return p;
}

/* ── Table sort logic ──────────────────────────────────── */

type SortField = "title" | "status" | "severity" | "server" | "created_by" | "first_seen" | "last_occurrence" | "updated_at";
type SortDir = "asc" | "desc";

const statusOrder: Record<IssueStatus, number> = { open: 0, investigating: 1, watching: 2, resolved: 3, wontfix: 4 };

function compareIssues(a: Issue, b: Issue, field: SortField, dir: SortDir): number {
  let cmp = 0;
  switch (field) {
    case "title": cmp = a.title.localeCompare(b.title); break;
    case "status": cmp = statusOrder[a.status] - statusOrder[b.status]; break;
    case "severity": cmp = severityRank[a.severity] - severityRank[b.severity]; break;
    case "server": cmp = (a.server_name ?? "").localeCompare(b.server_name ?? ""); break;
    case "created_by": cmp = a.created_by.localeCompare(b.created_by); break;
    case "first_seen": cmp = new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime(); break;
    case "last_occurrence": cmp = new Date(a.last_occurrence).getTime() - new Date(b.last_occurrence).getTime(); break;
    case "updated_at": cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break;
  }
  return dir === "asc" ? cmp : -cmp;
}

/* ── Component ─────────────────────────────────────────── */

type ViewMode = "kanban" | "table";

export function IssuesBoard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filters = filtersFromParams(searchParams);

  const setFilters = useCallback(
    (next: IssueFilterValues) => setSearchParams(paramsFromFilters(next), { replace: true }),
    [setSearchParams],
  );
  const resetFilters = useCallback(
    () => setSearchParams(paramsFromFilters(EMPTY_ISSUE_FILTERS), { replace: true }),
    [setSearchParams],
  );

  // Build API params from filters
  const apiParams = useMemo(() => {
    const p: Record<string, string> = { limit: "100" };
    if (filters.statuses.length > 0) p.status = filters.statuses.join(",");
    if (filters.severities.length > 0) p.severity = filters.severities.join(",");
    if (filters.server) p.server = filters.server;
    if (filters.tag) p.tag = filters.tag;
    return p;
  }, [filters]);

  const issuesQuery = useIssues(apiParams, { refetchInterval: 60_000 });
  const serversQuery = useServers();

  const allIssues = useMemo(() => issuesQuery.data?.data ?? [], [issuesQuery.data?.data]);

  // Server options for filter
  const serverOptions = useMemo(
    () => (serversQuery.data ?? []).map((s) => ({ label: s.name, value: s.name })),
    [serversQuery.data],
  );

  // Kanban groups
  const [resolvedCollapsed, setResolvedCollapsed] = useState(true);

  const groups = useMemo(() => ({
    open: sortIssues(allIssues.filter((i) => i.status === "open")),
    investigating: sortIssues(allIssues.filter((i) => i.status === "investigating")),
    watching: sortIssues(allIssues.filter((i) => i.status === "watching")),
    closed: sortIssues(allIssues.filter((i) => i.status === "resolved" || i.status === "wontfix")),
  }), [allIssues]);

  // Table sort
  const tableSorted = useMemo(
    () => [...allIssues].sort((a, b) => compareIssues(a, b, sortField, sortDir)),
    [allIssues, sortField, sortDir],
  );

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Issues Board</h2>
          <p className="text-sm text-slate-600">Browse and manage infrastructure issues.</p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-300 text-sm">
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-1.5 font-medium transition ${viewMode === "kanban" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"} rounded-l-lg`}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 font-medium transition ${viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"} rounded-r-lg`}
          >
            Table
          </button>
        </div>
      </header>

      {/* Filters */}
      <IssueFilterBar
        values={filters}
        serverOptions={serverOptions}
        onChange={setFilters}
        onClear={resetFilters}
      />

      {issuesQuery.isLoading && <p className="text-slate-600">Loading issues…</p>}
      {issuesQuery.isError && <p className="text-red-700">Unable to load issues.</p>}

      {!issuesQuery.isLoading && !issuesQuery.isError && allIssues.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center" data-testid="empty-issues">
          <p className="text-lg font-medium text-slate-600">No issues match the current filters</p>
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && allIssues.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-4" data-testid="kanban-grid">
          {([
            { key: "open", label: "Open", rows: groups.open, collapsible: false },
            { key: "investigating", label: "Investigating", rows: groups.investigating, collapsible: false },
            { key: "watching", label: "Watching", rows: groups.watching, collapsible: false },
            { key: "closed", label: "Resolved / Won't Fix", rows: groups.closed, collapsible: true },
          ] as const).map((col) => (
            <div key={col.key} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {col.label} <span className="text-slate-400">({col.rows.length})</span>
                </h3>
                {col.collapsible && col.rows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setResolvedCollapsed(!resolvedCollapsed)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    {resolvedCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>
              {col.collapsible && resolvedCollapsed ? null : (
                <div className="space-y-2">
                  {col.rows.map((issue) => (
                    <KanbanCard key={issue.id} issue={issue} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && allIssues.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="issues-table">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {([
                  ["title", "Title"],
                  ["status", "Status"],
                  ["severity", "Severity"],
                  ["server", "Server"],
                  ["created_by", "Created By"],
                  ["first_seen", "First Seen"],
                  ["last_occurrence", "Last Occurrence"],
                  ["updated_at", "Updated At"],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(field); } }}
                    tabIndex={0}
                    role="columnheader"
                    aria-sort={sortField === field ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                    className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 select-none"
                  >
                    {label}{sortIndicator(field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableSorted.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <Link to={`/issues/${issue.id}`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline">
                      {issue.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={issue.status} /></td>
                  <td className="px-4 py-3"><SeverityBadge severity={issue.severity} /></td>
                  <td className="px-4 py-3 text-slate-600">{issue.server_name ?? "—"}</td>
                  <td className="px-4 py-3"><PrincipalAvatar principal={issue.created_by} compact /></td>
                  <td className="px-4 py-3 text-xs text-slate-500" title={new Date(issue.first_seen).toLocaleString()}>
                    {formatRelativeTime(issue.first_seen)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500" title={new Date(issue.last_occurrence).toLocaleString()}>
                    {formatRelativeTime(issue.last_occurrence)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500" title={new Date(issue.updated_at).toLocaleString()}>
                    {formatRelativeTime(issue.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Kanban card (rich issue card) ─────────────────────── */

function KanbanCard({ issue }: { issue: Issue }) {
  return (
    <Link
      to={`/issues/${issue.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:shadow-md hover:border-slate-300"
      data-testid="kanban-card"
    >
      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{issue.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={issue.severity} />
        {issue.server_name && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {issue.server_name}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <PrincipalAvatar principal={issue.created_by} compact />
        <span className="text-[10px] text-slate-500">{formatRelativeTime(issue.last_occurrence)}</span>
      </div>
      {issue.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {issue.tags.map((tag) => (
            <span key={tag} className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
