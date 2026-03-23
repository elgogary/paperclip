import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sanadBrainApi } from "../../api/sanad-brain";
import { queryKeys } from "../../lib/queryKeys";
import { useCompany } from "../../context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Trash2, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
import type { Memory } from "../../api/sanad-brain";

export function MemoriesTab() {
  const { selectedCompany } = useCompany();
  // Map Paperclip company to Sanad Brain company_id
  // Paperclip uses issuePrefix (OPT), Brain uses first word of name (optiflow)
  const companyId = selectedCompany
    ? (selectedCompany.name?.split(" ")[0]?.toLowerCase() || selectedCompany.issuePrefix?.toLowerCase() || "optiflow")
    : "optiflow";

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: allMemories, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.brain.memories(companyId, "all"),
    queryFn: () => sanadBrainApi.companyMemories(companyId, 200),
    staleTime: 60_000,
    enabled: !!companyId,
  });

  const { data: searchResults, error: searchError } = useQuery({
    queryKey: queryKeys.brain.stats(companyId, searchQuery),
    queryFn: () => sanadBrainApi.search(companyId, "board", searchQuery, 20),
    enabled: isSearching && searchQuery.length > 2,
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) => sanadBrainApi.deleteMemory(companyId, "board", memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brain.memories(companyId, "all") });
      setDeleteConfirm(null);
    },
    onError: () => setDeleteConfirm(null),
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ memoryId, signal }: { memoryId: string; signal: string }) =>
      sanadBrainApi.feedback(companyId, "board", memoryId, signal),
  });

  const memories = isSearching && searchResults ? searchResults.results : (allMemories?.results ?? []);
  const displayError = error || searchError;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Company: {companyId}</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search memories..."
            aria-label="Search memories"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearching(e.target.value.length > 2);
            }}
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {isSearching && (
          <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setIsSearching(false); }}>
            Clear
          </Button>
        )}
      </div>

      {displayError && (
        <p className="text-sm text-destructive">{(displayError as Error).message}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading memories...</p>
      ) : (
        <div className="space-y-2">
          {memories.map((mem: Memory) => (
            <Card key={mem.id} className={mem._guard_warning ? "border-yellow-500/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{mem.memory}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {mem.metadata?.memory_type && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                          {mem.metadata.memory_type}
                        </span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400">
                        {mem.metadata?.scope ?? "private"}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400">
                        {mem.metadata?.sensitivity ?? "internal"}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400">
                        {mem.user_id}
                      </span>
                      {mem.score !== undefined && (
                        <span className="text-xs text-muted-foreground">score: {mem.score.toFixed(2)}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(mem.created_at).toLocaleDateString()}
                      </span>
                      {mem._guard_warning && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500">
                          guard warning
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      aria-label="Positive feedback"
                      onClick={() => feedbackMutation.mutate({ memoryId: mem.id, signal: "positive" })}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      aria-label="Negative feedback"
                      onClick={() => feedbackMutation.mutate({ memoryId: mem.id, signal: "negative" })}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                    {deleteConfirm === mem.id ? (
                      <Button
                        variant="destructive" size="sm" className="h-7 text-xs"
                        onClick={() => deleteMutation.mutate(mem.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Confirm
                      </Button>
                    ) : (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label="Delete memory"
                        onClick={() => setDeleteConfirm(mem.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {memories.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {isSearching ? "No memories match your search" : "No memories stored yet"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
