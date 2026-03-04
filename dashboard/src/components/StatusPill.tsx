import type { IssueStatus } from "@/api/types";

const statusStyles: Record<IssueStatus, string> = {
  open: "bg-red-400 text-white",
  investigating: "bg-brand text-white",
  watching: "bg-yellow-400 text-neo-gray-950",
  resolved: "bg-green-400 text-neo-gray-950",
  wontfix: "bg-neo-gray-300 text-neo-gray-950",
};

interface StatusPillProps {
  status: IssueStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`neo-badge ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
