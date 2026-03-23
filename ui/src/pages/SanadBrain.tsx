import { useEffect } from "react";
import { NavLink, Route, Routes, Navigate } from "@/lib/router";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { Brain } from "lucide-react";
import { cn } from "../lib/utils";
import { LiveTab } from "../components/sanad-brain/LiveTab";
import { MemoriesTab } from "../components/sanad-brain/MemoriesTab";
import { HealthTab } from "../components/sanad-brain/HealthTab";
import { AuditTab } from "../components/sanad-brain/AuditTab";

const TABS = [
  { path: "live", label: "Live" },
  { path: "memories", label: "Memories" },
  { path: "health", label: "Health" },
  { path: "audit", label: "Audit" },
] as const;

export function SanadBrain() {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Brain" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Sanad Brain</h1>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/brain/${tab.path}`}
            className={({ isActive }) =>
              cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="live" replace />} />
        <Route path="live" element={<LiveTab />} />
        <Route path="memories" element={<MemoriesTab />} />
        <Route path="health" element={<HealthTab />} />
        <Route path="audit" element={<AuditTab />} />
      </Routes>
    </div>
  );
}
