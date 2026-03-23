import { useQuery } from "@tanstack/react-query";
import { sanadBrainApi } from "../../api/sanad-brain";
import { queryKeys } from "../../lib/queryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Database, Users, HardDrive } from "lucide-react";

function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function LiveTab() {
  const { data: health } = useQuery({
    queryKey: queryKeys.brain.health,
    queryFn: () => sanadBrainApi.health(),
    refetchInterval: 30000,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.brain.activity,
    queryFn: () => sanadBrainApi.agentActivity(20),
    refetchInterval: 10000,
  });

  const qdrantPoints = health?.services?.qdrant?.points ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Database className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{qdrantPoints}</p>
              <p className="text-xs text-muted-foreground">Total Memories</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{activity?.activity?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Recent Ops</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">
                {new Set(activity?.activity?.map((a) => a.user_id) ?? []).size}
              </p>
              <p className="text-xs text-muted-foreground">Active Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <HardDrive className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{health?.version ?? "\u2014"}</p>
              <p className="text-xs text-muted-foreground">Version</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {(activity?.activity ?? []).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    entry.action === "WRITE" ? "bg-green-500/10 text-green-500" :
                    entry.action === "READ" ? "bg-blue-500/10 text-blue-500" :
                    entry.action === "DELETE" ? "bg-red-500/10 text-red-500" :
                    "bg-gray-500/10 text-gray-500"
                  }`}>
                    {entry.action}
                  </span>
                  <span className="text-muted-foreground">{entry.user_id}</span>
                  {entry.endpoint && <span className="text-xs text-muted-foreground">{entry.endpoint}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(entry.ts)}</span>
              </div>
            ))}
            {(!activity?.activity || activity.activity.length === 0) && (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
