import { type ChangeEvent } from "react";

import { TimeRangePicker } from "@/components/TimeRangePicker";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterValues {
  search: string;
  server: string;
  category: string;
  principal: string;
  tag: string;
  since: string;
  until: string;
}

export const EMPTY_FILTERS: FilterValues = {
  search: "",
  server: "",
  category: "",
  principal: "",
  tag: "",
  since: "",
  until: "",
};

interface FilterBarProps {
  values: FilterValues;
  serverOptions: FilterOption[];
  categoryOptions: FilterOption[];
  principalOptions: FilterOption[];
  onChange: (next: FilterValues) => void;
  onClear: () => void;
}

function handleChange(
  event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  values: FilterValues,
  onChange: (next: FilterValues) => void
): void {
  const { name, value } = event.target;
  onChange({ ...values, [name]: value });
}

const selectClasses =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm transition focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

export function FilterBar({
  values,
  serverOptions,
  categoryOptions,
  principalOptions,
  onChange,
  onClear,
}: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== "");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Row 1: dropdowns + search */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="filter-search" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Search
          </label>
          <input
            id="filter-search"
            name="search"
            value={values.search}
            onChange={(e) => handleChange(e, values, onChange)}
            placeholder="Search summary…"
            className={selectClasses}
          />
        </div>
        <div>
          <label htmlFor="filter-server" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Server
          </label>
          <select
            id="filter-server"
            name="server"
            value={values.server}
            onChange={(e) => handleChange(e, values, onChange)}
            className={selectClasses}
          >
            <option value="">All servers</option>
            {serverOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-category" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Category
          </label>
          <select
            id="filter-category"
            name="category"
            value={values.category}
            onChange={(e) => handleChange(e, values, onChange)}
            className={selectClasses}
          >
            <option value="">All categories</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-principal" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Principal
          </label>
          <select
            id="filter-principal"
            name="principal"
            value={values.principal}
            onChange={(e) => handleChange(e, values, onChange)}
            className={selectClasses}
          >
            <option value="">All principals</option>
            {principalOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-tag" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Tag
          </label>
          <input
            id="filter-tag"
            name="tag"
            value={values.tag}
            onChange={(e) => handleChange(e, values, onChange)}
            placeholder="Filter by tag…"
            className={selectClasses}
          />
        </div>
      </div>

      {/* Row 2: time range picker + clear button */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <TimeRangePicker
          since={values.since}
          until={values.until}
          onSinceChange={(since) => onChange({ ...values, since })}
          onUntilChange={(until) => onChange({ ...values, until })}
        />
        <button
          type="button"
          onClick={onClear}
          disabled={!hasActiveFilters}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
