import type { IssueStatus, Severity } from "@/api/types";
import type { FilterOption } from "@/components/FilterBar";

export interface IssueFilterValues {
  statuses: IssueStatus[];
  severities: Severity[];
  server: string;
  tag: string;
}

export const ACTIVE_STATUSES: IssueStatus[] = ["open", "investigating", "watching"];
export const ALL_STATUSES: IssueStatus[] = ["open", "investigating", "watching", "resolved", "wontfix"];
export const ALL_SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export const EMPTY_ISSUE_FILTERS: IssueFilterValues = {
  statuses: [...ACTIVE_STATUSES],
  severities: [],
  server: "",
  tag: "",
};

interface IssueFilterBarProps {
  values: IssueFilterValues;
  serverOptions: FilterOption[];
  onChange: (next: IssueFilterValues) => void;
  onClear: () => void;
}

const selectClasses =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm transition focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

function toggleInArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

const statusLabels: Record<IssueStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  watching: "Watching",
  resolved: "Resolved",
  wontfix: "Won't Fix",
};

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const severityColors: Record<Severity, string> = {
  critical: "accent-red-500",
  high: "accent-orange-500",
  medium: "accent-yellow-500",
  low: "accent-slate-400",
};

export function IssueFilterBar({ values, serverOptions, onChange, onClear }: IssueFilterBarProps) {
  const isDefault =
    values.statuses.length === ACTIVE_STATUSES.length &&
    ACTIVE_STATUSES.every((s) => values.statuses.includes(s)) &&
    values.severities.length === 0 &&
    values.server === "" &&
    values.tag === "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="issue-filter-bar">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status checkboxes */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {ALL_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.statuses.includes(s)}
                  onChange={() => onChange({ ...values, statuses: toggleInArray(values.statuses, s) })}
                  className="rounded border-slate-300"
                  data-testid={`status-${s}`}
                />
                {statusLabels[s]}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...values, statuses: [...ACTIVE_STATUSES] })}
            className="mt-1 text-[10px] font-medium text-indigo-600 hover:underline"
          >
            Active only
          </button>
        </div>

        {/* Severity checkboxes */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Severity</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {ALL_SEVERITIES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.severities.includes(s)}
                  onChange={() => onChange({ ...values, severities: toggleInArray(values.severities, s) })}
                  className={`rounded border-slate-300 ${severityColors[s]}`}
                  data-testid={`severity-${s}`}
                />
                {severityLabels[s]}
              </label>
            ))}
          </div>
        </div>

        {/* Server dropdown */}
        <div>
          <label htmlFor="issue-filter-server" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Server
          </label>
          <select
            id="issue-filter-server"
            value={values.server}
            onChange={(e) => onChange({ ...values, server: e.target.value })}
            className={selectClasses}
          >
            <option value="">All servers</option>
            {serverOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Tag input */}
        <div>
          <label htmlFor="issue-filter-tag" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Tag
          </label>
          <input
            id="issue-filter-tag"
            value={values.tag}
            onChange={(e) => onChange({ ...values, tag: e.target.value })}
            placeholder="Filter by tag…"
            className={selectClasses}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onClear}
          disabled={isDefault}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
