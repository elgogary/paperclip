import { useEffect } from "react";
import { NavLink, Navigate, useParams } from "@/lib/router";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { Brain } from "lucide-react";
import { cn } from "../lib/utils";
import { LiveTab } from "../components/sanad-brain/LiveTab";
import { MemoriesTab } from "../components/sanad-brain/MemoriesTab";
import { HealthTab } from "../components/sanad-brain/HealthTab";
import { AuditTab } from "../components/sanad-brain/AuditTab";
import { GraphTab } from "../components/sanad-brain/GraphTab";

const TABS = [
  { path: "live", label: "Live", component: LiveTab },
  { path: "memories", label: "Memories", component: MemoriesTab },
  { path: "graph", label: "Graph", component: GraphTab },
  { path: "health", label: "Health", component: HealthTab },
  { path: "audit", label: "Audit", component: AuditTab },
] as const;

export function SanadBrain() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab || "live";

  useEffect(() => {
    setBreadcrumbs([{ label: "Brain" }]);
  }, [setBreadcrumbs]);

  const TabComponent = TABS.find((t) => t.path === activeTab)?.component;

  if (!tab) {
    return <Navigate to="/brain/live" replace />;
  }

  if (!TabComponent) {
    return <Navigate to="/brain/live" replace />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Sanad Brain</h1>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <NavLink
            key={t.path}
            to={`/brain/${t.path}`}
            className={({ isActive }) =>
              cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <TabComponent />
    </div>
  );
}
