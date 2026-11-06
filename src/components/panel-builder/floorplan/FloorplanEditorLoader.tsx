"use client";

import dynamic from "next/dynamic";

import type { SeriesOption } from "./FloorplanEditor";

// Editor čte rozpracovaný nákres z localStorage už při prvním vykreslení → jen v prohlížeči (bez SSR).
const FloorplanEditor = dynamic(() => import("./FloorplanEditor").then((mod) => mod.FloorplanEditor), {
  ssr: false,
  loading: () => <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Načítám editor půdorysu…</p>,
});

export function FloorplanEditorLoader({ series, manufacturers = [] }: { series: SeriesOption[]; manufacturers?: { name: string; count: number }[] }) {
  return <FloorplanEditor series={series} manufacturers={manufacturers} />;
}
