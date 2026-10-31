"use client";

// Líně načítané těžké klientské komponenty (next/dynamic). Dělení kódu funguje jen z klientské
// komponenty, proto je importují serverové stránky přes tento modul: kód se stáhne až ve chvíli,
// kdy se komponenta poprvé vykreslí (otevřená záložka, porovnání, vrstva výkresu…).

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const Panel = ({ className = "h-96" }: { className?: string }) => <Skeleton className={`w-full rounded-xl ${className}`} role="status" aria-label="Načítání" />;

export const LazyInteractiveSchematic = dynamic(() => import("@/components/equipment/InteractiveSchematic").then((m) => m.InteractiveSchematic), {
  loading: () => <Panel className="h-[34rem]" />,
});

export const LazyRevisionCompare = dynamic(() => import("@/components/revisions/RevisionCompare").then((m) => m.RevisionCompare), {
  loading: () => <Panel className="h-[28rem]" />,
});

export const LazyCabinet3D = dynamic(() => import("@/components/equipment/Cabinet3D").then((m) => m.Cabinet3D), {
  loading: () => <Panel />,
});

export const LazyPanelDiagnostics = dynamic(() => import("@/components/equipment/PanelDiagnostics").then((m) => m.PanelDiagnostics), {
  loading: () => <Panel />,
});

export const LazyBomTable = dynamic(() => import("@/components/equipment/BomTable").then((m) => m.BomTable), {
  loading: () => <Panel className="h-64" />,
});

// Produktové video (Remotion) – jen v prohlížeči, na serveru se vykreslí jen zástupný blok.
export const LazyPromoVideo = dynamic(() => import("@/components/landing/PromoVideo").then((m) => m.PromoVideo), {
  ssr: false,
  loading: () => <Skeleton className="aspect-video w-full rounded-none" role="status" aria-label="Načítání videa" />,
});

export const LazyQrLabelCard = dynamic(() => import("@/components/equipment/QrLabelCard").then((m) => m.QrLabelCard), {
  loading: () => <Panel className="h-80" />,
});
