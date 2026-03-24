import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sanadBrainApi } from "../../api/sanad-brain";
import { queryKeys } from "../../lib/queryKeys";
import { useCompany } from "../../context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Trash2, Search, Upload, FileText, Database, Globe, Code, GitBranch } from "lucide-react";

const SOURCE_ICONS: Record<string, typeof FileText> = {
  document: FileText,
  frappe: Database,
  web: Globe,
  codebase: Code,
  codegraph: GitBranch,
};

const SYNCABLE_TYPES = new Set(["frappe", "codebase", "web", "codegraph"]);

export function KnowledgeTab() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany
    ? (selectedCompany.name?.split(" ")[0]?.toLowerCase() || selectedCompany.issuePrefix?.toLowerCase() || "optiflow")
    : "optiflow";

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ text: string; score: number; filename: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const { data: sourcesData, isLoading, refetch, isFetching } = useQuery({
    queryKey: [...queryKeys.brain.stats(companyId, "knowledge-sources")],
    queryFn: () => sanadBrainApi.knowledgeSources(companyId),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => sanadBrainApi.deleteKnowledgeSource(sourceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.brain.stats(companyId, "knowledge-sources") }),
  });

  const syncMutation = useMutation({
    mutationFn: (sourceId: string) => sanadBrainApi.syncKnowledgeSource(sourceId, companyId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brain.stats(companyId, "knowledge-sources") });
      if (data.ok) {
        setUploadStatus(`Synced: ${data.chunks} chunks in ${data.elapsed_seconds}s`);
      } else {
        setUploadStatus(`Sync failed: ${data.error}`);
      }
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus(`Uploading ${file.name}...`);
    try {
      const result = await sanadBrainApi.uploadDocument(companyId, file);
      setUploadStatus(`Uploaded: ${result.chunks} chunks from ${result.filename} (${result.elapsed_seconds}s)`);
      queryClient.invalidateQueries({ queryKey: queryKeys.brain.stats(companyId, "knowledge-sources") });
    } catch (err) {
      setUploadStatus(`Upload failed: ${(err as Error).message}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const data = await sanadBrainApi.knowledgeSearch(companyId, searchQuery);
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const sources = sourcesData?.sources ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload Document
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.md,.txt,.rst,.csv"
          className="hidden"
          onChange={handleFileUpload}
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {sources.length} source{sources.length !== 1 ? "s" : ""}
        </span>
      </div>

      {uploadStatus && (
        <div className="text-xs px-3 py-2 rounded bg-blue-500/10 text-blue-400">
          {uploadStatus}
          <button className="ml-2 text-blue-300 hover:text-blue-100" onClick={() => setUploadStatus(null)}>dismiss</button>
        </div>
      )}

      {/* RAG Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ask your knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Search Results</p>
          {searchResults.map((r, i) => (
            <Card key={i} className="border-blue-500/20">
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap">{r.text}</p>
                <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                  <span>Score: {r.score.toFixed(3)}</span>
                  {r.filename && <span>File: {r.filename}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sources List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sources...</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Knowledge Sources</p>
          {sources.map((src: Record<string, unknown>) => {
            const Icon = SOURCE_ICONS[src.source_type as string] ?? FileText;
            return (
              <Card key={src.id as string}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{String(src.name)}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="capitalize">{String(src.source_type)}</span>
                      <span>{Number(src.chunk_count)} chunks</span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        src.status === "synced" ? "bg-green-500/10 text-green-500" :
                        src.status === "error" ? "bg-red-500/10 text-red-500" :
                        src.status === "syncing" ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-gray-500/10 text-gray-400"
                      }`}>
                        {String(src.status)}
                      </span>
                      {src.last_sync ? (
                        <span>Last sync: {new Date(String(src.last_sync)).toLocaleString()}</span>
                      ) : null}
                    </div>
                    {src.error ? (
                      <p className="text-xs text-destructive mt-1">{String(src.error)}</p>
                    ) : null}
                  </div>
                  {SYNCABLE_TYPES.has(src.source_type as string) && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      title="Re-sync source"
                      onClick={() => syncMutation.mutate(src.id as string)}
                      disabled={syncMutation.isPending || src.status === "syncing"}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                    onClick={() => deleteMutation.mutate(src.id as string)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {sources.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No knowledge sources yet. Upload a document to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
