"use client";

import dynamic from "next/dynamic";

import type { SeriesOption, StoredFloorplan } from "./FloorplanEditor";

// Editor čte zálohu neuložených změn z localStorage už při prvním vykreslení → jen v prohlížeči (bez SSR).
const FloorplanEditor = dynamic(() => import("./FloorplanEditor").then((mod) => mod.FloorplanEditor), {
  ssr: false,
  loading: () => <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Načítám editor půdorysu…</p>,
});

export function FloorplanEditorLoader({
  series,
  manufacturers = [],
  applianceJson = null,
  libraryJson = null,
  company = null,
  stored = null,
  help = null,
  sandbox = false,
  startChoice = false,
}: {
  series: SeriesOption[];
  manufacturers?: { name: string; count: number }[];
  applianceJson?: string | null;
  /** Fáze 78: knihovna půdorysu firmy (šablony sestav, oblíbené). */
  libraryJson?: string | null;
  company?: string | null;
  /** Fáze 64: uložený půdorys (null = nový). */
  stored?: StoredFloorplan | null;
  /** Fáze 89: nápověda k nadpisu editoru (ikona „?“). */
  help?: string | null;
  /** Fáze 92: trenažér 2D půdorysu (rozdělaný bungalov, nic se neukládá). */
  sandbox?: boolean;
  /** Fáze 92: první půdorys firmy – volba trenažér / prázdný půdorys v pravém sloupci editoru. */
  startChoice?: boolean;
}) {
  // Jiný půdorys = nový editor (vlastní historie Zpět / Znovu a ukládání)
  return <FloorplanEditor key={sandbox ? "trenazer" : (stored?.id ?? "novy")} series={series} manufacturers={manufacturers} applianceJson={applianceJson} libraryJson={libraryJson} company={company} stored={stored} help={help} sandbox={sandbox} startChoice={startChoice} />;
}
