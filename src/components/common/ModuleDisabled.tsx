import Link from "next/link";
import { Blocks } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { MODULES, type AddonModule } from "@/lib/modules";
import { APP_HOME } from "@/lib/routes";

/** Stránka add-onu, který tenant nemá aktivní (přímé URL nebo stará záložka). */
export function ModuleDisabled({ module, feature, canManage }: { module: AddonModule; feature: string; canManage: boolean }) {
  const definition = MODULES[module];
  return (
    <EmptyState
      className="my-auto"
      icon={Blocks}
      title={`${feature} je součástí modulu „${definition.label}“`}
      description={canManage ? "Modul není ve vašem tarifu aktivní. Zapnout ho můžete v konfiguraci modulů." : "Modul není ve vašem tarifu aktivní. O jeho zapnutí požádejte technického ředitele."}
      action={
        <Button asChild className="touch-target">
          <Link href={canManage ? "/admin/modules" : APP_HOME}>{canManage ? "Konfigurace modulů" : "Zpět do aplikace"}</Link>
        </Button>
      }
    />
  );
}

/** Nenápadný odznak u funkce, která je v jiném modulu. */
export function ModuleBadge({ module }: { module: AddonModule }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground" data-testid="module-badge">
      <Blocks className="size-3" aria-hidden />
      Dostupné v modulu {MODULES[module].badge}
    </span>
  );
}
