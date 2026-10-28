import type { MarkupData } from "@/lib/markup";
import { cn } from "@/lib/utils";

/**
 * Vykreslí tahy zákresu jako SVG přes obrázek listu. `aspect` = šířka / výška listu,
 * aby tloušťka čar odpovídala šířce listu i při nerovnoměrném poměru stran.
 */
export function MarkupOverlay({ markup, aspect, className }: { markup: MarkupData; aspect: number; className?: string }) {
  const W = 1000;
  const H = W / aspect;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      aria-hidden
    >
      {markup.strokes.map((stroke, index) => (
        <polyline
          key={index}
          points={stroke.points.map(([x, y]) => `${x * W},${y * H}`).join(" ")}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width * W * (stroke.tool === "highlighter" ? 4 : 1)}
          strokeOpacity={stroke.tool === "highlighter" ? 0.35 : 0.95}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
