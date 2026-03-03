interface TimeRangePickerProps {
  since: string;
  until: string;
  onSinceChange: (value: string) => void;
  onUntilChange: (value: string) => void;
}

interface PresetDef {
  label: string;
  hours: number;
}

const PRESETS: PresetDef[] = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

function toISOLocal(date: Date): string {
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isPresetActive(since: string, hours: number): boolean {
  if (!since) return false;
  const sinceDate = new Date(since);
  const expected = new Date(Date.now() - hours * 3600_000);
  // Allow 2-minute tolerance for preset detection
  return Math.abs(sinceDate.getTime() - expected.getTime()) < 120_000;
}

export function TimeRangePicker({ since, until, onSinceChange, onUntilChange }: TimeRangePickerProps) {
  const applyPreset = (hours: number) => {
    const sinceDate = new Date(Date.now() - hours * 3600_000);
    onSinceChange(sinceDate.toISOString());
    onUntilChange("");
  };

  const clearRange = () => {
    onSinceChange("");
    onUntilChange("");
  };

  const hasRange = since || until;

  return (
    <div className="space-y-2">
      {/* Preset buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">Range:</span>
        {PRESETS.map((preset) => {
          const active = !until && isPresetActive(since, preset.hours);
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.hours)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              data-testid={`preset-${preset.label}`}
            >
              {preset.label}
            </button>
          );
        })}
        {hasRange && (
          <button
            type="button"
            onClick={clearRange}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Custom date inputs */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="time-since" className="text-xs text-slate-500">
          From
        </label>
        <input
          id="time-since"
          type="datetime-local"
          value={since ? toISOLocal(new Date(since)) : ""}
          onChange={(e) => {
            const val = e.target.value;
            onSinceChange(val ? new Date(val).toISOString() : "");
          }}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
        <label htmlFor="time-until" className="text-xs text-slate-500">
          To
        </label>
        <input
          id="time-until"
          type="datetime-local"
          value={until ? toISOLocal(new Date(until)) : ""}
          onChange={(e) => {
            const val = e.target.value;
            onUntilChange(val ? new Date(val).toISOString() : "");
          }}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}
