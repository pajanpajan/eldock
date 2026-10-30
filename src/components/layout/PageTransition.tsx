import type { CSSProperties, ReactNode } from "react";

/**
 * Přechod mezi úrovněmi mapy (Areál → Budova → Patro): obsah se „přiblíží“ a prolne.
 * Čisté CSS (`.page-transition` v globals.css, 320 ms, stejná křivka jako dřív v motion) –
 * bez klientského JS. Při `prefers-reduced-motion` zůstane jen prolnutí.
 */
export function PageTransition({ children, zoom = 0.96 }: { children: ReactNode; zoom?: number }) {
  return (
    <div className="page-transition flex flex-1 flex-col" style={{ "--page-zoom": zoom } as CSSProperties}>
      {children}
    </div>
  );
}
