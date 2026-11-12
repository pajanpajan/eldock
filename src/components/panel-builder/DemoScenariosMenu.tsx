"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Loader2, Presentation } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DEMO_SCENARIOS, isDemoScenarioId, type DemoScenarioId } from "@/lib/panel-builder/demo-scenarios";
import { WIZARD_STEP_KEY } from "@/lib/panel-builder/floorplan-wizard";
import { createDemoFloorplanAction } from "@/server/actions/demo-scenarios";

/** Založí demo půdorys a otevře ho ve fázi 1 průvodce (krok se pamatuje v relaci prohlížeče podle id půdorysu). */
function useDemoLoader() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const load = (scenario: DemoScenarioId) =>
    startTransition(async () => {
      const result = await createDemoFloorplanAction(scenario);
      if (!result.ok) return void toast.error(result.error);
      try {
        window.sessionStorage.setItem(`${WIZARD_STEP_KEY}:${result.data.id}`, "1");
      } catch {
        // soukromý režim – editor otevře výchozí fázi podle obsahu nákresu
      }
      toast.success(`🎯 ${result.data.name} – načteno, projděte fáze 1–5 a vygenerujte rozváděč.`);
      router.push(`/panel-builder/floorplan/${result.data.id}`);
    });
  return { load, pending };
}

/**
 * Fáze 99: „🎯 Demo scénáře (Prezentace) ▾“ v horní liště AI Panel Builderu (seznam rozváděčů i 2D půdorys) – jedním
 * klikem načte kompletní půdorys pro živou ukázku (rodinný dům s FVE a Smart Home, ordinace Skupiny 1, nájemní jednotka
 * obchodního centra BD4); průmyslový závod má vlastní nabídku v průmyslovém portálu.
 */
export function DemoScenariosMenu() {
  const { load, pending } = useDemoLoader();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 border-yellow-400/60 text-yellow-100 hover:bg-yellow-400/10" disabled={pending} data-testid="demo-scenarios">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <span aria-hidden>🎯</span>}
          <span className="2xl:hidden">Demo</span>
          <span className="hidden 2xl:inline">Demo scénáře (Prezentace)</span>
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(30rem,92vw)]" data-testid="demo-scenarios-menu">
        <DropdownMenuLabel>Živá ukázka na 1 klik – uloží se jako nový půdorys</DropdownMenuLabel>
        {DEMO_SCENARIOS.map((scenario) => (
          <DropdownMenuItem key={scenario.id} onSelect={() => load(scenario.id)} className="items-start gap-2 py-2" data-testid={`demo-scenario-${scenario.id}`}>
            <span className="text-lg leading-none" aria-hidden>
              {scenario.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{scenario.label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{scenario.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="items-start gap-2 py-2">
          <a href="/app" target="_blank" rel="noopener" data-testid="demo-scenario-plant">
            <span className="text-lg leading-none" aria-hidden>
              🏭
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">Průmyslový závod 4.0 (BIM .ifc + QR + Červenka + Legislativa 2027)</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">Otevře průmyslový portál v nové kartě (přihlášení účtem závodu) – tam nabídka 🎯 Demo scénáře</span>
            </span>
            <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-70" aria-hidden />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <a href="/prezentace" target="_blank" rel="noopener" data-testid="demo-presentation">
            <Presentation className="size-4" aria-hidden /> Prezentace a Executive One-Pager
            <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-70" aria-hidden />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Fáze 99: `/panel-builder/floorplan?demo=rd-4kk` (odkaz z prezentace) – po přihlášení firmy rovnou načte demo scénář.
 * Jen jednou na otevření stránky (adresa se hned vyčistí), nic se neděje při pouhém prefetchi odkazu.
 */
export function DemoScenarioAutostart({ scenario }: { scenario: string }) {
  const { load } = useDemoLoader();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !isDemoScenarioId(scenario)) return;
    started.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    load(scenario);
  }, [scenario, load]);
  return isDemoScenarioId(scenario) ? (
    <p className="mb-3 flex items-center gap-2 rounded-xl border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100" role="status" data-testid="demo-autostart">
      <Loader2 className="size-4 animate-spin" aria-hidden /> 🎯 Načítám demo scénář…
    </p>
  ) : null;
}
