import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { skillsApi } from "../api/skills";
import { mcpServersApi } from "../api/mcp-servers";
import { connectorsApi } from "../api/connectors";
import { pluginsApi } from "../api/plugins";
import { queryKeys } from "../lib/queryKeys";
import { SkillsSection } from "../components/toolkit/SkillsSection";
import { McpServersSection } from "../components/toolkit/McpServersSection";
import { ConnectorsSection } from "../components/toolkit/ConnectorsSection";
import { PluginsSection } from "../components/toolkit/PluginsSection";
import { cn } from "../lib/utils";

type Section = "skills" | "mcp" | "connectors" | "plugins";

const NAV_ITEMS: { key: Section; icon: string; label: string }[] = [
  { key: "skills", icon: "\u{1F4DC}", label: "Skills" },
  { key: "mcp", icon: "\u{1F50C}", label: "MCP Servers" },
  { key: "connectors", icon: "\u{1F517}", label: "Connectors" },
  { key: "plugins", icon: "\u{1F9E9}", label: "Plugins" },
];

export function Toolkit() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [activeSection, setActiveSection] = useState<Section>("skills");

  useEffect(() => {
    setBreadcrumbs([{ label: "Toolkit & Capabilities" }]);
  }, [setBreadcrumbs]);

  // Fetch counts for nav badges
  const { data: skillsData } = useQuery({
    queryKey: queryKeys.skills.list(selectedCompanyId!),
    queryFn: () => skillsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: serversData } = useQuery({
    queryKey: queryKeys.mcpServers.list(selectedCompanyId!),
    queryFn: () => mcpServersApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: connectorsData } = useQuery({
    queryKey: queryKeys.connectors.list(selectedCompanyId!),
    queryFn: () => connectorsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: pluginsData } = useQuery({
    queryKey: queryKeys.plugins.list(selectedCompanyId!),
    queryFn: () => pluginsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const counts: Record<Section, number> = {
    skills: skillsData?.skills?.length ?? 0,
    mcp: serversData?.servers?.length ?? 0,
    connectors: connectorsData?.connectors?.length ?? 0,
    plugins: pluginsData?.plugins?.length ?? 0,
  };

  return (
    <div className="flex h-full">
      {/* Inner sidebar */}
      <div className="w-[200px] border-r border-border flex flex-col shrink-0">
        <div className="px-3.5 py-3 border-b border-border font-bold text-[15px]">
          Toolkit
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
              <span className="w-[22px] text-center text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span
                className={cn(
                  "text-[10px] rounded-full px-1.5 py-px bg-muted",
                  activeSection === item.key ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {counts[item.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="px-3.5 py-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
          Extend your agents with skills, connect external tools, and manage integrations.
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeSection === "skills" && <SkillsSection />}
        {activeSection === "mcp" && <McpServersSection />}
        {activeSection === "connectors" && <ConnectorsSection />}
        {activeSection === "plugins" && <PluginsSection />}
      </div>
    </div>
  );
}
