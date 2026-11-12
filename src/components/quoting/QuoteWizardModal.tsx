"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Loader2, Printer, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CONSTRUCTIONS, NH_TASKS, NH_VERSION, calibrateFromActual, nhOf, nhUpdateAvailable, type ConstructionId, type NhCalibration } from "@/lib/quoting/normohodiny-catalog";
import { DEFAULT_VALIDITY_DAYS, DISCOUNT_PRESETS, QUOTE_SCOPES, VAT_OPTIONS, buildQuote, type QuoteLayout, type QuoteMaterial, type QuoteParty, type QuoteScope, type QuoteWork, type VatRate } from "@/lib/quoting/quote-engine";
import { customerQuoteHtml, customerQuoteRows, czDate, czk } from "@/lib/quoting/quote-print";
import { DEFAULT_QUOTE_SETTINGS, type QuoteSettings } from "@/lib/quoting/quote-settings";
import type { OrderLine } from "@/lib/quoting/wholesaler-export";
import { IP_NOTICE } from "@/lib/legal";
import { cn } from "@/lib/utils";
import { buildXlsx } from "@/lib/xlsx";
import { quoteContextAction, reserveQuoteNumberAction, saveQuoteSettingsAction } from "@/server/actions/quotes";

import { WholesalerExport } from "./WholesalerExport";

/** Interní upozornění pro elektrikáře – jen v aplikaci, nikdy ve výstupu pro zákazníka. */
export const INTERNAL_NOTICE_TITLE = "ℹ️ Informace ke kalkulaci (interní – nezobrazuje se v nabídce pro zákazníka):";
export const INTERNAL_NOTICE_TEXT =
  "Výpočet materiálu vychází z oficiálních ceníkových cen výrobců (bez započtení vašeho individuálního velkoobchodního rabatu). Výpočet montážních prací vychází z průběžně aktualizovaných normohodin (NH) pro jednotlivé úkony. V samotné vygenerované cenové nabídce pro koncového zákazníka není zmínka o ceníkových cenách ani o normohodinách nikde uvedena.";

export interface QuoteSource {
  title: string;
  materials: readonly QuoteMaterial[];
  work: QuoteWork;
  defaultScope: QuoteScope;
  /** Položky pro export do velkoobchodu (EAN / objednací číslo a množství). */
  orderLines: readonly OrderLine[];
  /** Ceníkové ceny už zjištěné na serveru (stránka rozváděče); jinak se dotáže akce. */
  pricesKnown?: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const n = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Block({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border p-3" aria-label={title}>
      <h3 className="text-sm font-semibold">
        <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{index}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Choice({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("rounded-lg border px-2.5 py-1.5 text-left text-xs", active ? "border-primary bg-primary/15 font-semibold" : "border-border hover:bg-muted")} data-testid={testId}>
      {children}
    </button>
  );
}

/** Kalibrace normohodin: úprava úkonů nebo „Skutečně odpracováno X hodin“ po dokončení zakázky. */
function NhCalibrationPanel({ calibration, plannedHours, onChange }: { calibration: NhCalibration; plannedHours: number; onChange: (next: NhCalibration) => void }) {
  const [actual, setActual] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs" data-testid="nh-calibration">
      <p>
        Matice {NH_VERSION} · firemní koeficient <b>{n(calibration.factor)}×</b> ({calibration.samples} zakázek){nhUpdateAvailable(calibration) ? " · k dispozici nová verze matice – uložením ji převezmete (vaše úpravy úkonů zůstanou)" : ""}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          Skutečně odpracováno na dokončené zakázce [h]
          <input type="number" min={0} step={0.5} value={actual} onChange={(event) => setActual(event.target.value)} className="h-8 w-32 rounded-md border border-input bg-transparent px-2" data-testid="nh-actual" />
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!(Number(actual) > 0) || !(plannedHours > 0)}
          onClick={() => {
            const next = calibrateFromActual(calibration, { plannedHours, actualHours: Number(actual) });
            onChange(next);
            setActual("");
            toast.success(`Firemní koeficient normohodin je teď ${n(next.factor)}×.`);
          }}
          data-testid="nh-calibrate"
        >
          Zkalibrovat podle odpracovaných hodin (kalkulace {n(plannedHours)} h)
        </Button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-0.5">Úkon</th>
            <th className="w-16 text-right">MJ</th>
            <th className="w-24 text-right">NH / MJ</th>
          </tr>
        </thead>
        <tbody>
          {NH_TASKS.map((task) => (
            <tr key={task.id} className="border-t border-border/50">
              <td className="py-0.5 pr-2">{task.label}</td>
              <td className="text-right">{task.unit}</td>
              <td className="text-right">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={nhOf(task, calibration)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value) || value < 0) return;
                    onChange({ ...calibration, version: NH_VERSION, overrides: { ...calibration.overrides, [task.id]: value } });
                  }}
                  className="h-7 w-20 rounded border border-input bg-transparent px-1 text-right"
                  aria-label={`Normohodiny – ${task.label}`}
                  data-testid={`nh-task-${task.id}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Fáze 105: „💰 Vytvořit cenovou nabídku“ – krátký průvodce na jedné obrazovce (rozsah, sazba a konstrukce, obchodní
 * úprava cen a DPH, zákazník a platnost), interní žlutý banner jen pro elektrikáře a náhled nabídky pro zákazníka
 * (tisk / PDF, XLSX). Nabídka pro zákazníka neobsahuje interní pojmy kalkulace (hlídá `assertCustomerSafe`).
 */
export function QuoteWizardModal({ source, triggerClassName, company }: { source: QuoteSource; triggerClassName?: string; company?: { name?: string | null; contact?: string | null; phone?: string | null } | null }) {
  const [open, setOpen] = useState(false);
  const [loading, startLoading] = useTransition();
  const [prices, setPrices] = useState<Record<string, { priceCzk: number; source: string }>>({});
  const [supplier, setSupplier] = useState<QuoteParty>({ name: company?.name ?? "" });
  const [settings, setSettings] = useState<QuoteSettings>(DEFAULT_QUOTE_SETTINGS);
  const [scope, setScope] = useState<QuoteScope>(source.defaultScope);
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_QUOTE_SETTINGS.hourlyRate);
  const [construction, setConstruction] = useState<ConstructionId>("aac");
  const [discount, setDiscount] = useState(0);
  const [customDiscount, setCustomDiscount] = useState("");
  const [vatRate, setVatRate] = useState<VatRate>(12);
  const [customer, setCustomer] = useState<QuoteParty>({ name: "" });
  const [number, setNumber] = useState("");
  const [validity, setValidity] = useState(DEFAULT_VALIDITY_DAYS);
  const [layout, setLayout] = useState<QuoteLayout>("items");
  const [manual, setManual] = useState<Record<string, number>>({});
  const [showNh, setShowNh] = useState(false);
  const [aresBusy, setAresBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const result = await quoteContextAction(source.materials.filter((item) => item.listPriceCzk === null).map((item) => ({ key: item.key, kind: item.priceKind ?? (item.unit === "m" ? "cable" : "device"), code: item.code ?? null, name: item.name })));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPrices(result.data.prices);
      setSupplier(result.data.supplier);
      setSettings(result.data.settings);
      setHourlyRate(result.data.settings.hourlyRate);
      setConstruction(result.data.settings.construction);
      setVatRate(result.data.settings.vatRate);
      setNumber((current) => current || result.data.nextNumber);
    });
  }, [open, source.materials]);

  const materials = useMemo(() => source.materials.map((item) => (item.listPriceCzk === null && prices[item.key] ? { ...item, listPriceCzk: prices[item.key].priceCzk, priceSource: prices[item.key].source } : item)), [source.materials, prices]);
  const result = useMemo(
    () =>
      buildQuote(materials, source.work, {
        scope,
        hourlyRate,
        construction,
        discountPct: discount,
        vatRate,
        layout,
        number: number || "NAB-návrh",
        issuedAt: today(),
        validityDays: validity,
        customer,
        supplier,
        title: source.title,
        calibration: settings.calibration,
        manualPrices: manual,
      }),
    [materials, source.work, source.title, scope, hourlyRate, construction, discount, vatRate, layout, number, validity, customer, supplier, settings.calibration, manual],
  );

  const persist = (patch: Parameters<typeof saveQuoteSettingsAction>[0]) => void saveQuoteSettingsAction(patch).then((saved) => (saved.ok ? setSettings(saved.data) : null));

  async function loadAres() {
    const ico = (customer.ico ?? "").replace(/\s+/g, "");
    if (!/^\d{8}$/.test(ico)) {
      toast.error("IČO má 8 číslic.");
      return;
    }
    setAresBusy(true);
    try {
      const response = await fetch(`/api/ares?ico=${ico}`);
      const data = (await response.json()) as { companyName?: string; dic?: string | null; street?: string; city?: string; zip?: string; error?: string };
      if (!response.ok || !data.companyName) throw new Error(data.error ?? "Firmu se nepodařilo načíst z ARESu.");
      setCustomer((current) => ({ ...current, name: data.companyName!, ico, dic: data.dic ?? null, address: [data.street, `${data.zip ?? ""} ${data.city ?? ""}`.trim()].filter(Boolean).join(", ") }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ARES je nedostupný – vyplňte údaje ručně.");
    } finally {
      setAresBusy(false);
    }
  }

  async function finalNumber() {
    if (number && number !== result.customer.number) return number;
    const reserved = await reserveQuoteNumberAction();
    if (reserved.ok) {
      setNumber(reserved.data);
      return reserved.data;
    }
    return number || "NAB-návrh";
  }

  async function printQuote() {
    const numberNow = await finalNumber();
    const html = customerQuoteHtml({ ...result.customer, number: numberNow }, IP_NOTICE);
    const view = window.open("", "_blank", "noopener=no");
    if (!view) {
      download(`nabidka-${numberNow}.html`, html, "text/html;charset=utf-8");
      return;
    }
    view.document.open();
    view.document.write(html);
    view.document.close();
    view.focus();
    setTimeout(() => view.print(), 300);
  }

  const missing = result.internal.missingPrices;
  const customerQuote = result.customer;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={cn("gap-1.5", triggerClassName)} data-testid="quote-open">
          💰 Vytvořit cenovou nabídku
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl" data-testid="quote-wizard">
        <DialogHeader>
          <DialogTitle>💰 Cenová nabídka – {source.title}</DialogTitle>
          <DialogDescription>Čtyři parametry, náhled nabídky pro zákazníka vpravo. Ceny se přepočítávají hned.</DialogDescription>
        </DialogHeader>
        {/* Interní upozornění – jen v aplikaci, do nabídky pro zákazníka se nepropisuje */}
        <div className="rounded-xl border border-amber-400/70 bg-amber-300/15 p-3 text-xs text-amber-100" role="note" data-testid="quote-internal-notice">
          <b className="block">{INTERNAL_NOTICE_TITLE}</b>
          <i>„{INTERNAL_NOTICE_TEXT}“</i>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám ceníkové ceny a nastavení firmy…
          </p>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Block index={1} title="Rozsah nabídky">
              <div className="flex flex-col gap-1.5">
                {QUOTE_SCOPES.map((option) => (
                  <Choice key={option.id} active={scope === option.id} onClick={() => setScope(option.id)} testId={`quote-scope-${option.id}`}>
                    {option.icon} {option.label}
                  </Choice>
                ))}
              </div>
            </Block>
            <Block index={2} title="Hodinová sazba a typ stavby">
              <label className="flex items-center gap-2 text-xs">
                Vaše hodinová sazba
                <input type="number" min={0} step={10} value={hourlyRate} onChange={(event) => setHourlyRate(Math.max(0, Number(event.target.value) || 0))} onBlur={() => persist({ hourlyRate })} className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right" data-testid="quote-rate" />
                Kč / hod
              </label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {CONSTRUCTIONS.map((option) => (
                  <Choice
                    key={option.id}
                    active={construction === option.id}
                    onClick={() => {
                      setConstruction(option.id);
                      persist({ construction: option.id });
                    }}
                    testId={`quote-construction-${option.id}`}
                  >
                    {option.label} <span className="text-muted-foreground">(koef. {n(option.factor)}×)</span>
                  </Choice>
                ))}
              </div>
            </Block>
            <Block index={3} title="Obchodní úprava cen materiálu a DPH">
              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_PRESETS.map((value) => (
                  <Choice
                    key={value}
                    active={discount === value && !customDiscount}
                    onClick={() => {
                      setDiscount(value);
                      setCustomDiscount("");
                    }}
                    testId={`quote-discount-${value}`}
                  >
                    {value === 0 ? "Ceníková cena (0 %)" : `Sleva −${value} %`}
                  </Choice>
                ))}
                <label className="flex items-center gap-1 text-xs">
                  vlastní
                  <input
                    type="number"
                    min={-100}
                    max={90}
                    value={customDiscount}
                    onChange={(event) => {
                      setCustomDiscount(event.target.value);
                      const value = Number(event.target.value);
                      if (Number.isFinite(value)) setDiscount(value);
                    }}
                    className="h-8 w-16 rounded-md border border-input bg-transparent px-1 text-right"
                    aria-label="Vlastní sleva v procentech"
                    data-testid="quote-discount-custom"
                  />
                  %
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
                {VAT_OPTIONS.map((option) => (
                  <Choice
                    key={option.rate}
                    active={vatRate === option.rate}
                    onClick={() => {
                      setVatRate(option.rate);
                      persist({ vatRate: option.rate });
                    }}
                    testId={`quote-vat-${option.rate}`}
                  >
                    {option.label}
                  </Choice>
                ))}
              </div>
            </Block>
            <Block index={4} title="Zákazník a platnost">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <label className="col-span-2 flex flex-col gap-0.5">
                  Jméno / firma odběratele
                  <input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} className="h-8 rounded-md border border-input bg-transparent px-2" data-testid="quote-customer-name" />
                </label>
                <label className="flex flex-col gap-0.5">
                  IČO
                  <span className="flex gap-1">
                    <input value={customer.ico ?? ""} onChange={(event) => setCustomer({ ...customer, ico: event.target.value })} inputMode="numeric" maxLength={8} className="h-8 w-full rounded-md border border-input bg-transparent px-2" data-testid="quote-customer-ico" />
                    <Button type="button" size="sm" variant="outline" disabled={aresBusy} onClick={() => void loadAres()} data-testid="quote-ares">
                      {aresBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "ARES"}
                    </Button>
                  </span>
                </label>
                <label className="flex flex-col gap-0.5">
                  Adresa
                  <input value={customer.address ?? ""} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} className="h-8 rounded-md border border-input bg-transparent px-2" />
                </label>
                <label className="flex flex-col gap-0.5">
                  Číslo nabídky
                  <input value={number} onChange={(event) => setNumber(event.target.value.slice(0, 40))} className="h-8 rounded-md border border-input bg-transparent px-2 font-mono" data-testid="quote-number" />
                </label>
                <label className="flex flex-col gap-0.5">
                  Platnost [dní]
                  <input type="number" min={1} max={365} value={validity} onChange={(event) => setValidity(Math.max(1, Number(event.target.value) || DEFAULT_VALIDITY_DAYS))} className="h-8 rounded-md border border-input bg-transparent px-2" />
                </label>
              </div>
              <div className="flex gap-1.5">
                <Choice active={layout === "items"} onClick={() => setLayout("items")} testId="quote-layout-items">
                  Položkový rozpočet
                </Choice>
                <Choice active={layout === "chapters"} onClick={() => setLayout("chapters")} testId="quote-layout-chapters">
                  Souhrnná nabídka po kapitolách
                </Choice>
              </div>
            </Block>
            {/* Interní souhrn kalkulace (jen v aplikaci) */}
            <section className="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs" aria-label="Interní podklady kalkulace" data-testid="quote-internal">
              <b>Interní podklady (do nabídky se nepropisují)</b>
              <span>
                Práce: {n(result.internal.laborHours)} h ({result.internal.nhVersion}, koeficient stavby {n(result.internal.constructionFactor)}×, firemní {n(result.internal.calibrationFactor)}×) · materiál v ceníkových cenách {czk(result.internal.materialListCzk)} → zákazníkovi {czk(result.internal.materialCustomerCzk)}
              </span>
              {result.internal.pricedFrom.length ? <span className="text-muted-foreground">Zdroje cen: {result.internal.pricedFrom.map((entry) => `${entry.source} (${entry.lines})`).join(" · ")}</span> : null}
              {missing.length ? (
                <div className="flex flex-col gap-1" data-testid="quote-missing">
                  <span className="font-semibold text-amber-200">{missing.length} položek bez ceníkové ceny – doplňte cenu za jednotku pro zákazníka (jinak 0 Kč):</span>
                  {missing.slice(0, 40).map((item) => (
                    <label key={item.key} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate" title={item.name}>
                        {item.name}
                        {item.code ? <span className="font-mono text-muted-foreground"> {item.code}</span> : null} · {n(item.quantity)} {item.unit}
                      </span>
                      <input type="number" min={0} step={1} value={manual[item.key] ?? ""} onChange={(event) => setManual((current) => ({ ...current, [item.key]: Math.max(0, Number(event.target.value) || 0) }))} className="h-7 w-24 rounded border border-input bg-transparent px-1 text-right" aria-label={`Cena za jednotku – ${item.name}`} />
                    </label>
                  ))}
                </div>
              ) : null}
              <Button type="button" size="sm" variant="outline" className="w-fit gap-1.5" onClick={() => setShowNh((value) => !value)} data-testid="nh-toggle">
                <Settings2 className="size-4" aria-hidden /> ⚙️ Upravit normohodiny / Kalibrovat podle mé rychlosti
              </Button>
              {showNh ? (
                <NhCalibrationPanel
                  calibration={settings.calibration}
                  plannedHours={result.internal.laborHours}
                  onChange={(calibration) => {
                    setSettings({ ...settings, calibration });
                    persist({ calibration });
                  }}
                />
              ) : null}
            </section>
          </div>
          {/* Náhled nabídky pro zákazníka – stejný obsah jako tisk */}
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" className="gap-1.5" onClick={() => void printQuote()} data-testid="quote-print">
                <Printer className="size-4" aria-hidden /> Tisk / PDF nabídky
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={async () => {
                  const numberNow = await finalNumber();
                  download(`nabidka-${numberNow}.xlsx`, buildXlsx("Nabídka", customerQuoteRows({ ...customerQuote, number: numberNow })) as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                }}
                data-testid="quote-xlsx"
              >
                <FileSpreadsheet className="size-4" aria-hidden /> Nabídka XLSX
              </Button>
            </div>
            <article className="rounded-xl bg-white p-4 text-[12px] text-zinc-900" data-testid="quote-customer">
              <header className="flex items-start justify-between border-b-2 border-zinc-900 pb-2">
                <div>
                  <h2 className="text-lg font-bold">Cenová nabídka</h2>
                  <p>{customerQuote.title}</p>
                </div>
                <div className="text-right text-[11px]">
                  <b>č. {customerQuote.number}</b>
                  <p>Vystaveno {czDate(customerQuote.issuedAt)}</p>
                  <p>Platnost do {czDate(customerQuote.validUntil)}</p>
                </div>
              </header>
              <div className="my-2 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <b className="block text-[10px] uppercase text-zinc-500">Dodavatel</b>
                  {customerQuote.supplier.name}
                  {customerQuote.supplier.ico ? <span className="block">IČO {customerQuote.supplier.ico}</span> : null}
                </div>
                <div>
                  <b className="block text-[10px] uppercase text-zinc-500">Odběratel</b>
                  {customerQuote.customer.name || "–"}
                  {customerQuote.customer.ico ? <span className="block">IČO {customerQuote.customer.ico}</span> : null}
                </div>
              </div>
              {customerQuote.chapters.map((chapter) => (
                <section key={chapter.id} className="mt-2" data-testid={`quote-chapter-${chapter.id}`}>
                  <h3 className="font-bold">{chapter.title}</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-100 text-left">
                        <th className="px-1 py-0.5">Položka</th>
                        <th className="px-1 text-right">Množství</th>
                        <th className="px-1">MJ</th>
                        <th className="px-1 text-right">Cena za MJ</th>
                        <th className="px-1 text-right">Celkem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapter.lines.map((line, index) => (
                        <tr key={`${line.name}-${index}`} className="border-b border-zinc-200">
                          <td className="px-1 py-0.5">
                            {line.name}
                            {line.code ? <span className="block font-mono text-[10px] text-zinc-500">{line.code}</span> : null}
                          </td>
                          <td className="px-1 text-right">{n(line.quantity)}</td>
                          <td className="px-1">{line.unit}</td>
                          <td className="px-1 text-right">{czk(line.unitPriceCzk)}</td>
                          <td className="px-1 text-right">{czk(line.totalCzk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-right font-semibold">Celkem: {czk(chapter.totalCzk)}</p>
                </section>
              ))}
              <table className="ml-auto mt-3 w-1/2">
                <tbody>
                  <tr>
                    <td>Celkem bez DPH</td>
                    <td className="text-right">{czk(customerQuote.totals.withoutVatCzk)}</td>
                  </tr>
                  <tr>
                    <td>DPH {customerQuote.totals.vatRate} %</td>
                    <td className="text-right">{czk(customerQuote.totals.vatCzk)}</td>
                  </tr>
                  <tr className="border-t-2 border-zinc-900 text-sm font-bold">
                    <td>Celkem s DPH</td>
                    <td className="text-right" data-testid="quote-total">
                      {czk(customerQuote.totals.withVatCzk)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 text-[10px] text-zinc-600">
                {customerQuote.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </article>
            <WholesalerExport lines={source.orderLines} title={source.title} initial={settings.wholesaler} company={company} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
