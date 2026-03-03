import type { EventCategory } from "@/api/types";

const categoryStyles: Record<EventCategory, string> = {
  deployment: "bg-blue-100 text-blue-800",
  config_change: "bg-violet-100 text-violet-800",
  dns: "bg-cyan-100 text-cyan-800",
  service: "bg-amber-100 text-amber-800",
  security: "bg-red-100 text-red-800",
  backup: "bg-lime-100 text-lime-800",
  network: "bg-sky-100 text-sky-800",
  account: "bg-fuchsia-100 text-fuchsia-800",
  infra: "bg-indigo-100 text-indigo-800",
  ci: "bg-emerald-100 text-emerald-800",
  observation: "bg-slate-100 text-slate-700",
  other: "bg-zinc-100 text-zinc-700",
};

interface CategoryPillProps {
  category: EventCategory;
}

export function CategoryPill({ category }: CategoryPillProps) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${categoryStyles[category]}`}>{category}</span>;
}
