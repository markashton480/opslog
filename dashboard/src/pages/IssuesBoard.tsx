import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LayoutGrid, Table as TableIcon } from "lucide-react";

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
    case "severity": {
      cmp = severityRank[a.severity] - severityRank[b.severity];
      // Tiebreak: last_occurrence DESC (most recent first)
      if (cmp === 0) {
        cmp = new Date(a.last_occurrence).getTime() - new Date(b.last_occurrence).getTime();
        // Apply same direction so tiebreak follows primary sort direction
      }
      break;
    }
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
  const noStatusSelected = filters.statuses.length === 0;
  const statusStr = filters.statuses.join(",");
  const severityStr = filters.severities.join(",");
  const apiParams = useMemo(() => {
    const p: Record<string, string> = { limit: "100" };
    if (statusStr) p.status = statusStr;
    if (severityStr) p.severity = severityStr;
    if (filters.server) p.server = filters.server;
    if (filters.tag) p.tag = filters.tag;
    return p;
  }, [statusStr, severityStr, filters.server, filters.tag]);

  const issuesQuery = useIssues(noStatusSelected ? undefined : apiParams, { refetchInterval: 60_000, enabled: !noStatusSelected });
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
    <section className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-5xl font-black tracking-tighter uppercase mb-3">Issues Board</h2>
          <p className="text-neo-gray-800 font-bold italic border-l-4 border-brand pl-4">Browse and manage infrastructure issues.</p>
        </div>
        {/* View toggle */}
        <div className="flex bg-white border-2 border-neo-gray-950 shadow-neo-sm">
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={`flex items-center gap-2 px-4 py-2 font-black transition ${viewMode === "kanban" ? "bg-neo-gray-950 text-white" : "text-neo-gray-600 hover:bg-neo-gray-50"}`}
          >
            <LayoutGrid size={18} />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-2 px-4 py-2 font-black border-l-2 border-neo-gray-950 transition ${viewMode === "table" ? "bg-neo-gray-950 text-white" : "text-neo-gray-600 hover:bg-neo-gray-50"}`}
          >
            <TableIcon size={18} />
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

      {issuesQuery.isLoading && <p className="font-bold italic animate-pulse">Loading issues…</p>}
      {issuesQuery.isError && <div className="neo-card bg-red-100 text-red-700 font-bold">Unable to load issues.</div>}

      {!issuesQuery.isLoading && !issuesQuery.isError && allIssues.length === 0 && (
        <div className="neo-card bg-neo-gray-100 p-20 text-center" data-testid="empty-issues">
          <p className="text-2xl font-black uppercase tracking-tighter text-neo-gray-400">No issues match the current filters</p>
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && allIssues.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-4" data-testid="kanban-grid">
          {([
            { key: "open", label: "Open", rows: groups.open, collapsible: false },
            { key: "investigating", label: "Investigating", rows: groups.investigating, collapsible: false },
            { key: "watching", label: "Watching", rows: groups.watching, collapsible: false },
            { key: "closed", label: "Resolved / Won't Fix", rows: groups.closed, collapsible: true },
          ] as const).map((col) => (
            <div key={col.key} className="bg-neo-gray-100/50 border-2 border-neo-gray-950 p-4 shadow-neo-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-neo-gray-500">
                  {col.label} <span className="text-neo-gray-400">({col.rows.length})</span>
                </h3>
                {col.collapsible && col.rows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setResolvedCollapsed(!resolvedCollapsed)}
                    className="text-[10px] font-black uppercase tracking-widest text-neo-gray-400 hover:text-neo-gray-950 border-b border-dashed border-neo-gray-400"
                  >
                    {resolvedCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>
              {col.collapsible && resolvedCollapsed ? null : (
                <div className="space-y-4">
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
        <div className="overflow-x-auto border-2 border-neo-gray-950 shadow-neo" data-testid="issues-table">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-neo-gray-950 bg-white">
              <tr>
                {([
                  ["title", "Title"],
                  ["status", "Status"],
                  ["severity", "Severity"],
                  ["server", "Server"],
                  ["created_by", "By"],
                  ["first_seen", "First Seen"],
                  ["last_occurrence", "Last Occ."],
                  ["updated_at", "Updated"],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(field); } }}
                    tabIndex={0}
                    role="columnheader"
                    aria-sort={sortField === field ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                    className="cursor-pointer whitespace-nowrap px-4 py-4 text-[10px] font-black uppercase tracking-widest text-neo-gray-950 hover:bg-neo-gray-50 select-none"
                  >
                    {label}{sortIndicator(field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-neo-gray-950 bg-white">
              {tableSorted.map((issue) => (
                <tr key={issue.id} className="hover:bg-neo-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <Link to={`/issues/${issue.id}`} className="font-black text-neo-gray-950 hover:text-brand transition-colors uppercase tracking-tight">
                      {issue.title}
                    </Link>
                  </td>
                  <td className="px-4 py-4"><StatusPill status={issue.status} /></td>
                  <td className="px-4 py-4"><SeverityBadge severity={issue.severity} /></td>
                  <td className="px-4 py-4 font-bold italic text-neo-gray-800">{issue.server_name ?? "—"}</td>
                  <td className="px-4 py-4"><PrincipalAvatar principal={issue.created_by} compact /></td>
                  <td className="px-4 py-4 text-[10px] font-bold text-neo-gray-400 uppercase italic" title={new Date(issue.first_seen).toLocaleString()}>
                    {formatRelativeTime(issue.first_seen)}
                  </td>
                  <td className="px-4 py-4 text-[10px] font-bold text-neo-gray-400 uppercase italic" title={new Date(issue.last_occurrence).toLocaleString()}>
                    {formatRelativeTime(issue.last_occurrence)}
                  </td>
                  <td className="px-4 py-4 text-[10px] font-bold text-neo-gray-400 uppercase italic" title={new Date(issue.updated_at).toLocaleString()}>
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
      className="neo-card neo-card-hover block p-4"
      data-testid="kanban-card"
    >
      <p className="line-clamp-2 text-sm font-black text-neo-gray-950 uppercase tracking-tight leading-tight mb-3">{issue.title}</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SeverityBadge severity={issue.severity} />
        {issue.server_name && (
          <span className="neo-badge bg-neo-gray-100">
            {issue.server_name}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-neo-gray-950/10">
        <PrincipalAvatar principal={issue.created_by} compact />
        <span className="text-[10px] font-bold italic text-neo-gray-400">{formatRelativeTime(issue.last_occurrence)}</span>
      </div>
    </Link>
  );
}
