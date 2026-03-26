import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sanadBrainApi, type Memory } from "../api/sanad-brain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookOpen, Plus, FileText, Search, Brain, Link2, ExternalLink, Upload } from "lucide-react";

const BRAIN_USER_ID = "board";

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
  const [addMode, setAddMode] = useState<"text" | "url" | "file">("text");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const projectTag = `[project:${projectId}]`;

  // Search Brain for project-tagged memories
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

  // Knowledge sources
  const { data: sourcesData } = useQuery({
    queryKey: ["brain-sources", companyId],
    queryFn: () => sanadBrainApi.knowledgeSources(companyId),
  });

  // Knowledge search (semantic, from uploaded docs)
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

  function closeAdd() {
    setAddOpen(false);
    setNewTitle("");
    setNewBody("");
    setNewUrl("");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(search);
  }

  const memories = searchData?.results ?? [];
  const sources = sourcesData?.sources ?? [];
  const kResults = knowledgeResults?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Knowledge Base
          </h3>
          <p className="text-xs text-muted-foreground">
            Powered by Sanad Brain. Agents read this knowledge when working on project tasks.
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
          <Button size="sm" onClick={() => { setAddMode("text"); setAddOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Knowledge
          </Button>
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

      {/* Sources badges */}
      {sources.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {sources.map((s: Record<string, unknown>) => (
            <span key={String(s.id)} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              {String(s.name ?? s.source_type ?? "source")}
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
            Add docs, wiki links, notes — anything agents need. Upload files directly to Brain,
            or link your Outline wiki at wiki.mvpstorm.com.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 min-h-[400px]">
          {/* Left: list */}
          <div className="w-[300px] shrink-0 border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {/* Brain memories */}
              {memories.map((mem) => (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => setSelectedMemory(mem)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${
                    selectedMemory?.id === mem.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {mem.memory.split("\n")[0]?.slice(0, 60) ?? "Memory"}
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
              {kResults.map((kr, i) => (
                <div
                  key={`kr-${i}`}
                  className="px-3 py-2.5 hover:bg-accent/50 cursor-default"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-xs font-medium truncate">{kr.filename}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-5 line-clamp-2">
                    {kr.text.slice(0, 120)}...
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 border border-border rounded-lg overflow-auto">
            {selectedMemory ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">
                    {selectedMemory.memory.split("\n")[0]?.slice(0, 80)}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground">
                    {selectedMemory.metadata?.memory_type ?? "memory"}
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedMemory.memory}
                </div>
                <div className="mt-4 text-[10px] text-muted-foreground">
                  Created: {new Date(selectedMemory.created_at).toLocaleString()}
                  {selectedMemory.metadata?.scope && ` · Scope: ${selectedMemory.metadata.scope}`}
                </div>
              </div>
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
              {addMode === "url" ? "Add Link" : addMode === "file" ? "Upload Document" : "Add Knowledge"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {addMode === "file" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload a document to Sanad Brain. Supports PDF, DOCX, TXT, MD, CSV.
                  Brain will index the content for semantic search.
                </p>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile.mutate(file);
                  }}
                  className="text-xs"
                />
                {uploadFile.isPending && (
                  <p className="text-xs text-muted-foreground">Uploading to Brain...</p>
                )}
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Content (Markdown)</label>
                    <Textarea
                      placeholder="Write knowledge content..."
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      className="min-h-[300px] font-mono text-xs"
                    />
                  </div>
                )}
              </>
            )}
          </div>
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
