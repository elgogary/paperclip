import { useState } from "react";
import { ExternalLink, RefreshCw, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@paperclipai/shared";

// Map workspace cwd → codegraph server URL
const CODEGRAPH_URL_MAP: Array<{ match: string; url: string; label: string }> = [
  { match: "accubuild_core", url: "http://100.109.59.30:8888/codegraph-visual.html", label: "AccuBuild Core" },
  { match: "lipton_erp",     url: "http://100.109.59.30:8889/codegraph-visual.html", label: "Lipton ERP" },
];

function detectGraphUrl(project: Project): { url: string; label: string } | null {
  const cwd = project.primaryWorkspace?.cwd ?? "";
  for (const entry of CODEGRAPH_URL_MAP) {
    if (cwd.includes(entry.match)) return entry;
  }
  return null;
}

interface ProjectGraphTabProps {
  project: Project;
}

export function ProjectGraphTab({ project }: ProjectGraphTabProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const graph = detectGraphUrl(project);

  if (!graph) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <GitBranch className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <p className="font-medium">No code graph configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set the project workspace <code className="bg-muted px-1 rounded">cwd</code> to a folder with a{" "}
            <code className="bg-muted px-1 rounded">docs/codegraph-visual.html</code>.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Workspace: <code className="bg-muted px-1 rounded">{project.primaryWorkspace?.cwd ?? "none"}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{graph.label} — Code Dependency Graph</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Interactive module/function dependency visualization
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(graph.url, "_blank")}
            className="gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open full
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-background" style={{ height: "calc(100vh - 280px)", minHeight: 500 }}>
        <iframe
          key={refreshKey}
          src={graph.url}
          title="Code Graph"
          className="w-full h-full border-0"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
