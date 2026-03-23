import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sanadBrainApi } from "../../api/sanad-brain";
import { queryKeys } from "../../lib/queryKeys";
import { useCompany } from "../../context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import type { GraphNode, GraphEdge } from "../../api/sanad-brain";

const NODE_COLORS: Record<string, string> = {
  Entity: "#3b82f6",
  Person: "#8b5cf6",
  Concept: "#10b981",
  Fact: "#f59e0b",
  Event: "#ef4444",
  unknown: "#6b7280",
};

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function forceSimulation(nodes: SimNode[], edges: GraphEdge[], width: number, height: number) {
  // Initialize positions randomly
  for (const n of nodes) {
    if (!n.x) n.x = Math.random() * width;
    if (!n.y) n.y = Math.random() * height;
    n.vx = 0;
    n.vy = 0;
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Run 100 iterations of force simulation
  for (let iter = 0; iter < 100; iter++) {
    const alpha = 1 - iter / 100;

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x || 0.1;
        const dy = b.y - a.y || 0.1;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (300 * alpha) / (dist * dist);
        a.vx -= (dx / dist) * force;
        a.vy -= (dy / dist) * force;
        b.vx += (dx / dist) * force;
        b.vy += (dy / dist) * force;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 80) * 0.01 * alpha;
      a.vx += (dx / dist) * force;
      a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force;
      b.vy -= (dy / dist) * force;
    }

    // Center gravity
    for (const n of nodes) {
      n.vx += (width / 2 - n.x) * 0.001 * alpha;
      n.vy += (height / 2 - n.y) * 0.001 * alpha;
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= 0.9;
      n.vy *= 0.9;
      // Bounds
      n.x = Math.max(20, Math.min(width - 20, n.x));
      n.y = Math.max(20, Math.min(height - 20, n.y));
    }
  }

  return nodes;
}

export function GraphTab() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany
    ? (selectedCompany.name?.split(" ")[0]?.toLowerCase() || selectedCompany.issuePrefix?.toLowerCase() || "optiflow")
    : "optiflow";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [...queryKeys.brain.stats(companyId, "graph")],
    queryFn: () => sanadBrainApi.graph(companyId),
    staleTime: 120_000,
  });

  // Run force simulation when data changes
  useEffect(() => {
    if (!data?.nodes?.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.parentElement?.clientWidth ?? 800;
    const height = isFullscreen ? window.innerHeight - 100 : 500;
    canvas.width = width;
    canvas.height = height;

    const nodes: SimNode[] = data.nodes.map((n) => ({
      ...n,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
    }));

    forceSimulation(nodes, data.edges, width, height);
    setSimNodes(nodes);
  }, [data, isFullscreen]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simNodes.length || !data) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    for (const e of data.edges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Edge label
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.fillStyle = "#9ca3af";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(e.type, mx, my - 4);
    }

    // Draw nodes
    for (const n of simNodes) {
      const color = NODE_COLORS[n.type] ?? NODE_COLORS.unknown;
      const isHovered = hoveredNode?.id === n.id;
      const radius = isHovered ? 10 : 7;

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node label
      ctx.fillStyle = "#e5e7eb";
      ctx.font = isHovered ? "bold 11px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      const label = n.label.length > 25 ? n.label.slice(0, 22) + "..." : n.label;
      ctx.fillText(label, n.x, n.y + radius + 12);
    }
  }, [simNodes, data, hoveredNode]);

  // Mouse hover detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    let found: SimNode | null = null;
    for (const n of simNodes) {
      const dx = n.x - x;
      const dy = n.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        found = n;
        break;
      }
    }
    setHoveredNode(found);
  };

  const nodeCount = data?.nodes?.length ?? 0;
  const edgeCount = data?.edges?.length ?? 0;
  const typeSet = new Set(data?.nodes?.map((n) => n.type) ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Loading..." : "Refresh"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
        <span className="text-xs text-muted-foreground">
          {nodeCount} nodes, {edgeCount} edges
        </span>
        <div className="flex gap-2 ml-auto">
          {Array.from(typeSet).map((t) => (
            <span key={t} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: NODE_COLORS[t] ?? NODE_COLORS.unknown }}
              />
              {t}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data?.error && <p className="text-sm text-yellow-500">Graph: {data.error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading graph...</p>
      ) : nodeCount === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No graph data yet. Enable ENABLE_GRAPH=true and store memories with LLM extraction to build the knowledge graph.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0 relative">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair"
              style={{ height: isFullscreen ? "calc(100vh - 200px)" : "500px" }}
              onMouseMove={handleMouseMove}
            />
            {hoveredNode && (
              <div
                className="absolute pointer-events-none bg-card border border-border rounded-md p-2 shadow-lg text-xs max-w-xs z-10"
                style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
              >
                <p className="font-semibold">{hoveredNode.label}</p>
                <p className="text-muted-foreground">{hoveredNode.type}</p>
                {Object.entries(hoveredNode.properties).slice(0, 5).map(([k, v]) => (
                  <p key={k} className="text-muted-foreground truncate">
                    {k}: {String(v)}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
