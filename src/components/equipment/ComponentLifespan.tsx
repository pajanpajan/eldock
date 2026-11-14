"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIFESPAN_STATUS, SHIFT_REGIMES, WEAR_CATEGORIES, daysWord, type WearCategory } from "@/lib/component-lifespan";
import { isCriticalRow, type LifespanRowView } from "@/lib/lifespan-view";
import { cn } from "@/lib/utils";
import { addMonitoredComponentAction, deleteMonitoredComponentAction, replaceBomComponentAction } from "@/server/actions/lifespan";

import { RemainingBar, endText, useLifespanCall } from "./BomLifespanTable";
import { ComponentDatasheetDialog } from "./ComponentDatasheetDialog";

const n = (value: number, digits = 0) => value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });
const select = "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

/**
 * Sekce 1 záložky Diagnostika (fáze 53, fáze 116): ⏳ součástky po životnosti a kritické nahoře – přepínač „🔴 Jen po
 * životnosti a kritické (X)“ / „Zobrazit všechny“, zbývající životnost 100 % → 0 %, konec životnosti, sklad, výměna
 * (Reset 100 %) a datasheet. Provoz stroje (směnnost, teplota, předstih) se nastavuje v záložce Kusovník & Životnost.
 */
export function ComponentLifespan({
  equipmentId,
  revisionId,
  rows,
  profile,
  alertDays,
  bom,
  canEdit,
  bomHref,
  purchaseHref,
}: {
  equipmentId: string;
  revisionId: string | null;
  rows: LifespanRowView[];
  profile: { shiftRegime: number; internalTempC: number | null };
  alertDays: number;
  bom: { designation: string; description: string; manufacturer: string | null; partNumber: string | null }[];
  canEdit: boolean;
  bomHref: string;
  purchaseHref: string | null;
}) {
  const [pending, call] = useLifespanCall();
  const tracked = rows.filter((row) => row.assessment);
  const critical = tracked.filter(isCriticalRow).sort((a, b) => (a.assessment!.remainingDays ?? Infinity) - (b.assessment!.remainingDays ?? Infinity));
  const [onlyCritical, setOnlyCritical] = useState(true);
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState<LifespanRowView | null>(null);
  const shown = onlyCritical ? critical : [...tracked].sort((a, b) => a.assessment!.remainingPercent - b.assessment!.remainingPercent);
  const regime = SHIFT_REGIMES.find((entry) => entry.id === profile.shiftRegime);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Životnost součástek a prediktivní údržba" data-testid="component-lifespan">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">⏳ Součástky po životnosti a k okamžité výměně</h3>
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Ukládám" /> : null}
      </header>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Filtr součástek">
          <button type="button" role="radio" aria-checked={onlyCritical} onClick={() => setOnlyCritical(true)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", onlyCritical ? "bg-red-500/80 text-white" : "text-muted-foreground hover:text-foreground")} data-testid="lifespan-filter-critical">
            🔴 Jen po životnosti a kritické ({critical.length})
          </button>
          <button type="button" role="radio" aria-checked={!onlyCritical} onClick={() => setOnlyCritical(false)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", !onlyCritical ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} data-testid="lifespan-filter-all">
            Zobrazit všechny ({tracked.length})
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {regime?.longLabel ?? "–"} · T<sub>rozváděče</sub> {profile.internalTempC === null ? "35 °C (výchozí)" : `${n(profile.internalTempC, 1)} °C`} · předstih {daysWord(alertDays)} ·{" "}
          <Link href={bomHref} className="text-primary underline-offset-2 hover:underline">
            nastavit v Kusovníku & Životnosti
          </Link>
        </span>
        {purchaseHref ? (
          <Link href={purchaseHref} className="ml-auto rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted" data-testid="diagnostics-purchase-link">
            📦 Nákupní report součástek
          </Link>
        ) : null}
      </div>

      {shown.length ? (
        <ul className="grid gap-2 lg:grid-cols-2" data-testid="lifespan-list">
          {shown.map((row) => {
            const assessment = row.assessment!;
            const style = LIFESPAN_STATUS[assessment.status];
            return (
              <li key={row.key} className={cn("flex flex-col gap-1.5 rounded-lg border p-3", assessment.expired ? "border-red-500/60 bg-red-500/5" : "border-border")} data-component={row.designation} data-status={assessment.status} data-expired={assessment.expired ? "true" : "false"}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="font-mono">{row.designation}</span> {row.description}
                    </p>
                    <p className="text-xs text-muted-foreground">{[row.manufacturer, row.partNumber].filter(Boolean).join(" ") || WEAR_CATEGORIES.find((category) => category.id === row.category)?.label}</p>
                  </div>
                  <span className={cn("shrink-0 text-xs font-semibold", style.text)}>
                    {style.emoji} {style.label}
                  </span>
                </div>
                <div data-testid="lifespan-percent">
                  <RemainingBar row={row} />
                </div>
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {assessment.limits.map((limit) => (
                    <li key={limit.kind} className="flex justify-between gap-2">
                      <span>{limit.label}</span>
                      <span className="font-mono">
                        {limit.kind === "calendar" ? `${n(limit.used)} / ${n(limit.max)} dní` : limit.kind === "hours" ? `${n(limit.used)} / ${n(limit.max)} h` : `${n(limit.used)} / ${n(limit.max)}`} ({n(limit.percent, 1)} % vyčerpáno)
                      </span>
                    </li>
                  ))}
                </ul>
                {assessment.thermalDerating ? (
                  <p className="text-xs text-amber-200" data-testid="arrhenius">
                    🌡️ Arrhenius: při {n(assessment.thermalDerating.tempC, 1)} °C v rozváděči klesla životnost z {n(assessment.thermalDerating.fromHours)} h na {n(assessment.thermalDerating.toHours)} h.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={row.stock > 0 ? "text-emerald-300" : "font-semibold text-red-300"} data-testid="lifespan-stock">
                    {row.stock > 0 ? `🟢 Skladem: ${row.stock} ks` : "⚠️ 0 ks – Chybí!"}
                  </span>
                  <span className={assessment.expired ? "font-semibold text-red-300" : style.text} data-testid="lifespan-end">
                    {endText(row)}
                  </span>
                </div>
                {row.notes ? <p className="text-[11px] text-muted-foreground">{row.notes}</p> : null}
                <div className="flex flex-wrap gap-1.5">
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={assessment.expired ? "default" : "outline"}
                      className="gap-1.5"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Zapsat výměnu ${row.designation} za nový kus? Životnost začne znovu na 100 % k dnešnímu dni.`)) {
                          call(() => replaceBomComponentAction({ equipmentId, designation: row.designation, revisionId }), `${row.designation}: vyměněno – zbývá 100 %.`);
                        }
                      }}
                    >
                      <RefreshCw className="size-3.5" aria-hidden /> 🔄 Vyměněno (Reset 100 %)
                    </Button>
                  ) : null}
                  {row.partNumber ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSheet(row)}>
                      📄 Datasheet
                    </Button>
                  ) : null}
                  {canEdit && row.componentId && !row.inBom ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Přestat sledovat ${row.designation}`}
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Přestat sledovat ${row.designation}?`)) call(() => deleteMonitoredComponentAction({ equipmentId, componentId: row.componentId! }), "Součástka odebrána.");
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground" data-testid="lifespan-empty">
          {onlyCritical ? "✅ Žádná součástka není po životnosti ani v okně upozornění – dnes není co měnit." : "Zatím se nesleduje žádná součástka – doplňte kusovník nebo přidejte součástku."}
        </p>
      )}

      {canEdit ? (
        adding ? (
          <AddComponentForm
            bom={bom}
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(data) =>
              call(async () => {
                const result = await addMonitoredComponentAction({ equipmentId, ...data });
                if (result.ok) setAdding(false);
                return result;
              }, `${data.designation} se sleduje.`)
            }
          />
        ) : (
          <Button type="button" variant="outline" className="gap-1.5 self-start" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Přidat sledovanou součástku mimo kusovník
          </Button>
        )
      ) : null}
      {sheet ? <ComponentDatasheetDialog row={sheet} open onOpenChange={(open) => (!open ? setSheet(null) : undefined)} /> : null}
    </section>
  );
}

/** Výchozí limity podle kategorie (katalogové hodnoty typických prvků). */
const PRESETS: Record<
  WearCategory,
  {
    cyclesPerHour: string;
    maxCycles: string;
    maxHours: string;
    maxMonths: string;
  }
> = {
  SWITCHING_CONTACTOR: {
    cyclesPerHour: "60",
    maxCycles: "1000000",
    maxHours: "",
    maxMonths: "",
  },
  SAFETY_ELEMENT: {
    cyclesPerHour: "20",
    maxCycles: "1000000",
    maxHours: "",
    maxMonths: "240",
  },
  POWER_ELECTRONICS: {
    cyclesPerHour: "",
    maxCycles: "",
    maxHours: "50000",
    maxMonths: "",
  },
  COOLING_FAN_FILTER: {
    cyclesPerHour: "",
    maxCycles: "",
    maxHours: "",
    maxMonths: "6",
  },
  BATTERY: {
    cyclesPerHour: "",
    maxCycles: "",
    maxHours: "",
    maxMonths: "48",
  },
  SURGE_PROTECTION: {
    cyclesPerHour: "0",
    maxCycles: "15",
    maxHours: "",
    maxMonths: "120",
  },
};

/** Odhad kategorie z popisu prvku kusovníku. */
function guessCategory(description: string): WearCategory {
  if (/přepěť|prepet|svodič|svodic|spd/i.test(description)) return "SURGE_PROTECTION";
  if (/bateri|akumul|ups/i.test(description)) return "BATTERY";
  if (/safety|bezpečnost|pnoz|nouzov/i.test(description))
    return "SAFETY_ELEMENT";
  if (/zdroj|měnič|menic|psu|sinamics|frekven|kondenz/i.test(description))
    return "POWER_ELECTRONICS";
  if (/ventil[aá]tor|filtr|fan/i.test(description))
    return "COOLING_FAN_FILTER";
  return "SWITCHING_CONTACTOR";
}

function AddComponentForm({
  bom,
  pending,
  onCancel,
  onSubmit,
}: {
  bom: {
    designation: string;
    description: string;
    manufacturer: string | null;
    partNumber: string | null;
  }[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (
    data: Omit<
      Parameters<typeof addMonitoredComponentAction>[0],
      "equipmentId"
    >,
  ) => void;
}) {
  const [form, setForm] = useState({
    designation: "",
    name: "",
    manufacturer: "",
    modelNumber: "",
    wearCategory: "SWITCHING_CONTACTOR" as WearCategory,
    ...PRESETS.SWITCHING_CONTACTOR,
    offset: "0",
    stock: "0",
  });
  const set = (patch: Partial<typeof form>) =>
    setForm((current) => ({ ...current, ...patch }));
  const toInt = (value: string) =>
    value.trim() === ""
      ? null
      : Math.round(Number(value.replace(/\s/g, "").replace(",", ".")));
  const toNum = (value: string) =>
    value.trim() === ""
      ? null
      : Number(value.replace(/\s/g, "").replace(",", "."));
  return (
    <form
      className="grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:grid-cols-4"
      data-testid="add-component"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          designation: form.designation,
          name: form.name,
          manufacturer: form.manufacturer || null,
          modelNumber: form.modelNumber || null,
          wearCategory: form.wearCategory,
          cyclesPerHour: toNum(form.cyclesPerHour),
          manualCyclesOffset: toInt(form.offset) ?? 0,
          maxElectricalCycles: toInt(form.maxCycles),
          maxOperatingHours: toInt(form.maxHours),
          maxCalendarMonths: toInt(form.maxMonths),
          replacementStockCount: toInt(form.stock) ?? 0,
        });
      }}
    >
      {bom.length ? (
        <div className="flex flex-col gap-1 sm:col-span-4">
          <Label htmlFor="lifespan-bom">Rychlý výběr z kusovníku</Label>
          <select
            id="lifespan-bom"
            className={select}
            defaultValue=""
            onChange={(event) => {
              const item = bom[Number(event.target.value)];
              if (!item) return;
              const category = guessCategory(item.description);
              set({
                designation: item.designation.startsWith("-")
                  ? item.designation
                  : `-${item.designation}`,
                name: item.description,
                manufacturer: item.manufacturer ?? "",
                modelNumber: item.partNumber ?? "",
                wearCategory: category,
                ...PRESETS[category],
              });
            }}
          >
            <option value="">– vyberte prvek kusovníku –</option>
            {bom.map((item, index) => (
              <option key={`${item.designation}-${index}`} value={index}>
                {item.designation} · {item.description}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Field
        label="Označení"
        id="lc-designation"
        value={form.designation}
        onChange={(value) => set({ designation: value })}
        required
      />
      <div className="sm:col-span-3">
        <Field
          label="Název součástky"
          id="lc-name"
          value={form.name}
          onChange={(value) => set({ name: value })}
          required
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label htmlFor="lc-category">Kategorie opotřebení</Label>
        <select
          id="lc-category"
          className={select}
          value={form.wearCategory}
          onChange={(event) =>
            set({
              wearCategory: event.target.value as WearCategory,
              ...PRESETS[event.target.value as WearCategory],
            })
          }
        >
          {WEAR_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Výrobce"
        id="lc-manufacturer"
        value={form.manufacturer}
        onChange={(value) => set({ manufacturer: value })}
      />
      <Field
        label="Typ"
        id="lc-model"
        value={form.modelNumber}
        onChange={(value) => set({ modelNumber: value })}
      />
      <Field
        label="Sepnutí za hodinu"
        id="lc-cph"
        value={form.cyclesPerHour}
        onChange={(value) => set({ cyclesPerHour: value })}
      />
      <Field
        label="Max. cykly / B10d"
        id="lc-cycles"
        value={form.maxCycles}
        onChange={(value) => set({ maxCycles: value })}
      />
      <Field
        label="Max. motohodiny (40 °C)"
        id="lc-hours"
        value={form.maxHours}
        onChange={(value) => set({ maxHours: value })}
      />
      <Field
        label="Max. měsíců (T_M / filtr)"
        id="lc-months"
        value={form.maxMonths}
        onChange={(value) => set({ maxMonths: value })}
      />
      <Field
        label="Počáteční cykly (čítač PLC)"
        id="lc-offset"
        value={form.offset}
        onChange={(value) => set({ offset: value })}
      />
      <Field
        label="Náhradních kusů skladem"
        id="lc-stock"
        value={form.stock}
        onChange={(value) => set({ stock: value })}
      />
      <div className="flex gap-2 sm:col-span-2 sm:items-end">
        <Button type="submit" disabled={pending}>
          Sledovat součástku
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Zrušit
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10"
      />
    </div>
  );
}
