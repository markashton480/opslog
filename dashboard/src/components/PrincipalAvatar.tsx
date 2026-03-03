const palette = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-indigo-500",
];

function initialsFromPrincipal(principal: string): string {
  const parts = principal.split(/[-_\s]+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function colorForPrincipal(principal: string): string {
  const value = principal
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[value % palette.length];
}

interface PrincipalAvatarProps {
  principal: string;
  compact?: boolean;
}

export function PrincipalAvatar({ principal, compact }: PrincipalAvatarProps) {
  if (compact) {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${colorForPrincipal(principal)}`}
        title={principal}
      >
        {initialsFromPrincipal(principal)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${colorForPrincipal(principal)}`}
      >
        {initialsFromPrincipal(principal)}
      </span>
      <span className="text-sm font-medium text-slate-700">{principal}</span>
    </span>
  );
}
