import type { IssueStatus, Severity } from "@/api/types";
import type { FilterOption } from "@/components/FilterBar";
import { X, Server, Tag, Activity, AlertTriangle } from "lucide-react";

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

const inputClasses =
  "w-full bg-white border-2 border-neo-gray-950 px-3 py-2 text-sm font-bold focus:outline-none focus:bg-neo-gray-50 transition-colors placeholder:text-neo-gray-300";

const labelClasses = "mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neo-gray-400";

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

export function IssueFilterBar({ values, serverOptions, onChange, onClear }: IssueFilterBarProps) {
  const isDefault =
    values.statuses.length === ACTIVE_STATUSES.length &&
    ACTIVE_STATUSES.every((s) => values.statuses.includes(s)) &&
    values.severities.length === 0 &&
    values.server === "" &&
    values.tag === "";

  return (
    <div className="neo-card bg-white p-6 mb-8" data-testid="issue-filter-bar">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status checkboxes */}
        <div>
          <p className={labelClasses}>
            <Activity size={12} /> Status
          </p>
          <div className="flex flex-col gap-2">
            {ALL_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-xs font-bold text-neo-gray-800 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={values.statuses.includes(s)}
                  onChange={() => onChange({ ...values, statuses: toggleInArray(values.statuses, s) })}
                  className="w-4 h-4 border-2 border-neo-gray-950 rounded-none checked:bg-brand checked:border-neo-gray-950 appearance-none transition-colors cursor-pointer"
                  data-testid={`status-${s}`}
                />
                <span className="group-hover:text-brand transition-colors uppercase tracking-tight">{statusLabels[s]}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...values, statuses: [...ACTIVE_STATUSES] })}
            className="mt-3 text-[10px] font-black uppercase tracking-widest text-brand hover:underline"
          >
            ACTIVE ONLY
          </button>
        </div>

        {/* Severity checkboxes */}
        <div>
          <p className={labelClasses}>
            <AlertTriangle size={12} /> Severity
          </p>
          <div className="flex flex-col gap-2">
            {ALL_SEVERITIES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-xs font-bold text-neo-gray-800 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={values.severities.includes(s)}
                  onChange={() => onChange({ ...values, severities: toggleInArray(values.severities, s) })}
                  className="w-4 h-4 border-2 border-neo-gray-950 rounded-none checked:bg-neo-gray-950 checked:border-neo-gray-950 appearance-none transition-colors cursor-pointer"
                  data-testid={`severity-${s}`}
                />
                <span className="group-hover:text-brand transition-colors uppercase tracking-tight">{severityLabels[s]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Server dropdown */}
        <div>
          <label htmlFor="issue-filter-server" className={labelClasses}>
            <Server size={12} /> Server
          </label>
          <select
            id="issue-filter-server"
            value={values.server}
            onChange={(e) => onChange({ ...values, server: e.target.value })}
            className={inputClasses}
          >
            <option value="">ALL SERVERS</option>
            {serverOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Tag input */}
        <div>
          <label htmlFor="issue-filter-tag" className={labelClasses}>
            <Tag size={12} /> Tag
          </label>
          <input
            id="issue-filter-tag"
            value={values.tag}
            onChange={(e) => onChange({ ...values, tag: e.target.value })}
            placeholder="Filter by tag…"
            className={inputClasses}
          />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t-2 border-neo-gray-950/10 flex items-center justify-end">
        <button
          type="button"
          onClick={onClear}
          disabled={isDefault}
          className="neo-button bg-neo-gray-100 text-neo-gray-950 hover:bg-red-400 hover:text-white disabled:opacity-40 disabled:hover:bg-neo-gray-100 disabled:hover:text-neo-gray-950 py-2 px-4 flex items-center gap-2 text-xs"
        >
          <X size={14} /> RESET FILTERS
        </button>
      </div>
    </div>
  );
}
