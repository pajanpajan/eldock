"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";

/**
 * Přechod mezi úrovněmi mapy (Areál → Budova → Patro): obsah se „přiblíží“ a prolne.
 * `reducedMotion="user"` vypne transformace při `prefers-reduced-motion`, zůstane jen prolnutí.
 */
export function PageTransition({ children, zoom = 0.96 }: { children: ReactNode; zoom?: number }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="flex flex-1 flex-col"
        initial={{ opacity: 0, scale: zoom }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
