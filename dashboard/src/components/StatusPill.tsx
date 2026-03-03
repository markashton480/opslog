import type { IssueStatus } from "@/api/types";

const statusStyles: Record<IssueStatus, string> = {
  open: "bg-red-100 text-red-800 border-red-200",
  investigating: "bg-amber-100 text-amber-800 border-amber-200",
  watching: "bg-yellow-100 text-yellow-800 border-yellow-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  wontfix: "bg-slate-100 text-slate-700 border-slate-200",
};

interface StatusPillProps {
  status: IssueStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
