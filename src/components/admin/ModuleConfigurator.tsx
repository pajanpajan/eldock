"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, FlaskConical, Lock, LockKeyhole, Rocket, ShieldCheck, Sparkles, Wrench, X } from "lucide-react";
import { toast } from "sonner";

import { ProBadge } from "@/components/modules/Upsell";
import {
  ADDON_MODULES,
  DISPLAY_MODES,
  FEATURES,
  MODULES,
  PRESETS,
  effectiveFeatures,
  featuresOf,
  matchingPreset,
  roleImpact,
  type AddonModule,
  type DisplayMode,
  type FeatureKey,
  type ModuleConfig,
  type PresetKey,
} from "@/lib/modules";
import { cn } from "@/lib/utils";
import { applyPresetAction, setDisplayModeAction, setFeatureEnabledAction, setModuleEnabledAction } from "@/server/actions/modules";

const PRESET_ICONS: Record<PresetKey, typeof Rocket> = { START: Wrench, PROFI: ShieldCheck, ENTERPRISE: Rocket };

/** Přepínač (role=switch) – hlavní i pro podfunkce. */
function Switch({ checked, onChange, label, disabled, size = "md" }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean; size?: "md" | "sm" }) {
  const md = size === "md";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? "Aktivní" : "Deaktivováno"}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="touch-target flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {md ? <span className={cn("text-sm font-medium", checked ? "text-primary" : "text-muted-foreground")}>{checked ? "Aktivní" : "Deaktivováno"}</span> : null}
      <span className={cn("relative block shrink-0 rounded-full transition-colors", md ? "h-7 w-12" : "h-5 w-9", checked ? "bg-primary" : "bg-zinc-700")}>
        <span
          className={cn(
            "absolute left-0 rounded-full bg-white shadow transition-transform",
            md ? "top-1 size-5" : "top-0.5 size-4",
            checked ? (md ? "translate-x-6" : "translate-x-[1.125rem]") : md ? "translate-x-1" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/**
 * Správa modulů a tarifů: presety (START / PROFI / ENTERPRISE), režim neaktivních funkcí, karty modulů
 * s hlavním přepínačem a podfunkcemi a živá matice dopadu na role. Změny se ukazují hned (optimisticky)
 * a po uložení se převezme stav ze serveru.
 */
export function ModuleConfigurator({ initial }: { initial: ModuleConfig }) {
  const router = useRouter();
  const [config, setConfig] = useState(initial);
  const [pending, startTransition] = useTransition();
  const flags = effectiveFeatures(config);
  const activePreset = matchingPreset(config);
  const impact = roleImpact(flags);

  function save(next: ModuleConfig, call: () => Promise<{ ok: true; data: ModuleConfig } | { ok: false; error: string }>, message: string) {
    const previous = config;
    setConfig(next);
    startTransition(async () => {
      const result = await call();
      if (!result.ok) {
        setConfig(previous);
        toast.error(result.error);
        return;
      }
      setConfig(result.data);
      toast.success(message);
      router.refresh();
    });
  }

  const toggleModule = (key: AddonModule, enabled: boolean) =>
    save({ ...config, modules: { ...config.modules, [key]: enabled } }, () => setModuleEnabledAction({ key, enabled }), `Modul „${MODULES[key].label}“ ${enabled ? "aktivován" : "deaktivován"}.`);
  const toggleFeature = (key: FeatureKey, enabled: boolean) =>
    save({ ...config, features: { ...config.features, [key]: enabled } }, () => setFeatureEnabledAction({ key, enabled }), `Funkce „${FEATURES[key].label}“ ${enabled ? "zapnuta" : "vypnuta"}.`);
  const setMode = (mode: DisplayMode) => save({ ...config, displayMode: mode }, () => setDisplayModeAction({ mode }), `Režim: ${DISPLAY_MODES[mode].label}.`);
  const applyPreset = (preset: PresetKey) => save(PRESETS[preset].apply(config), () => applyPresetAction({ preset }), `${PRESETS[preset].label} nastaven.`);

  return (
    <div className="space-y-8" aria-busy={pending}>
      <section aria-labelledby="presets-title" className="space-y-3">
        <h2 id="presets-title" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Rychlé presety tarifů
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
            const Icon = PRESET_ICONS[key];
            const active = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  "touch-target flex items-start gap-3 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70",
                  active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="flex items-center gap-2 font-semibold">
                    {PRESETS[key].label}
                    {active ? <Check className="size-4 text-primary" aria-label="aktivní" /> : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{PRESETS[key].description}</span>
                </span>
              </button>
            );
          })}
        </div>
        {!activePreset ? <p className="text-sm text-muted-foreground">Aktuální nastavení: vlastní konfigurace (neodpovídá žádnému presetu).</p> : null}
      </section>

      <section aria-labelledby="mode-title" className="space-y-3">
        <h2 id="mode-title" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Režim neaktivních modulů
        </h2>
        <div role="radiogroup" aria-labelledby="mode-title" className="grid gap-3 md:grid-cols-2">
          {(Object.keys(DISPLAY_MODES) as DisplayMode[]).map((mode) => {
            const active = config.displayMode === mode;
            const Icon = mode === "CLEAN" ? EyeOff : LockKeyhole;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => !active && setMode(mode)}
                disabled={pending}
                className={cn(
                  "touch-target flex items-start gap-3 rounded-xl border p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
                )}
              >
                <Icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span>
                  <span className="font-semibold">{mode === "CLEAN" ? "Čisté pracoviště (skrýt vypnuté)" : "Obchodní demo (zobrazit se zámkem)"}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{DISPLAY_MODES[mode].description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="modules-title" className="space-y-3">
        <h2 id="modules-title" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Moduly a funkce
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-card p-5" data-testid="module-CORE">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{MODULES.CORE.label}</h3>
                  <span className="rounded-full border border-zinc-500/50 px-2 py-0.5 text-xs font-semibold text-zinc-300">Core</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{MODULES.CORE.description}</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" aria-hidden /> Vždy aktivní
              </span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {MODULES.CORE.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </article>

          {ADDON_MODULES.map((key) => {
            const pack = MODULES[key];
            const enabled = config.modules[key];
            const features = featuresOf(key);
            const live = features.filter((feature) => flags[feature]).length;
            const total = features.filter((feature) => !FEATURES[feature].labs).length;
            return (
              <article key={key} className={cn("flex flex-col gap-4 rounded-xl border p-5 transition-colors", enabled ? "border-primary/40 bg-card" : "border-border bg-card/40")} data-testid={`module-${key}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{pack.label}</h3>
                      <span className="rounded-full border border-primary/50 px-2 py-0.5 text-xs font-semibold text-primary">Add-on</span>
                      <span className={cn("flex items-center gap-1 text-xs", live ? "text-emerald-300" : "text-muted-foreground")} data-testid={`module-${key}-status`}>
                        <span className={cn("size-2 rounded-full", live ? "bg-emerald-400" : "bg-zinc-500")} aria-hidden />
                        {live} / {total} funkcí aktivní
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{pack.description}</p>
                  </div>
                  <Switch checked={enabled} onChange={(value) => toggleModule(key, value)} label={pack.label} disabled={pending} />
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {features.map((feature) => {
                    const definition = FEATURES[feature];
                    return (
                      <li key={feature} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", !flags[feature] && "text-muted-foreground")}>
                            {definition.label}
                            {definition.labs ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-500/10 px-2 py-px text-[10px] font-bold tracking-wide text-violet-300 uppercase">
                                <FlaskConical className="size-3" aria-hidden /> Roadmap / AI Labs
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">{definition.labs ? "Připravujeme – exkluzivní ukázka pro pilotní zákazníky." : definition.benefit}</p>
                          {!definition.labs && !enabled ? <p className="text-xs text-orange-300">Neaktivní – vypnutý celý modul.</p> : null}
                        </div>
                        {definition.labs ? (
                          <span className="flex items-center gap-1 text-xs text-violet-300">
                            <Sparkles className="size-3.5" aria-hidden /> Připravujeme
                          </span>
                        ) : (
                          <Switch checked={config.features[feature]} onChange={(value) => toggleFeature(feature, value)} label={definition.label} disabled={pending || !enabled} size="sm" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="impact-title" className="space-y-3">
        <div>
          <h2 id="impact-title" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Matice dopadu na role v závodě
          </h2>
          <p className="text-sm text-muted-foreground">Živý přehled – co mají jednotlivé role při aktuálním nastavení k dispozici a co se jim skrylo.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="role-impact">
          {impact.map((role) => (
            <article key={role.accountType} className="rounded-xl border border-border bg-card p-4" data-testid={`impact-${role.accountType}`}>
              <h3 className="flex items-center justify-between gap-2 font-semibold">
                {role.label}
                <span className="text-xs font-normal text-muted-foreground">
                  {role.available.length} nástrojů{role.hidden.length ? ` · ${role.hidden.length} skryto` : ""}
                </span>
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {role.available.map((tool) => (
                  <li key={tool} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                    {tool}
                  </li>
                ))}
                {role.hidden.map((tool) => (
                  <li key={tool} className="flex items-start gap-2 text-muted-foreground" data-hidden-tool>
                    <X className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                    <span className="line-through decoration-zinc-500/70">{tool}</span>
                    {config.displayMode === "UPSELL" ? <ProBadge /> : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
