import { useEffect, useState } from "react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { cn } from "../lib/utils";
import { SwarmCatalog } from "../components/swarm/SwarmCatalog";
import { SwarmMySwarm } from "../components/swarm/SwarmMySwarm";
import { SwarmSources } from "../components/swarm/SwarmSources";
import { SwarmQueue } from "../components/swarm/SwarmQueue";
import { SwarmAudit } from "../components/swarm/SwarmAudit";

type Section = "catalog" | "myswarm" | "sources" | "queue" | "audit";

const NAV_ITEMS: { key: Section; icon: string; label: string }[] = [
  { key: "catalog", icon: "\u{1F4E6}", label: "Catalog" },
  { key: "myswarm", icon: "\u{1F41D}", label: "Capability Swarm" },
  { key: "sources", icon: "\u{1F517}", label: "Sources" },
  { key: "queue", icon: "\u{1F514}", label: "Queue" },
  { key: "audit", icon: "\u{1F4DC}", label: "Audit" },
];

export function Swarm() {
  const { selectedCompanyId: _companyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [activeSection, setActiveSection] = useState<Section>("catalog");

  useEffect(() => {
    setBreadcrumbs([{ label: "Capability Swarm" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="flex h-full">
      <div className="w-[200px] border-r border-border flex flex-col shrink-0">
        <div className="px-3.5 py-3 border-b border-border font-bold text-[15px]">
          Capability Swarm
        </div>
        <div className="flex-1 p-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all w-full text-left",
                activeSection === item.key
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className="w-[22px] text-center text-base" aria-hidden="true">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="px-3.5 py-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
          A living hub where agents discover, learn, and grow capabilities.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeSection === "catalog" && <SwarmCatalog />}
        {activeSection === "myswarm" && <SwarmMySwarm />}
        {activeSection === "sources" && <SwarmSources />}
        {activeSection === "queue" && <SwarmQueue />}
        {activeSection === "audit" && <SwarmAudit />}
      </div>
    </div>
  );
}
