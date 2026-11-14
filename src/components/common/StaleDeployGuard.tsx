"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { NEW_VERSION_MESSAGE, isStaleDeployment } from "@/lib/stale-deploy";

/**
 * Fáze 113: globální pojistka po nasazení nové verze – nezachycené volání Server Action ze staré stránky („Failed to
 * find Server Action“) ukáže výzvu k načtení nové verze místo tiché chyby. Průběžné ukládání půdorysu stránku načte
 * znovu samo (`useFloorplanSync`).
 */
export function StaleDeployGuard() {
  useEffect(() => {
    let shown = false;
    const onRejection = (event: PromiseRejectionEvent) => {
      if (shown || !isStaleDeployment(event.reason)) return;
      shown = true;
      event.preventDefault();
      toast.info(NEW_VERSION_MESSAGE, { duration: Infinity, action: { label: "🔄 Načíst novou verzi", onClick: () => window.location.reload() } });
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);
  return null;
}
