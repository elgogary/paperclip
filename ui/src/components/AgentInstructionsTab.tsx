import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentAccessApi } from "../api/agentAccess";
import { Button } from "@/components/ui/button";
import { MarkdownBody } from "./MarkdownBody";
import { Send, Trash2, FileText, MessageSquare, Loader2 } from "lucide-react";

type AgentInstructionsTabProps = {
  agentId: string;
  companyId: string;
};

export function AgentInstructionsTab({ agentId }: AgentInstructionsTabProps) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");

  const { data: instructions, isLoading: loadingInstructions } = useQuery({
    queryKey: ["agent-instructions", agentId],
    queryFn: () => agentAccessApi.getInstructions(agentId),
  });

  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ["agent-notes", agentId],
    queryFn: () => agentAccessApi.listNotes(agentId),
  });

  const addNote = useMutation({
    mutationFn: (body: string) => agentAccessApi.addNote(agentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-notes", agentId] });
      setNoteText("");
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => agentAccessApi.deleteNote(agentId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-notes", agentId] });
    },
  });

  const handleSubmit = () => {
    if (!noteText.trim()) return;
    addNote.mutate(noteText.trim());
  };

  return (
    <div className="flex gap-4 p-4 h-[calc(100vh-200px)]">
      {/* Left: Instructions content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Agent Instructions</h3>
          {instructions?.path && (
            <code className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {instructions.path}
            </code>
          )}
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border bg-card">
          {loadingInstructions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !instructions?.content ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {instructions?.error ?? "No instructions file found for this agent."}
            </div>
          ) : (
            <div className="p-4">
              <MarkdownBody className="text-sm prose-sm max-w-none">
                {instructions.content}
              </MarkdownBody>
            </div>
          )}
        </div>
      </div>

      {/* Right: Notes / Comments */}
      <div className="w-[360px] shrink-0 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Improvement Notes</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {notes.length}
          </span>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {loadingNotes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">
                No notes yet. Add comments about what to improve in the next cycle.
              </p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-3 bg-card group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs whitespace-pre-wrap break-words flex-1">
                    {note.body}
                  </p>
                  <button
                    onClick={() => deleteNote.mutate(note.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                    title="Delete note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  {new Date(note.createdAt).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Note input */}
        <div className="border rounded-lg p-2 bg-card">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note for the next improvement cycle..."
            rows={3}
            className="w-full resize-none text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">Ctrl+Enter to save</span>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleSubmit}
              disabled={!noteText.trim() || addNote.isPending}
            >
              <Send className="h-3 w-3" />
              Save Note
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
