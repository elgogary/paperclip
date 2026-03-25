import {
  Crown,
  Brain,
  Rocket,
  Bug,
  Server,
  Briefcase,
  Phone,
  BarChart3,
  Palette,
  Code,
  Wrench,
  Zap,
} from "lucide-react";

export const AGENT_ICONS: Record<string, typeof Crown> = {
  crown: Crown,
  brain: Brain,
  rocket: Rocket,
  bug: Bug,
  server: Server,
  briefcase: Briefcase,
  phone: Phone,
  "chart-bar": BarChart3,
  palette: Palette,
  code: Code,
  wrench: Wrench,
  zap: Zap,
};

export const ROLE_COLORS: Record<string, string> = {
  ceo: "bg-amber-500",
  cto: "bg-purple-500",
  engineer: "bg-blue-500",
  pm: "bg-teal-500",
  qa: "bg-orange-500",
  devops: "bg-slate-500",
  general: "bg-indigo-500",
  researcher: "bg-emerald-500",
};

export const DEFAULT_ICON = Zap;
