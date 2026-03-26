import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookOpen, Plus, FileText, Search } from "lucide-react";

interface ProjectDocument {
  id: string;
  companyId: string;
  projectId: string | null;
  key: string | null;
  title: string | null;
  format: string;
  latestBody: string;
  createdAt: string;
  updatedAt: string;
}

const projectDocsApi = {
  list: (projectId: string) =>
    api.get<{ documents: ProjectDocument[] }>(`/projects/${projectId}/documents`),
  create: (projectId: string, data: { title: string; body: string; key?: string }) =>
    api.post<{ document: ProjectDocument }>(`/projects/${projectId}/documents`, data),
};

export function ProjectKnowledgeTab({
  projectId,
  companyId,
}: {
  projectId: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<ProjectDocument | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => projectDocsApi.list(projectId),
  });

  const createDoc = useMutation({
    mutationFn: (d: { title: string; body: string }) =>
      projectDocsApi.create(projectId, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      setCreateOpen(false);
      setNewTitle("");
      setNewBody("");
    },
  });

  const docs = data?.documents ?? [];
  const filtered = search
    ? docs.filter(
        (d) =>
          (d.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
          d.latestBody.toLowerCase().includes(search.toLowerCase()),
      )
    : docs;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading knowledge base...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Knowledge Base</h3>
          <p className="text-xs text-muted-foreground">
            Documents, guides, and reference material for this project. Agents read these when working on tasks.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Document
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search knowledge base..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Document list + preview */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Add guides, API docs, architecture notes — anything agents need to know about this project.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 min-h-[400px]">
          {/* Left: doc list */}
          <div className="w-[280px] shrink-0 border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border">
              {filtered.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${
                    selectedDoc?.id === doc.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate">{doc.title || "Untitled"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 pl-5">
                    {doc.latestBody.slice(0, 80)}...
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 border border-border rounded-lg overflow-auto">
            {selectedDoc ? (
              <div className="p-4">
                <h4 className="text-sm font-semibold mb-3">{selectedDoc.title || "Untitled"}</h4>
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedDoc.latestBody}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Select a document to preview
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Document Sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="sm:max-w-[500px] flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-[15px]">Add Document</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Title</label>
              <Input
                placeholder="API Reference, Architecture Guide..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Content (Markdown)</label>
              <Textarea
                placeholder="Write your document content..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end px-5 py-3 border-t border-border shrink-0">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createDoc.mutate({ title: newTitle, body: newBody })}
              disabled={!newBody.trim() || createDoc.isPending}
            >
              {createDoc.isPending ? "Saving..." : "Save Document"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
