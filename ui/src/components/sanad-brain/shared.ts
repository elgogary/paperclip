export function getActionBadgeClass(action: string): string {
  switch (action) {
    case "WRITE": return "bg-green-500/10 text-green-500";
    case "READ": return "bg-blue-500/10 text-blue-500";
    case "DELETE": return "bg-red-500/10 text-red-500";
    case "FEEDBACK": return "bg-purple-500/10 text-purple-500";
    default: return "bg-gray-500/10 text-gray-400";
  }
}

export function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
