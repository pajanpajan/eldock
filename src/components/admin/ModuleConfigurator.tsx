"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";

import { ADDON_MODULES, MODULES, type ModuleKey, type ModuleState } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { setModuleEnabledAction } from "@/server/actions/modules";

/** Karty balíčků (Core + add-ony) s přepínačem Aktivní / Deaktivováno. */
export function ModuleConfigurator({ state }: { state: ModuleState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(state, (current, patch: Partial<ModuleState>) => ({ ...current, ...patch }));

  function toggle(key: (typeof ADDON_MODULES)[number], enabled: boolean) {
    startTransition(async () => {
      setOptimistic({ [key]: enabled });
      const result = await setModuleEnabledAction({ key, enabled });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Modul „${MODULES[key].label}“ ${enabled ? "aktivován" : "deaktivován"}.`);
      router.refresh();
    });
  }

  const keys: ModuleKey[] = ["CORE", ...ADDON_MODULES];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {keys.map((key) => {
        const definition = MODULES[key];
        const core = key === "CORE";
        const enabled = core || optimistic[key as (typeof ADDON_MODULES)[number]];
        return (
          <section
            key={key}
            className={cn("flex flex-col gap-4 rounded-xl border p-5 transition-colors", enabled ? "border-primary/40 bg-card" : "border-border bg-card/40")}
            aria-labelledby={`module-${key}`}
            data-testid={`module-${key}`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`module-${key}`} className="text-lg font-semibold">
                    {definition.label}
                  </h2>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", core ? "border-zinc-500/50 text-zinc-300" : "border-primary/50 text-primary")}>{definition.tier}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p>
              </div>
              {core ? (
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden /> Vždy aktivní
                </span>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${definition.label}: ${enabled ? "Aktivní" : "Deaktivováno"}`}
                  disabled={pending}
                  onClick={() => toggle(key as (typeof ADDON_MODULES)[number], !enabled)}
                  className="touch-target flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
                >
                  <span className={cn("text-sm font-medium", enabled ? "text-primary" : "text-muted-foreground")}>{enabled ? "Aktivní" : "Deaktivováno"}</span>
                  <span className={cn("relative block h-7 w-12 shrink-0 rounded-full transition-colors", enabled ? "bg-primary" : "bg-zinc-700")}>
                    <span className={cn("absolute top-1 left-0 size-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-6" : "translate-x-1")} />
                  </span>
                </button>
              )}
            </div>
            <ul className="space-y-1.5 text-sm">
              {definition.features.map((feature) => (
                <li key={feature} className={cn("flex items-start gap-2", !enabled && "text-muted-foreground")}>
                  <Check className={cn("mt-0.5 size-4 shrink-0", enabled ? "text-primary" : "text-zinc-600")} aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
