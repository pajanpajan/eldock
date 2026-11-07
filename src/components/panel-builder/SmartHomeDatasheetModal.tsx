"use client";

import { ExternalLink, FileText } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CatalogProduct } from "@/lib/panel-builder/smart-catalog";
import { datasheetRows, moduleOf, mpnOf, specOf, type DatasheetSource } from "@/lib/panel-builder/smart-datasheet";
import { smartSystemOf, type SmartSystemId } from "@/lib/panel-builder/smart-home";
import { familyLink } from "@/lib/panel-builder/series-links";
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "./ManufacturerLogo";
import { SmartHomeDeviceIllustration, type DeviceTone } from "./SmartHomeDeviceIllustration";
import { SmartHomeWiringDiagram } from "./SmartHomeWiringDiagram";

// Fáze 65: technický list přístroje chytré domácnosti – hlavička (logo, název, typ, MPN, EAN), velký náhled s kótami
// Š × V × H, tabulka parametrů se zdrojem každého údaje a schéma zapojení svorek. Otevírá se z karet katalogu, z levé
// palety i z pravého přehledu akčních členů.

const SOURCE_LABEL: Record<DatasheetSource, string> = { katalog: "katalog výrobců", výpočet: "výpočet Eldock", systém: "parametr systému" };

function Dimensioned({ product, system, tone }: { product: CatalogProduct; system: SmartSystemId; tone: DeviceTone }) {
  const spec = specOf(product);
  const dinModule = moduleOf(product, system);
  const dims = spec?.dimensions ?? (dinModule && dinModule.modules > 0 ? { w: dinModule.modules * 18, h: null, d: null } : null);
  return (
    <figure className="relative mx-auto w-full max-w-80 pb-7 pr-12 pt-5" data-testid="datasheet-preview">
      <SmartHomeDeviceIllustration product={product} system={system} tone={tone} className="aspect-square w-full rounded-lg bg-muted/30 p-3" />
      {dims ? (
        <>
          <div className="absolute inset-x-0 bottom-0 mr-12 flex items-center gap-1 text-[11px] text-muted-foreground" data-testid="dimension-w">
            <span className="h-3 w-px bg-zinc-500" />
            <span className="h-px flex-1 bg-zinc-500" />
            <span className="font-mono">Š {dims.w} mm</span>
            <span className="h-px flex-1 bg-zinc-500" />
            <span className="h-3 w-px bg-zinc-500" />
          </div>
          {dims.h ? (
            <div className="absolute bottom-7 right-0 top-5 flex w-12 flex-col items-center gap-1 text-[11px] text-muted-foreground" data-testid="dimension-h">
              <span className="h-px w-3 bg-zinc-500" />
              <span className="w-px flex-1 bg-zinc-500" />
              <span className="font-mono [writing-mode:vertical-rl]">V {dims.h} mm</span>
              <span className="w-px flex-1 bg-zinc-500" />
              <span className="h-px w-3 bg-zinc-500" />
            </div>
          ) : null}
          {dims.d ? <span className="absolute right-0 top-0 font-mono text-[11px] text-muted-foreground">H {dims.d} mm</span> : null}
        </>
      ) : (
        <figcaption className="absolute inset-x-0 bottom-0 text-center text-[11px] text-muted-foreground">Rozměry: ověřte v datasheetu výrobce</figcaption>
      )}
    </figure>
  );
}

export function SmartHomeDatasheetModal({ product, system, tone, onClose }: { product: (CatalogProduct & { family: string }) | null; system: SmartSystemId; tone: DeviceTone; onClose: () => void }) {
  if (!product) return null;
  const spec = specOf(product);
  const dinModule = moduleOf(product, system);
  const setup = smartSystemOf(system);
  const mpn = mpnOf(product);
  const rows = datasheetRows(product, system);
  const link = familyLink(product.family);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="datasheet">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <ManufacturerLogo manufacturer={setup.manufacturer} className="h-9 w-24" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-1.5">
                <FileText className="size-4 shrink-0" aria-hidden /> {product.label}
              </DialogTitle>
              <DialogDescription>Technický list · {setup.label}</DialogDescription>
              <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3" data-testid="datasheet-ids">
                <div>
                  <dt className="text-muted-foreground">Typové označení</dt>
                  <dd className="font-mono font-semibold">{spec?.typeCode || product.typeCode || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Objednací číslo (MPN)</dt>
                  <dd className={cn("font-mono font-semibold", product.verified === false ? "text-amber-200" : "")}>{mpn ? `${mpn}${product.verified === false ? " (ověřte)" : ""}` : "podle řady a barvy – doplní kusovník"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">EAN</dt>
                  <dd className="text-muted-foreground">neuvedeno v katalogu výrobců</dd>
                </div>
              </dl>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm">{product.description}</p>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Dimensioned product={product} system={system} tone={tone} />
          <table className="w-full text-xs" data-testid="datasheet-params">
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border align-top" data-row={row.id}>
                  <th className="py-1 pr-2 text-left font-medium text-muted-foreground">{row.label}</th>
                  <td className={cn("py-1", row.value ? "" : "text-amber-200")}>
                    {row.value ?? "ověřte v datasheetu výrobce"}
                    {row.source ? <span className="block text-[10px] text-muted-foreground">{SOURCE_LABEL[row.source]}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-bold">Schéma zapojení svorek</h3>
          <SmartHomeWiringDiagram product={product} system={system} />
        </section>
        {spec?.text ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Technický popis z katalogu výrobců</summary>
            <p className="mt-1 text-muted-foreground">{spec.text}</p>
          </details>
        ) : null}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span>
            Zdroj údajů: {[spec ? "katalog výrobců Eldocku (prisma/external-catalog)" : null, dinModule ? dinModule.source : null].filter(Boolean).join(" · ") || "parametry systému – konkrétní přístroj ověřte u výrobce"}
          </span>
          {link ? (
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline" data-testid="datasheet-web">
              🌐 Stránky výrobce <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
