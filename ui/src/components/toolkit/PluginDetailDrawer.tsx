import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { toolkitPluginsApi as pluginsApi, type Plugin } from "../../api/plugins";
import { queryKeys } from "../../lib/queryKeys";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AgentAccessChips } from "./AgentAccessChips";

interface PluginDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  plugin: Plugin | null;
}

export function PluginDetailDrawer({ open, onClose, plugin }: PluginDetailDrawerProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [grants, setGrants] = useState<{ agentId: string; granted: boolean }[]>([]);

  const { data: accessData } = useQuery({
    queryKey: queryKeys.plugins.access(selectedCompanyId!, plugin?.id ?? ""),
    queryFn: () => pluginsApi.getAccess(selectedCompanyId!, plugin!.id),
    enabled: !!selectedCompanyId && !!plugin,
  });

  useEffect(() => {
    if (accessData?.access) {
      setGrants(accessData.access.map((a) => ({ agentId: a.agentId, granted: a.granted })));
    }
  }, [accessData]);

  const updateAccess = useMutation({
    mutationFn: (newGrants: { agentId: string; granted: boolean }[]) =>
      pluginsApi.updateAccess(selectedCompanyId!, plugin!.id, newGrants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.access(selectedCompanyId!, plugin!.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.list(selectedCompanyId!) });
      onClose();
    },
  });

  function handleSave() {
    updateAccess.mutate(grants);
  }

  if (!plugin) return null;

  const tools = plugin.tools ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[500px] flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-[15px]">{plugin.icon ?? ""} {plugin.name} — Configure</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {plugin.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{plugin.description}</p>
          )}

          {tools.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold">Tools ({tools.length})</label>
              <div className="flex flex-col gap-1.5">
                {tools.map((tool) => (
                  <div key={tool.name} className="rounded-md border border-border bg-background px-3.5 py-2.5">
                    <p className="text-[13px] font-semibold">{tool.name}</p>
                    {tool.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{tool.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Agent Access</label>
            <AgentAccessChips grants={grants} onUpdate={setGrants} />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 py-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Discard</Button>
          <Button size="sm" onClick={handleSave} disabled={updateAccess.isPending}>
            {updateAccess.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
