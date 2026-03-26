import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sanadBrainApi, type Memory } from "../api/sanad-brain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookOpen, Plus, FileText, Search, Brain, Link2, Upload, Globe, RefreshCw, ArrowRight } from "lucide-react";

const BRAIN_USER_ID = "board";

type SourceFilter = "all" | "brain" | "wiki" | "docs";

export function ProjectKnowledgeTab({
  projectId,
  companyId,
}: {
  projectId: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [addMode, setAddMode] = useState<"text" | "url" | "file" | "outline">("text");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [outlineUrl, setOutlineUrl] = useState("");
  const [outlineToken, setOutlineToken] = useState("");
  const [outlineCollection, setOutlineCollection] = useState("");

  const projectTag = `[project:${projectId}]`;

  const { data: searchData, isLoading } = useQuery({
    queryKey: ["brain-project-knowledge", projectId, searchQuery],
    queryFn: () =>
      sanadBrainApi.search(
        companyId,
        BRAIN_USER_ID,
        searchQuery ? `${searchQuery} ${projectTag}` : `project knowledge ${projectTag}`,
        30,
      ),
  });

  const { data: sourcesData } = useQuery({
    queryKey: ["brain-sources", companyId],
    queryFn: () => sanadBrainApi.knowledgeSources(companyId),
  });

  const { data: knowledgeResults } = useQuery({
    queryKey: ["brain-knowledge-search", projectId, searchQuery],
    queryFn: () => sanadBrainApi.knowledgeSearch(companyId, searchQuery || projectTag),
    enabled: !!searchQuery,
  });

  const addKnowledge = useMutation({
    mutationFn: async (data: { title: string; body: string }) => {
      const content = `${projectTag} ${data.title}\n\n${data.body}`;
      return sanadBrainApi.remember(companyId, BRAIN_USER_ID, content, {
        scope: "company",
        memory_type: "fact",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-project-knowledge", projectId] });
      closeAdd();
    },
  });

  const addLink = useMutation({
    mutationFn: async (data: { title: string; url: string }) => {
      const content = `${projectTag} ${data.title} — External resource: ${data.url}`;
      return sanadBrainApi.remember(companyId, BRAIN_USER_ID, content, {
        scope: "company",
        memory_type: "fact",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-project-knowledge", projectId] });
      closeAdd();
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => sanadBrainApi.uploadDocument(companyId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-sources", companyId] });
      closeAdd();
    },
  });

  const connectOutline = useMutation({
    mutationFn: async (data: { url: string; token: string; collection?: string }) =>
      sanadBrainApi.addKnowledgeSource(companyId, `Outline Wiki (${new URL(data.url).hostname})`, "outline", {
        base_url: data.url,
        api_token: data.token,
        collection_id: data.collection || undefined,
        max_docs: 500,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["brain-sources", companyId] });
      const sourceId = (result?.source as Record<string, unknown>)?.id;
      if (sourceId) {
        sanadBrainApi.syncKnowledgeSource(String(sourceId), companyId);
      }
      closeAdd();
    },
  });

  const syncSource = useMutation({
    mutationFn: async (sourceId: string) => sanadBrainApi.syncKnowledgeSource(sourceId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-sources", companyId] });
    },
  });

  function closeAdd() {
    setAddOpen(false);
    setNewTitle("");
    setNewBody("");
    setNewUrl("");
    setOutlineUrl("");
    setOutlineToken("");
    setOutlineCollection("");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(search);
  }

  const memories = searchData?.results ?? [];
  const sources = sourcesData?.sources ?? [];
  const kResults = knowledgeResults?.results ?? [];

  const outlineSources = sources.filter((s: Record<string, unknown>) => s.source_type === "outline");
  const totalItems = memories.length + kResults.length;
  const totalChunks = sources.reduce((acc: number, s: Record<string, unknown>) => acc + (Number(s.chunk_count) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Knowledge Base
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-normal">
              Powered by Sanad Brain
            </span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Agents read this knowledge when working on project tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setAddMode("file"); setAddOpen(true); }}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAddMode("url"); setAddOpen(true); }}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Add Link
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAddMode("outline"); setAddOpen(true); }}>
            <Globe className="h-3.5 w-3.5 mr-1.5" />
            Outline Wiki
          </Button>
          <Button size="sm" onClick={() => { setAddMode("text"); setAddOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Knowledge
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border border-border rounded-lg p-3">
          <div className="text-lg font-bold">{totalItems}</div>
          <div className="text-[11px] text-muted-foreground">Knowledge Items</div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="text-lg font-bold">{sources.length}</div>
          <div className="text-[11px] text-muted-foreground">Active Sources</div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="text-lg font-bold">{totalChunks}</div>
          <div className="text-[11px] text-muted-foreground">Indexed Chunks</div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="text-lg font-bold">{memories.length > 0 ? `${Math.round((memories.filter(m => (m.score ?? 0) > 0.5).length / memories.length) * 100)}%` : "—"}</div>
          <div className="text-[11px] text-muted-foreground">Relevance Rate</div>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search project knowledge... (semantic search via Sanad Brain)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" type="submit">Search</Button>
      </form>

      {/* Source badges */}
      {sources.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {sources.map((s: Record<string, unknown>) => (
            <span key={String(s.id)} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${s.status === "synced" ? "bg-green-500" : s.status === "error" ? "bg-red-500" : "bg-yellow-500"}`} />
              {String(s.name ?? s.source_type ?? "source")}
              {s.chunk_count ? ` (${s.chunk_count})` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Searching Brain...
        </div>
      ) : memories.length === 0 && kResults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No knowledge yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-md">
            Add docs, wiki links, notes — anything agents need when working on this project.
          </p>
          {/* Flow diagram */}
          <div className="mt-6 flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">You add knowledge</span>
            <ArrowRight className="h-3 w-3" />
            <span className="px-2 py-1 rounded bg-primary/10 text-primary">Brain indexes</span>
            <ArrowRight className="h-3 w-3" />
            <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400">Tagged to project</span>
            <ArrowRight className="h-3 w-3" />
            <span className="px-2 py-1 rounded bg-green-500/10 text-green-400">Agents use it</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 min-h-[400px]">
          {/* Left: list */}
          <div className="w-[300px] shrink-0 border border-border rounded-lg overflow-hidden">
            {/* Filter tabs */}
            <div className="flex border-b border-border">
              {(["all", "brain", "wiki", "docs"] as SourceFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSourceFilter(f)}
                  className={`flex-1 px-2 py-1.5 text-[10px] capitalize ${sourceFilter === f ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="divide-y divide-border max-h-[460px] overflow-y-auto">
              {/* Brain memories */}
              {(sourceFilter === "all" || sourceFilter === "brain") && memories.map((mem) => (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => setSelectedMemory(mem)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${
                    selectedMemory?.id === mem.id ? "bg-accent border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Brain className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {mem.memory.split("\n")[0]?.replace(/^\[project:[^\]]+\]\s*/, "").slice(0, 60) ?? "Memory"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-5">
                    <span className="text-[10px] text-muted-foreground/60">{mem.metadata?.memory_type ?? "fact"}</span>
                    {mem.score != null && (
                      <span className="text-[10px] text-muted-foreground/40">
                        {(mem.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </button>
              ))}

              {/* Knowledge search results */}
              {(sourceFilter === "all" || sourceFilter === "wiki" || sourceFilter === "docs") && kResults.map((kr, i) => (
                <div
                  key={`kr-${i}`}
                  className="px-3 py-2.5 hover:bg-accent/50 cursor-default"
                >
                  <div className="flex items-center gap-2">
                    {kr.filename?.startsWith("outline:") ? (
                      <Globe className="h-3 w-3 text-blue-400 shrink-0" />
                    ) : (
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">
                      {kr.filename?.replace("outline:", "") ?? "Document"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-5 line-clamp-2">
                    {kr.text.slice(0, 120)}...
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 border border-border rounded-lg overflow-auto flex flex-col">
            {selectedMemory ? (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
                  <h4 className="text-sm font-semibold truncate">
                    {selectedMemory.memory.split("\n")[0]?.replace(/^\[project:[^\]]+\]\s*/, "").slice(0, 80)}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground shrink-0 ml-2">
                    {selectedMemory.metadata?.memory_type ?? "memory"}
                  </span>
                </div>
                <div className="flex-1 p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedMemory.memory.replace(/^\[project:[^\]]+\]\s*/, "")}
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground flex gap-4">
                  <span>Created: {new Date(selectedMemory.created_at).toLocaleString()}</span>
                  {selectedMemory.metadata?.scope && <span>Scope: {selectedMemory.metadata.scope}</span>}
                  {selectedMemory.score != null && <span>Relevance: {(selectedMemory.score * 100).toFixed(0)}%</span>}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Select an item to preview
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-[500px] flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-[15px]">
              {addMode === "url" ? "Add Link" : addMode === "file" ? "Upload Document" : addMode === "outline" ? "Outline Wiki Sources" : "Add Knowledge"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {addMode === "file" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload a document to Sanad Brain. Supports PDF, DOCX, TXT, MD, CSV.
                  Brain will index the content for semantic search.
                </p>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("knowledge-file-input")?.click()}>
                  <Upload className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Click to upload or drag & drop</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">PDF, DOCX, TXT, MD, CSV, JSON — max 50MB</p>
                </div>
                <input
                  id="knowledge-file-input"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile.mutate(file);
                  }}
                />
                {uploadFile.isPending && (
                  <p className="text-xs text-muted-foreground">Uploading to Brain...</p>
                )}
                <div className="text-[11px] text-muted-foreground p-3 bg-accent/30 rounded-lg">
                  <strong className="text-foreground">How it works:</strong><br />
                  1. File is parsed (PDF → text, DOCX → text, etc.)<br />
                  2. Content is split into chunks (~500 tokens each)<br />
                  3. Each chunk is embedded and stored in Qdrant<br />
                  4. Agents find relevant chunks via semantic search
                </div>
              </div>
            ) : addMode === "outline" ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Connect your Outline wiki to automatically sync documents into this project's knowledge base.
                </p>

                {/* Existing Outline sources */}
                {outlineSources.map((s: Record<string, unknown>) => (
                  <div key={String(s.id)} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-blue-400" />
                        {String(s.name)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === "synced" ? "bg-green-500/15 text-green-500" : s.status === "error" ? "bg-red-500/15 text-red-500" : "bg-yellow-500/15 text-yellow-500"}`}>
                        {String(s.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {s.chunk_count ? `${s.chunk_count} chunks` : "Not synced yet"}
                      {s.last_sync ? ` · Last sync: ${new Date(String(s.last_sync)).toLocaleString()}` : ""}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-[11px]"
                      onClick={() => syncSource.mutate(String(s.id))}
                      disabled={syncSource.isPending}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1.5 ${syncSource.isPending ? "animate-spin" : ""}`} />
                      {syncSource.isPending ? "Syncing..." : "Sync Now"}
                    </Button>
                  </div>
                ))}

                {/* Add new Outline */}
                <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold">Connect Outline Instance</p>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium">Outline URL</label>
                    <Input placeholder="https://wiki.mvpstorm.com" value={outlineUrl} onChange={(e) => setOutlineUrl(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium">API Token</label>
                    <Input type="password" placeholder="ol_api_..." value={outlineToken} onChange={(e) => setOutlineToken(e.target.value)} className="h-8 text-xs" />
                    <p className="text-[10px] text-muted-foreground">Settings → API → Create new token</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium">Collection Filter (optional)</label>
                    <Input placeholder="Leave empty to sync all" value={outlineCollection} onChange={(e) => setOutlineCollection(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => connectOutline.mutate({ url: outlineUrl, token: outlineToken, collection: outlineCollection })}
                    disabled={!outlineUrl.trim() || !outlineToken.trim() || connectOutline.isPending}
                  >
                    {connectOutline.isPending ? "Connecting..." : "Connect & Sync"}
                  </Button>
                </div>

                <div className="text-[11px] text-muted-foreground p-3 bg-accent/30 rounded-lg">
                  <strong className="text-foreground">How Outline Sync Works:</strong><br />
                  1. Brain calls Outline's REST API to list all documents<br />
                  2. Each document's markdown content is extracted<br />
                  3. Content is chunked and embedded into Qdrant<br />
                  4. Agents search across all wiki content semantically<br />
                  5. Re-sync pulls new/updated documents
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Title</label>
                  <Input
                    placeholder={addMode === "url" ? "Outline Wiki — Bidding Module" : "Architecture Guide, API Docs..."}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                {addMode === "url" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">URL</label>
                    <Input
                      placeholder="https://wiki.mvpstorm.com/doc/bidding-CCTT3lHn4a"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Outline wiki, GitHub, any URL. Agents reference this for project context.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Type</label>
                      <select className="w-full h-8 px-3 text-xs rounded-md border border-border bg-background">
                        <option>fact</option>
                        <option>decision</option>
                        <option>lesson</option>
                        <option>pattern</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Content (Markdown)</label>
                      <Textarea
                        placeholder="Write knowledge content..."
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        className="min-h-[250px] font-mono text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Content is automatically tagged with this project and indexed by Brain for semantic search.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          {addMode !== "outline" && (
            <div className="flex gap-2 justify-end px-5 py-3 border-t border-border shrink-0">
              <Button variant="outline" size="sm" onClick={closeAdd}>Cancel</Button>
              {addMode === "url" ? (
                <Button
                  size="sm"
                  onClick={() => addLink.mutate({ title: newTitle, url: newUrl })}
                  disabled={!newTitle.trim() || !newUrl.trim() || addLink.isPending}
                >
                  {addLink.isPending ? "Saving..." : "Add Link"}
                </Button>
              ) : addMode === "text" ? (
                <Button
                  size="sm"
                  onClick={() => addKnowledge.mutate({ title: newTitle, body: newBody })}
                  disabled={!newBody.trim() || addKnowledge.isPending}
                >
                  {addKnowledge.isPending ? "Saving..." : "Save to Brain"}
                </Button>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
