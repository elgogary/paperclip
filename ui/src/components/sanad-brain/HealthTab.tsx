import { useQuery } from "@tanstack/react-query";
import { sanadBrainApi } from "../../api/sanad-brain";
import { queryKeys } from "../../lib/queryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, MinusCircle, RefreshCw } from "lucide-react";

const STATUS_CONFIG = {
  up: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Online" },
  down: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Offline" },
  disabled: { icon: MinusCircle, color: "text-gray-400", bg: "bg-gray-500/10", label: "Disabled" },
} as const;

export function HealthTab() {
  const { data: health, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.brain.health,
    queryFn: () => sanadBrainApi.health(),
    refetchInterval: 30000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Checking services...</p>;
  if (error) return <p className="text-sm text-destructive">Failed to check health: {(error as Error).message}</p>;

  const services = health?.services ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Service Status</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(services).map(([name, svc]) => {
          const config = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.down;
          const Icon = config.icon;
          return (
            <Card key={name}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize">{name}</p>
                    <p className={`text-xs ${config.color}`}>{config.label}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {svc.points !== undefined && (
                    <p className="text-xs text-muted-foreground">Points: {svc.points}</p>
                  )}
                  {svc.models && (
                    <p className="text-xs text-muted-foreground">Models: {svc.models.join(", ")}</p>
                  )}
                  {svc.healthy_models !== undefined && (
                    <p className="text-xs text-muted-foreground">Healthy models: {svc.healthy_models}</p>
                  )}
                  {svc.error && (
                    <p className="text-xs text-red-400 truncate" title={svc.error}>{svc.error}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {health?.version && (
        <p className="text-xs text-muted-foreground">Sanad Brain v{health.version}</p>
      )}
    </div>
  );
}
