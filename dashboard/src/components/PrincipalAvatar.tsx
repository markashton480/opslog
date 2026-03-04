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
  const bgColor = colorForPrincipal(principal);
  
  if (compact) {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center border-2 border-neo-gray-950 text-[10px] font-black text-white shadow-neo-sm ${bgColor}`}
        title={principal}
      >
        {initialsFromPrincipal(principal)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 group">
      <span
        aria-hidden
        className={`inline-flex h-8 w-8 items-center justify-center border-2 border-neo-gray-950 text-xs font-black text-white shadow-neo-sm group-hover:shadow-neo transition-all ${bgColor}`}
      >
        {initialsFromPrincipal(principal)}
      </span>
      <span className="text-sm font-black text-neo-gray-800 uppercase italic tracking-tight">@{principal}</span>
    </span>
  );
}
