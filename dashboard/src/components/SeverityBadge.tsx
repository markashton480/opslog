import type { Severity } from "@/api/types";

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-400 text-neo-gray-950",
  low: "bg-neo-gray-300 text-neo-gray-950",
};

interface SeverityBadgeProps {
  severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`neo-badge ${severityStyles[severity]}`}>
      {severity}
    </span>
  );
}
