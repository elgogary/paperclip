import { cn } from "../lib/utils";

type SanadLogoProps = {
  className?: string;
  size?: number;
  color?: string;
};

/**
 * Sanad AI "S" with sparkle — matches the ERPNext chat widget FAB icon.
 * Pass `color` prop for explicit fill (e.g., "white" for FAB on colored bg).
 * Otherwise uses currentColor via CSS class.
 */
export function SanadLogo({ className, size = 24, color }: SanadLogoProps) {
  const fillColor = color ?? "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-label="Sanad AI"
    >
      <text
        x="11.5"
        y="18.5"
        textAnchor="middle"
        fontFamily="system-ui,-apple-system,sans-serif"
        fontWeight="900"
        fontSize="19"
        fill={fillColor}
        letterSpacing="-0.5"
      >
        S
      </text>
      <path
        d="M20 3.5 L20.6 5.3 L22.4 5.9 L20.6 6.5 L20 8.3 L19.4 6.5 L17.6 5.9 L19.4 5.3Z"
        fill={fillColor}
        opacity="0.75"
      />
    </svg>
  );
}
