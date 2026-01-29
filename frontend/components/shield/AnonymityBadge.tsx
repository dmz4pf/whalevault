"use client";

interface Props {
  depositCount: number;
}

function getPrivacyLevel(depositCount: number) {
  if (depositCount >= 20)
    return { color: "text-terminal-green", bg: "bg-terminal-green", label: "Strong" };
  if (depositCount >= 10)
    return { color: "text-terminal-green", bg: "bg-terminal-green", label: "Good" };
  if (depositCount >= 5)
    return { color: "text-yellow-500", bg: "bg-yellow-500", label: "Moderate" };
  return { color: "text-red-400", bg: "bg-red-400", label: "Low" };
}

export { getPrivacyLevel };

export function AnonymityBadge({ depositCount }: Props) {
  const level = getPrivacyLevel(depositCount);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${level.bg}`} />
      <span className={level.color}>{level.label}</span>
    </span>
  );
}
