import { cn } from "../lib/utils";

type SanadLogoProps = {
  className?: string;
  size?: number;
  color?: string;
};

/**
 * Sanad AI constellation logo — bold S with neural-network dots and sparkle.
 * Pass `color` prop for explicit fill (e.g., "white" for FAB on dark bg).
 * Otherwise uses currentColor via CSS class.
 */
export function SanadLogo({ className, size = 24, color }: SanadLogoProps) {
  const f = color ?? "currentColor";
  return (
    <svg
      viewBox="0 0 72 72"
      fill="none"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-label="Sanad AI"
    >
      {/* Bold S */}
      <text
        x="34"
        y="48"
        textAnchor="middle"
        fontFamily="system-ui,-apple-system,sans-serif"
        fontWeight="900"
        fontSize="44"
        fill={f}
      >
        S
      </text>
      {/* Constellation dots — large enough to see at 24px */}
      <circle cx="56" cy="10" r="3.5" fill={f} opacity="0.85" />
      <circle cx="65" cy="24" r="2.5" fill={f} opacity="0.6" />
      <circle cx="50" cy="3" r="2" fill={f} opacity="0.5" />
      <circle cx="64" cy="14" r="1.5" fill={f} opacity="0.4" />
      {/* Connection lines — thicker for visibility */}
      <line x1="56" y1="10" x2="65" y2="24" stroke={f} strokeWidth="1" opacity="0.25" />
      <line x1="56" y1="10" x2="50" y2="3" stroke={f} strokeWidth="1" opacity="0.25" />
      <line x1="65" y1="24" x2="64" y2="14" stroke={f} strokeWidth="0.8" opacity="0.2" />
      {/* Sparkle — bigger */}
      <path
        d="M58 6 L59 9 L62 10 L59 11 L58 14 L57 11 L54 10 L57 9Z"
        fill={f}
        opacity="0.55"
      />
    </svg>
  );
}
