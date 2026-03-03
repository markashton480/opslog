import { type ChangeEvent } from "react";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterValues {
  search: string;
  server: string;
  category: string;
  principal: string;
}

interface FilterBarProps {
  values: FilterValues;
  serverOptions: FilterOption[];
  categoryOptions: FilterOption[];
  principalOptions: FilterOption[];
  onChange: (next: FilterValues) => void;
  onClear: () => void;
}

function updateValue(
  event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  values: FilterValues,
  onChange: (next: FilterValues) => void
): void {
  const { name, value } = event.target;
  onChange({ ...values, [name]: value });
}

export function FilterBar({
  values,
  serverOptions,
  categoryOptions,
  principalOptions,
  onChange,
  onClear,
}: FilterBarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <input
          name="search"
          value={values.search}
          onChange={(event) => updateValue(event, values, onChange)}
          placeholder="Search summary"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="server"
          value={values.server}
          onChange={(event) => updateValue(event, values, onChange)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All servers</option>
          {serverOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          name="category"
          value={values.category}
          onChange={(event) => updateValue(event, values, onChange)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          name="principal"
          value={values.principal}
          onChange={(event) => updateValue(event, values, onChange)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All principals</option>
          {principalOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
