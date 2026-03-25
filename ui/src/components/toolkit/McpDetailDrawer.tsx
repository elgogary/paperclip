import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { mcpServersApi, type McpServerConfig } from "../../api/mcp-servers";
import { queryKeys } from "../../lib/queryKeys";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentAccessChips } from "./AgentAccessChips";
import { Plus, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface McpDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  server: McpServerConfig | null;
}

export function McpDetailDrawer({ open, onClose, server }: McpDetailDrawerProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [transport, setTransport] = useState("stdio");
  const [direction, setDirection] = useState("outbound");
  const [envRows, setEnvRows] = useState<{ id: number; key: string; value: string }[]>([]);
  const [nextEnvId, setNextEnvId] = useState(0);
  const [grants, setGrants] = useState<{ agentId: string; granted: boolean }[]>([]);

  const { data: accessData } = useQuery({
    queryKey: queryKeys.mcpServers.access(selectedCompanyId!, server?.id ?? ""),
    queryFn: () => mcpServersApi.getAccess(selectedCompanyId!, server!.id),
    enabled: !!selectedCompanyId && !!server,
  });

  useEffect(() => {
    if (server) {
      setTransport(server.transport ?? "stdio");
      setDirection(server.direction ?? "outbound");
      const env = server.env ?? {};
      const entries = Object.entries(env);
      setEnvRows(entries.map(([key, value], i) => ({ id: i, key, value })));
      setNextEnvId(entries.length);
    }
  }, [server]);

  useEffect(() => {
    if (accessData?.access) {
      setGrants(accessData.access.map((a) => ({ agentId: a.agentId, granted: a.granted })));
    }
  }, [accessData]);

  const updateServer = useMutation({
    mutationFn: () => {
      const env: Record<string, string> = {};
      for (const r of envRows) { if (r.key) env[r.key] = r.value; }
      return mcpServersApi.update(selectedCompanyId!, server!.id, { transport, direction, env });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) });
      onClose();
    },
  });

  const updateAccess = useMutation({
    mutationFn: (newGrants: { agentId: string; granted: boolean }[]) =>
      mcpServersApi.updateAccess(selectedCompanyId!, server!.id, newGrants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.access(selectedCompanyId!, server!.id) });
    },
  });

  function handleSave() {
    updateServer.mutate(undefined, {
      onSuccess: () => updateAccess.mutate(grants),
    });
  }

  function addEnvRow() {
    setEnvRows((prev) => [...prev, { id: nextEnvId, key: "", value: "" }]);
    setNextEnvId((prev) => prev + 1);
  }

  function removeEnvRow(rowId: number) {
    setEnvRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  if (!server) return null;

  const tools: string[] = Array.isArray((server.configJson as Record<string, unknown> | null)?.tools)
    ? ((server.configJson as Record<string, unknown>).tools as string[])
    : [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[500px] flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-[15px]">{server.name} — Configure</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Transport</label>
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
              >
                <option value="stdio">stdio</option>
                <option value="sse">sse</option>
                <option value="streamable-http">streamable-http</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Environment Variables</label>
            {envRows.map((row) => (
              <div key={row.id} className="flex gap-2 items-center">
                <Input
                  value={row.key}
                  onChange={(e) => {
                    setEnvRows((prev) =>
                      prev.map((r) => r.id === row.id ? { ...r, key: e.target.value } : r),
                    );
                  }}
                  className="max-w-[160px] text-muted-foreground"
                  placeholder="KEY"
                />
                <Input
                  type="password"
                  value={row.value}
                  onChange={(e) => {
                    setEnvRows((prev) =>
                      prev.map((r) => r.id === row.id ? { ...r, value: e.target.value } : r),
                    );
                  }}
                  className="flex-1"
                  placeholder="value"
                />
                <button onClick={() => removeEnvRow(row.id)} aria-label="Remove variable" className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addEnvRow} className="mt-1">
              <Plus className="h-3 w-3 mr-1" /> Add Variable
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Agent Access</label>
            <AgentAccessChips grants={grants} onUpdate={setGrants} />
          </div>

          {tools.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Tools ({tools.length})</label>
              <div className="flex flex-wrap gap-1">
                {tools.slice(0, 8).map((t) => (
                  <span key={t} className="inline-flex items-center rounded-full bg-blue-500/12 text-blue-300 px-2 py-0.5 text-[10px] font-medium">
                    {t}
                  </span>
                ))}
                {tools.length > 8 && (
                  <span className="text-[11px] text-muted-foreground px-1 py-0.5">+{tools.length - 8} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Discard</Button>
          <Button size="sm" onClick={handleSave} disabled={updateServer.isPending}>
            {updateServer.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
