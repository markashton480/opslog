import type { Severity } from "@/api/types";

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-400 text-slate-900",
  low: "bg-slate-300 text-slate-900",
};

interface SeverityBadgeProps {
  severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold uppercase ${severityStyles[severity]}`}>
      {severity}
    </span>
  );
}
