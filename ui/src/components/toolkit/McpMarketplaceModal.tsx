import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { mcpServersApi, type McpCatalogEntry } from "../../api/mcp-servers";
import { queryKeys } from "../../lib/queryKeys";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

interface McpMarketplaceModalProps {
  open: boolean;
  onClose: () => void;
  installedSlugs: string[];
  onInstall: (catalogId: string) => void;
}

const CATEGORY_BADGE: Record<string, string> = {
  development: "bg-indigo-500/14 text-indigo-300",
  communication: "bg-pink-500/12 text-pink-300",
  database: "bg-cyan-500/12 text-cyan-300",
  search: "bg-amber-500/12 text-amber-300",
  productivity: "bg-emerald-500/12 text-emerald-300",
  files: "bg-green-500/12 text-green-300",
};

export function McpMarketplaceModal({ open, onClose, installedSlugs, onInstall }: McpMarketplaceModalProps) {
  const { selectedCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: catalogData } = useQuery({
    queryKey: queryKeys.mcpServers.catalog(selectedCompanyId!),
    queryFn: () => mcpServersApi.listCatalog(selectedCompanyId!),
    enabled: !!selectedCompanyId && open,
  });

  const catalog: McpCatalogEntry[] = catalogData?.catalog ?? [];

  const categories = useMemo(() => {
    const cats = new Set(catalog.map((c) => c.category).filter(Boolean) as string[]);
    return ["All", ...Array.from(cats)];
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !(c.description ?? "").toLowerCase().includes(q)) return false;
      if (activeCategory !== "All" && c.category !== activeCategory) return false;
      return true;
    });
  }, [catalog, search, activeCategory]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[680px] p-0 gap-0">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-base font-bold">MCP Marketplace</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search servers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize",
                  activeCategory === cat
                    ? "bg-accent text-foreground border-foreground/20"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map((entry) => {
              const isInstalled = installedSlugs.includes(entry.id);
              return (
                <div
                  key={entry.id}
                  className="rounded-md border border-border bg-background p-3"
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    {entry.icon ?? "\u{1F50C}"} {entry.name}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {entry.description}
                  </p>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      CATEGORY_BADGE[entry.category ?? ""] ?? "bg-muted text-muted-foreground",
                    )}>
                      {entry.category ?? "General"}
                    </span>
                    {isInstalled ? (
                      <span className="text-xs text-emerald-400 font-medium">Installed</span>
                    ) : (
                      <Button
                        size="sm"
                        className="h-6 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={() => onInstall(entry.id)}
                      >
                        Install
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {catalog.length === 0 ? "Loading catalog..." : "No servers match your search."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
