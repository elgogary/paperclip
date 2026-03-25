/**
 * Radar/Spider chart for skill audit A/B comparison.
 * Shows 5 axes: Clarity, Trigger, Completeness, Examples, Edge Cases.
 * Current version vs enhanced version overlay.
 */

interface RadarChartProps {
  current: {
    clarity: number;
    triggerSpecificity: number;
    instructionCompleteness: number;
    exampleCoverage: number;
    edgeCaseHandling: number;
  };
  enhanced?: {
    clarity: number;
    triggerSpecificity: number;
    instructionCompleteness: number;
    exampleCoverage: number;
    edgeCaseHandling: number;
  };
  size?: number;
}

const AXES = [
  { key: "clarity", label: "Clarity", max: 20 },
  { key: "triggerSpecificity", label: "Trigger", max: 20 },
  { key: "instructionCompleteness", label: "Completeness", max: 25 },
  { key: "exampleCoverage", label: "Examples", max: 20 },
  { key: "edgeCaseHandling", label: "Edge Cases", max: 15 },
] as const;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function getPolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  values: Record<string, number>,
) {
  return AXES.map((axis, i) => {
    const angle = (360 / AXES.length) * i;
    const val = Math.min(values[axis.key] ?? 0, axis.max);
    const r = (val / axis.max) * radius;
    return polarToCartesian(cx, cy, r, angle);
  });
}

export function SkillRadarChart({ current, enhanced, size = 220 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 30;

  // Grid rings (20%, 40%, 60%, 80%, 100%)
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Current polygon
  const currentPoints = getPolygonPoints(cx, cy, radius, current);
  const currentPath = currentPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Enhanced polygon (if provided)
  const enhancedPoints = enhanced ? getPolygonPoints(cx, cy, radius, enhanced) : null;
  const enhancedPath = enhancedPoints ? enhancedPoints.map((p) => `${p.x},${p.y}`).join(" ") : null;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {rings.map((ring) => {
          const pts = AXES.map((_, i) => {
            const angle = (360 / AXES.length) * i;
            return polarToCartesian(cx, cy, radius * ring, angle);
          });
          return (
            <polygon
              key={ring}
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="oklch(0.3 0 0)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Axis lines */}
        {AXES.map((_, i) => {
          const angle = (360 / AXES.length) * i;
          const end = polarToCartesian(cx, cy, radius, angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="oklch(0.3 0 0)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Enhanced area (behind current) */}
        {enhancedPath && (
          <polygon
            points={enhancedPath}
            fill="oklch(0.72 0.17 162 / 0.15)"
            stroke="oklch(0.72 0.17 162)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}

        {/* Current area */}
        <polygon
          points={currentPath}
          fill="oklch(0.65 0.15 250 / 0.2)"
          stroke="oklch(0.65 0.15 250)"
          strokeWidth={1.5}
        />

        {/* Current dots */}
        {currentPoints.map((p, i) => (
          <circle key={`c-${i}`} cx={p.x} cy={p.y} r={3} fill="oklch(0.65 0.15 250)" />
        ))}

        {/* Enhanced dots */}
        {enhancedPoints?.map((p, i) => (
          <circle key={`e-${i}`} cx={p.x} cy={p.y} r={2.5} fill="oklch(0.72 0.17 162)" />
        ))}

        {/* Axis labels */}
        {AXES.map((axis, i) => {
          const angle = (360 / AXES.length) * i;
          const labelPos = polarToCartesian(cx, cy, radius + 18, angle);
          return (
            <text
              key={axis.key}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill="oklch(0.7 0 0)"
              fontFamily="inherit"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-sm" style={{ background: "oklch(0.65 0.15 250)" }} />
          Current
        </div>
        {enhanced && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-sm" style={{ background: "oklch(0.72 0.17 162)" }} />
            Enhanced
          </div>
        )}
      </div>
    </div>
  );
}
