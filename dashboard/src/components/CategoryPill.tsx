import type { EventCategory } from "@/api/types";

const categoryStyles: Record<EventCategory, string> = {
  deployment: "bg-blue-400 text-white",
  config_change: "bg-violet-400 text-white",
  dns: "bg-cyan-400 text-neo-gray-950",
  service: "bg-amber-400 text-neo-gray-950",
  security: "bg-red-500 text-white",
  backup: "bg-lime-400 text-neo-gray-950",
  network: "bg-sky-400 text-white",
  account: "bg-fuchsia-400 text-white",
  infra: "bg-indigo-400 text-white",
  ci: "bg-emerald-400 text-white",
  observation: "bg-neo-gray-200 text-neo-gray-800",
  other: "bg-neo-gray-100 text-neo-gray-500",
};

interface CategoryPillProps {
  category: EventCategory;
}

export function CategoryPill({ category }: CategoryPillProps) {
  return <span className={`neo-badge ${categoryStyles[category]}`}>{category}</span>;
}
