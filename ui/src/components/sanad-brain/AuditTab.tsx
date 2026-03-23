import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sanadBrainApi } from "../../api/sanad-brain";
import { queryKeys } from "../../lib/queryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { getActionBadgeClass } from "./shared";

const ACTION_OPTIONS = ["", "WRITE", "READ", "DELETE", "FEEDBACK", "CONSOLIDATE"];

export function AuditTab() {
  const [actionFilter, setActionFilter] = useState("");
  const [limit, setLimit] = useState(50);

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.brain.audit(limit), actionFilter],
    queryFn: () => sanadBrainApi.audit(limit, actionFilter || undefined),
    refetchInterval: 15000,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <select
          aria-label="Filter by action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt || "All Actions"}</option>
          ))}
        </select>
        <select
          aria-label="Rows per page"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="text-sm bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={25}>25 rows</option>
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
        </select>
        <span className="text-xs text-muted-foreground">
          {data?.total ?? 0} total entries
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Audit log">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Action</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Company</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {(data?.entries ?? []).map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.ts * 1000).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getActionBadgeClass(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs">{entry.user_id}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{entry.company_id}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{entry.endpoint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isLoading && !data && <p className="text-sm text-muted-foreground p-4">Loading...</p>}
          {!isLoading && (data?.entries ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No audit entries</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
