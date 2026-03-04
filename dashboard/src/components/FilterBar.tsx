import { type ChangeEvent } from "react";
import { Search, X, Tag, Server, User, List } from "lucide-react";

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

const inputClasses =
  "w-full bg-white border-2 border-neo-gray-950 px-3 py-2 text-sm font-bold focus:outline-none focus:bg-neo-gray-50 transition-colors placeholder:text-neo-gray-300";

const labelClasses = "mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neo-gray-400";

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
    <div className="neo-card bg-white p-6 mb-8">
      {/* Row 1: dropdowns + search */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="filter-search" className={labelClasses}>
            <Search size={12} /> Search
          </label>
          <input
            id="filter-search"
            name="search"
            value={values.search}
            onChange={(e) => handleChange(e, values, onChange)}
            placeholder="Search summary…"
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="filter-server" className={labelClasses}>
            <Server size={12} /> Server
          </label>
          <select
            id="filter-server"
            name="server"
            value={values.server}
            onChange={(e) => handleChange(e, values, onChange)}
            className={inputClasses}
          >
            <option value="">ALL SERVERS</option>
            {serverOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-category" className={labelClasses}>
            <List size={12} /> Category
          </label>
          <select
            id="filter-category"
            name="category"
            value={values.category}
            onChange={(e) => handleChange(e, values, onChange)}
            className={inputClasses}
          >
            <option value="">ALL CATEGORIES</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-principal" className={labelClasses}>
            <User size={12} /> Principal
          </label>
          <select
            id="filter-principal"
            name="principal"
            value={values.principal}
            onChange={(e) => handleChange(e, values, onChange)}
            className={inputClasses}
          >
            <option value="">ALL PRINCIPALS</option>
            {principalOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-tag" className={labelClasses}>
            <Tag size={12} /> Tag
          </label>
          <input
            id="filter-tag"
            name="tag"
            value={values.tag}
            onChange={(e) => handleChange(e, values, onChange)}
            placeholder="Filter by tag…"
            className={inputClasses}
          />
        </div>
      </div>

      {/* Row 2: time range picker + clear button */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-6 pt-6 border-t-2 border-neo-gray-950/10">
        <div className="flex-1">
          <TimeRangePicker
            since={values.since}
            until={values.until}
            onSinceChange={(since) => onChange({ ...values, since })}
            onUntilChange={(until) => onChange({ ...values, until })}
          />
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasActiveFilters}
          className="neo-button bg-neo-gray-100 text-neo-gray-950 hover:bg-red-400 hover:text-white disabled:opacity-40 disabled:hover:bg-neo-gray-100 disabled:hover:text-neo-gray-950 py-2 px-4 flex items-center gap-2 text-xs"
        >
          <X size={14} /> CLEAR ALL
        </button>
      </div>
    </div>
  );
}
