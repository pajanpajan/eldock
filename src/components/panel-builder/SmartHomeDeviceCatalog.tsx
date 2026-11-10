"use client";

import { useState } from "react";
import { ExternalLink, FileText, Minus, Plus, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InstallLevel } from "@/engine/floorplan-bridge";
import { productImage } from "@/lib/panel-builder/catalog-images";
import { CATALOG_IMAGES } from "@/lib/panel-builder/catalog-images.generated";
import { familyLink } from "@/lib/panel-builder/series-links";
import { DEVICE_TABS, productsOfTab, type CatalogProduct, type DeviceTab, type ProductFamily } from "@/lib/panel-builder/smart-catalog";
import { moduleOf, mpnOf, productBadges } from "@/lib/panel-builder/smart-datasheet";
import { smartSystemOf, type SmartSystemId } from "@/lib/panel-builder/smart-home";
import { cn } from "@/lib/utils";

import { SmartHomeDeviceIllustration, type DeviceTone } from "./SmartHomeDeviceIllustration";

// Fáze 65: obrázkový katalog chytré domácnosti (místo textového boxu z fáze 63) – záložky podkategorií a mřížka karet:
// vektorový náhled přístroje, název a popis funkce, štítky parametrů, objednací číslo a akce (🎯 Osadit do půdorysu /
// Osazeno X ks, u DIN modulů Automaticky v rozváděči X ks s ručním navýšením, 📄 Datasheet).

export interface SmartCatalogProps {
  family: ProductFamily;
  installation: InstallLevel;
  smartSystem: string;
  activeProduct: string | null;
  color: string;
  tone: DeviceTone;
  /** Osazené kusy výrobku v půdorysu (všechna podlaží). */
  placed: (productId: string) => number;
  /** Kusy modulu podle výpočtu (bez ručně přidaných); 0 = jiný systém nebo není sběrnicová úroveň. */
  planned: (moduleId: string) => number;
  extras: Readonly<Record<string, number>>;
  onSystem: (system: string) => void;
  onBusLevel: () => void;
  onPlace: (product: CatalogProduct) => void;
  onColor: (color: string) => void;
  onExtra: (moduleId: string, delta: 1 | -1) => void;
  onDatasheet: (product: CatalogProduct) => void;
}

function DeviceCard({ product, system, props }: { product: CatalogProduct; system: SmartSystemId; props: SmartCatalogProps }) {
  const bus = props.installation === "bus_loxone";
  const dinModule = moduleOf(product, system);
  const placeable = Boolean(product.item) && product.tab !== "din";
  const placed = placeable ? props.placed(product.id) : 0;
  const active = props.activeProduct === product.id;
  const chosen = props.smartSystem === system;
  const auto = dinModule ? props.planned(dinModule.id) : 0;
  const extra = dinModule ? (props.extras[dinModule.id] ?? 0) : 0;
  const mpn = mpnOf(product);
  // Fáze 78: oficiální náhled výrobce z public/catalog-images (se zdrojem a licencí), jinak vektorový náhled
  const photo = productImage(product.id, CATALOG_IMAGES);
  return (
    <article className={cn("flex flex-col gap-2 rounded-lg border bg-background/40 p-2", active ? "border-primary ring-1 ring-primary" : "border-border")} data-testid="device-card" data-card={product.id}>
      <div className="flex gap-2">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- schválené náhledy výrobců z public/catalog-images (statické soubory)
          <img src={photo.src} alt={`${product.label} – náhled výrobce`} title={`Foto: ${photo.source} · ${photo.license}`} className="size-20 shrink-0 rounded-md bg-white object-contain p-1" data-testid="device-photo" />
        ) : (
          <SmartHomeDeviceIllustration product={product} system={system} tone={props.tone} className="size-20 shrink-0 rounded-md bg-muted/40 p-1" />
        )}
        <div className="min-w-0">
          <h4 className="text-sm font-bold leading-tight">{product.label}</h4>
          <p className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">{product.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1" data-testid="device-badges">
        {productBadges(product, system).map((badge) => (
          <span key={badge} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium">
            {badge}
          </span>
        ))}
        {mpn ? (
          <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", product.verified === false ? "border-amber-400/60 text-amber-200" : "border-border text-muted-foreground")}>
            MPN {mpn}
            {product.verified === false ? " (ověřte)" : ""}
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {placeable ? (
          <>
            <Button type="button" size="sm" variant={active ? "default" : "outline"} className="gap-1" aria-pressed={active} disabled={!bus} onClick={() => props.onPlace(product)} data-product={product.id} title={product.noBus ? "bezdrátově – bez sběrnicového kabelu" : "vloží prvek do místnosti v půdorysu"}>
              <Target className="size-3.5" aria-hidden /> Osadit do půdorysu
            </Button>
            {placed ? (
              <span className="rounded-full border border-emerald-500/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300" data-testid="placed-count">
                Osazeno: {placed} ks
              </span>
            ) : null}
          </>
        ) : null}
        {dinModule ? (
          <div className="flex flex-wrap items-center gap-1 text-[11px]" data-testid="din-count" data-module={dinModule.id}>
            <span className="text-muted-foreground">
              Automaticky v rozváděči: <b className="text-foreground" data-testid="din-auto">{auto} ks</b>
              {extra ? <b className="text-sky-300"> · ručně +{extra}</b> : null}
            </span>
            <Button type="button" size="icon-sm" variant="outline" aria-label={`Ubrat ručně přidaný kus ${product.typeCode ?? product.label}`} disabled={!bus || !chosen || extra === 0} onClick={() => props.onExtra(dinModule.id, -1)} data-testid="din-remove">
              <Minus className="size-3.5" aria-hidden />
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" disabled={!bus || !chosen} onClick={() => props.onExtra(dinModule.id, 1)} title={!chosen ? `Nejdřív zvolte systém ${smartSystemOf(system).label}` : "Přidá další kus nad výpočet (rezerva, rozšíření)"} data-testid="din-add">
              <Plus className="size-3.5" aria-hidden /> Přidat do rozváděče
            </Button>
          </div>
        ) : null}
        {!placeable && !dinModule && product.note ? <span className="text-[10px] text-muted-foreground">{product.note}</span> : null}
        <Button type="button" size="sm" variant="ghost" className="ml-auto gap-1" onClick={() => props.onDatasheet(product)} data-testid="datasheet-open" aria-label={`Datasheet: ${product.label}`}>
          <FileText className="size-3.5" aria-hidden /> Datasheet
        </Button>
      </div>
    </article>
  );
}

export function SmartHomeDeviceCatalog(props: SmartCatalogProps) {
  const { family } = props;
  const system = (family.system ?? "abb_freeathome") as SmartSystemId;
  const tabs = DEVICE_TABS.filter((tab) => productsOfTab(family, tab.id).length);
  const [tab, setTab] = useState<DeviceTab>(tabs[0]?.id ?? "controls");
  const current = tabs.some((option) => option.id === tab) ? tab : (tabs[0]?.id ?? "controls");
  const products = productsOfTab(family, current);
  const bus = props.installation === "bus_loxone";
  const chosen = props.smartSystem === family.system;
  const setup = family.system ? smartSystemOf(family.system) : null;
  const link = familyLink(family.id);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-2" data-testid="smart-catalog" data-family={family.id}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{family.description}</p>
        {setup ? (
          <Button type="button" size="sm" variant={chosen ? "default" : "outline"} className="text-xs" onClick={() => props.onSystem(setup.id)} data-testid="smart-catalog-system" aria-pressed={chosen}>
            {chosen ? "✓ " : ""}Systém: {setup.label}
          </Button>
        ) : null}
        {link ? (
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold hover:border-primary/60" data-testid="family-web" title={link.label}>
            🌐 Prohlédnout na webu výrobce <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
      {family.colors ? (
        <div className="flex flex-wrap items-center gap-1 text-xs" role="radiogroup" aria-label={`Barva ${family.manufacturer}`}>
          {family.colors.map((option) => (
            <button key={option.id} type="button" role="radio" aria-checked={props.color === option.id} onClick={() => props.onColor(option.id)} className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5", props.color === option.id ? "border-primary bg-primary/15" : "border-border text-muted-foreground")}>
              <span className="size-3.5 rounded-full border border-zinc-500" style={{ background: option.swatch }} aria-hidden />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {!bus ? (
        <p className="flex flex-wrap items-center gap-2 rounded-md border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-100" data-testid="smart-catalog-level">
          Výrobky chytré domácnosti se vkládají na sběrnicové úrovni instalace.
          <Button type="button" size="xs" variant="outline" onClick={props.onBusLevel}>
            Přepnout na sběrnicovou instalaci
          </Button>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Podkategorie výrobků">
        {tabs.map((option) => {
          const count = productsOfTab(family, option.id).length;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={current === option.id}
              onClick={() => setTab(option.id)}
              className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold", current === option.id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              data-testid={`smart-tab-${option.id}`}
            >
              {option.label}
              <span className="font-normal opacity-70">({option.hint})</span>
              <span className="rounded-full bg-muted px-1.5 text-[10px] text-foreground">{count}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid={current === "din" ? "smart-catalog-din" : `smart-panel-${current}`}>
        {products.map((product) => (
          <DeviceCard key={product.id} product={product} system={system} props={props} />
        ))}
      </div>
      {current === "din" ? <p className="text-[11px] text-emerald-200">Počty a kanály dopočítá výpočet chytré domácnosti do rozváděče; ručně přidané kusy se přičtou (rezerva, rozšíření) a vloží se při generování rozváděče.</p> : null}
    </div>
  );
}
