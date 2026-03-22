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
        x="36"
        y="46"
        textAnchor="middle"
        fontFamily="system-ui,-apple-system,sans-serif"
        fontWeight="900"
        fontSize="40"
        fill={f}
      >
        S
      </text>
      {/* Constellation dots */}
      <circle cx="58" cy="12" r="2" fill={f} opacity="0.8" />
      <circle cx="64" cy="22" r="1.2" fill={f} opacity="0.5" />
      <circle cx="54" cy="6" r="1" fill={f} opacity="0.4" />
      <circle cx="62" cy="16" r="0.8" fill={f} opacity="0.3" />
      {/* Connection lines */}
      <line x1="58" y1="12" x2="64" y2="22" stroke={f} strokeWidth="0.5" opacity="0.2" />
      <line x1="58" y1="12" x2="54" y2="6" stroke={f} strokeWidth="0.5" opacity="0.2" />
      <line x1="64" y1="22" x2="62" y2="16" stroke={f} strokeWidth="0.5" opacity="0.15" />
      {/* Sparkle */}
      <path
        d="M60 8 L60.5 9.5 L62 10 L60.5 10.5 L60 12 L59.5 10.5 L58 10 L59.5 9.5Z"
        fill={f}
        opacity="0.6"
      />
    </svg>
  );
}
