"use client";

import { ChevronDown, ExternalLink, Presentation } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Kroky živé ukázky průmyslového závodu (agendy fáze 98 a vzorová data závodu). */
const STEPS: readonly { query: string; icon: string; label: string; hint: string; testId: string }[] = [
  { query: "?bim=vzor", icon: "🗺️", label: "Mapa závodu, zálohování Síť / DA / UPS a vzorový BIM model (.ifc)", hint: "2D mapa hal s filtry Běžná síť · Dieselagregát DA do 15 s · Kritická UPS do 0,5 s a načtení vzorového modelu haly", testId: "plant-demo-map" },
  { query: "?faze=2", icon: "🏷️", label: "Rozváděče, stroje a QR štítky", hint: "Karty rozváděčů a strojů se stavem dokumentace a tiskem QR štítku na dveře rozváděče", testId: "plant-demo-qr" },
  { query: "?faze=3", icon: "🖍️", label: "Schémata, elektronická Červenka a zálohy PLC", hint: "Otevřený červený zákres změny ve schématu a verzované zálohy řídicího programu stroje", testId: "plant-demo-redline" },
  { query: "?faze=4&stroj=75", icon: "⚖️", label: "Kniha revizí, Nařízení (EU) 2023/1230 a simulátor nového stroje 75 kW", hint: "Lhůty revizí, podstatné změny strojů a dopad připojení stroje 75 kW na přívody a transformátor", testId: "plant-demo-legislation" },
  { query: "?pruvodce=mise", icon: "🚨", label: "Mise noční poruchy linky (interaktivně, 90 s)", hint: "Příběh údržby: stroj z mapy / QR, Červenka, záloha PLC dle EU 2023/1230, simulátor a Kniha revizí", testId: "plant-demo-mission" },
];

/**
 * Fáze 99: „🎯 Demo scénáře (Prezentace) ▾“ v horní liště průmyslového portálu – scénář Průmyslový závod 4.0 (BIM .ifc,
 * QR, Červenka, Legislativa 2027) jako přímé odkazy na agendy naposledy otevřeného závodu, pro živou ukázku bez hledání.
 */
export function PlantDemoMenu({ plantHref }: { plantHref: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="touch-target gap-1.5 border-yellow-400/60 text-yellow-100 hover:bg-yellow-400/10" data-testid="plant-demo-scenarios">
          <span aria-hidden>🎯</span>
          <span className="hidden lg:inline">Demo scénáře (Prezentace)</span>
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(30rem,92vw)]" data-testid="plant-demo-menu">
        <DropdownMenuLabel>🏭 Průmyslový závod 4.0 (BIM .ifc + QR + Červenka + Legislativa 2027)</DropdownMenuLabel>
        {STEPS.map((step) => (
          <DropdownMenuItem key={step.testId} asChild className="items-start gap-2 py-2">
            <Link href={`${plantHref}${step.query}`} data-testid={step.testId}>
              <span className="text-lg leading-none" aria-hidden>
                {step.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{step.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">{step.hint}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2">
          <a href="/prezentace" target="_blank" rel="noopener" data-testid="plant-demo-presentation">
            <Presentation className="size-4" aria-hidden /> Prezentace a Executive One-Pager
            <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-70" aria-hidden />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
