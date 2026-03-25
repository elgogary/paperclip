export const SKILL_CATEGORY_BADGE: Record<string, string> = {
  Coding: "bg-indigo-500/14 text-indigo-300",
  Research: "bg-cyan-500/12 text-cyan-300",
  Communication: "bg-pink-500/12 text-pink-300",
  Data: "bg-cyan-500/12 text-cyan-300",
  Custom: "bg-amber-500/12 text-amber-300",
};

export const AGENT_COLORS = [
  { bg: "rgba(168,85,247,.15)", fg: "#c084fc" },
  { bg: "rgba(59,130,246,.15)", fg: "#93c5fd" },
  { bg: "rgba(236,72,153,.15)", fg: "#f9a8d4" },
  { bg: "rgba(34,197,94,.15)", fg: "#86efac" },
  { bg: "rgba(251,191,36,.15)", fg: "#fcd34d" },
  { bg: "rgba(249,115,22,.15)", fg: "#fdba74" },
  { bg: "rgba(6,182,212,.15)", fg: "#67e8f9" },
  { bg: "rgba(99,102,241,.15)", fg: "#a5b4fc" },
];

export function getInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAgentColor(index: number) {
  return AGENT_COLORS[index % AGENT_COLORS.length]!;
}
