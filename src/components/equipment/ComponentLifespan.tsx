"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LIFESPAN_STATUS,
  SHIFT_REGIMES,
  WEAR_CATEGORIES,
  assessComponent,
  type WearCategory,
} from "@/lib/component-lifespan";
import { cn } from "@/lib/utils";
import {
  addMonitoredComponentAction,
  deleteMonitoredComponentAction,
  replaceMonitoredComponentAction,
  updateOperatingProfileAction,
} from "@/server/actions/lifespan";

export interface LifespanComponent {
  id: string;
  designation: string;
  name: string;
  manufacturer: string | null;
  modelNumber: string | null;
  wearCategory: WearCategory;
  installedAt: string;
  cyclesPerHour: number | null;
  manualCyclesOffset: number;
  maxElectricalCycles: number | null;
  maxOperatingHours: number | null;
  maxCalendarMonths: number | null;
  replacementStockCount: number;
  notes: string | null;
}

const n = (value: number, digits = 0) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });
const select =
  "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

/**
 * Sekce 1 záložky Diagnostika (fáze 53): ⏳ životnost součástek a prediktivní údržba – směnnost,
 * teplota v rozváděči, karty součástek s vyčerpáním limitů, skladem a datem výměny.
 */
export function ComponentLifespan({
  equipmentId,
  profile,
  components,
  bom,
  now,
  canEdit,
}: {
  equipmentId: string;
  profile: { shiftRegime: number; internalTempC: number | null };
  components: LifespanComponent[];
  bom: {
    designation: string;
    description: string;
    manufacturer: string | null;
    partNumber: string | null;
  }[];
  now: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [temp, setTemp] = useState(
    profile.internalTempC === null
      ? ""
      : String(profile.internalTempC).replace(".", ","),
  );
  const [adding, setAdding] = useState(false);
  const today = new Date(now);
  const rows = components.map((component) => ({
    component,
    assessment: assessComponent(
      { ...component, installedAt: new Date(component.installedAt) },
      profile,
      today,
    ),
  }));

  function call(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      router.refresh();
    });
  }
  const saveProfile = (shiftRegime: number, internalTempC: number | null) =>
    call(
      () =>
        updateOperatingProfileAction({
          equipmentId,
          shiftRegime,
          internalTempC,
        }),
      "Provozní profil uložen – životnost přepočtena.",
    );

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Životnost součástek a prediktivní údržba"
      data-testid="component-lifespan"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">
          ⏳ Životnost součástek a prediktivní údržba (B10d / Motohodiny)
        </h3>
        {pending ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-label="Ukládám"
          />
        ) : null}
      </header>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div
          className="flex flex-wrap gap-1"
          role="radiogroup"
          aria-label="Směnnost stroje"
        >
          {SHIFT_REGIMES.map((regime) => (
            <button
              key={regime.id}
              type="button"
              role="radio"
              aria-checked={profile.shiftRegime === regime.id}
              disabled={!canEdit || pending}
              onClick={() => saveProfile(regime.id, profile.internalTempC)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 font-semibold",
                profile.shiftRegime === regime.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              title={`${n(regime.hoursPerYear)} h/rok`}
            >
              {regime.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          T<sub>rozváděče</sub> [°C]
          <Input
            className="h-9 w-20 font-mono"
            inputMode="decimal"
            value={temp}
            disabled={!canEdit}
            placeholder="35"
            aria-label="Vnitřní teplota rozváděče [°C]"
            onChange={(event) => setTemp(event.target.value)}
            onBlur={() => {
              const value =
                temp.trim() === "" ? null : Number(temp.replace(",", "."));
              if (
                value !== profile.internalTempC &&
                (value === null || Number.isFinite(value))
              )
                saveProfile(profile.shiftRegime, value);
            }}
          />
        </label>
      </div>

      {rows.length ? (
        <ul className="grid gap-2 lg:grid-cols-2" data-testid="lifespan-list">
          {rows.map(({ component, assessment }) => {
            const style = LIFESPAN_STATUS[assessment.status];
            return (
              <li
                key={component.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border p-3"
                data-component={component.designation}
                data-status={assessment.status}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="font-mono">{component.designation}</span>{" "}
                      {component.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[component.manufacturer, component.modelNumber]
                        .filter(Boolean)
                        .join(" ") ||
                        WEAR_CATEGORIES.find(
                          (c) => c.id === component.wearCategory,
                        )?.label}
                    </p>
                  </div>
                  <span
                    className={cn("shrink-0 text-sm font-bold", style.text)}
                    data-testid="lifespan-percent"
                  >
                    {style.emoji} {n(assessment.wearPercent, 1)} %
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(
                    100,
                    Math.round(assessment.wearPercent),
                  )}
                  aria-label={`Vyčerpání životnosti ${component.designation}`}
                >
                  <div
                    className={cn("h-full", style.bar)}
                    style={{
                      width: `${Math.min(100, assessment.wearPercent)}%`,
                    }}
                  />
                </div>
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {assessment.limits.map((limit) => (
                    <li key={limit.kind} className="flex justify-between gap-2">
                      <span>{limit.label}</span>
                      <span className="font-mono">
                        {limit.kind === "calendar"
                          ? `${n(limit.used)} / ${n(limit.max)} dní`
                          : limit.kind === "hours"
                            ? `${n(limit.used)} / ${n(limit.max)} h`
                            : `${n(limit.used)} / ${n(limit.max)}`}{" "}
                        ({n(limit.percent, 1)} %)
                      </span>
                    </li>
                  ))}
                </ul>
                {assessment.thermalDerating ? (
                  <p className="text-xs text-amber-200" data-testid="arrhenius">
                    🌡️ Arrhenius: při {n(assessment.thermalDerating.tempC, 1)}{" "}
                    °C v rozváděči klesla životnost z{" "}
                    {n(assessment.thermalDerating.fromHours)} h na{" "}
                    {n(assessment.thermalDerating.toHours)} h.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span
                    className={
                      component.replacementStockCount > 0
                        ? "text-emerald-300"
                        : "font-semibold text-red-300"
                    }
                    data-testid="lifespan-stock"
                  >
                    {component.replacementStockCount > 0
                      ? `Skladem: ${component.replacementStockCount} ks`
                      : "⚠️ Chybí na skladě!"}
                  </span>
                  <span className={style.text}>
                    {assessment.status === "CRITICAL_EXPIRED"
                      ? "Vyměnit ihned"
                      : assessment.predictedReplacementDate
                        ? `Výměna do ${assessment.predictedReplacementDate.toLocaleDateString("cs-CZ")} (${n(assessment.remainingDays ?? 0)} dní)`
                        : "Bez limitu"}
                  </span>
                </div>
                {component.notes ? (
                  <p className="text-[11px] text-muted-foreground">
                    {component.notes}
                  </p>
                ) : null}
                {canEdit ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Zapsat výměnu ${component.designation} za nový kus? Počítadlo se vynuluje k dnešnímu dni.`,
                          )
                        ) {
                          call(
                            () =>
                              replaceMonitoredComponentAction({
                                equipmentId,
                                componentId: component.id,
                              }),
                            `${component.designation}: výměna zapsána, životnost 0 %.`,
                          );
                        }
                      }}
                    >
                      <RefreshCw className="size-3.5" aria-hidden /> 🔄 Zapsat
                      výměnu kusu za nový (Reset 0 %)
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Přestat sledovat ${component.designation}`}
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Přestat sledovat ${component.designation}?`,
                          )
                        )
                          call(
                            () =>
                              deleteMonitoredComponentAction({
                                equipmentId,
                                componentId: component.id,
                              }),
                            "Součástka odebrána.",
                          );
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Zatím se nesleduje žádná součástka. Přidejte stykače, zdroje, měniče,
          bezpečnostní relé nebo filtry z kusovníku.
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
                const result = await addMonitoredComponentAction({
                  equipmentId,
                  ...data,
                });
                if (result.ok) setAdding(false);
                return result;
              }, `${data.designation} se sleduje.`)
            }
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 self-start"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" aria-hidden /> Přidat sledovanou součástku
          </Button>
        )
      ) : null}
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
};

/** Odhad kategorie z popisu prvku kusovníku. */
function guessCategory(description: string): WearCategory {
  if (/safety|bezpečnost|pnoz|nouzov/i.test(description))
    return "SAFETY_ELEMENT";
  if (/zdroj|měnič|menic|psu|sinamics|frekven|kondenz/i.test(description))
    return "POWER_ELECTRONICS";
  if (/ventil[aá]tor|filtr|baterie|fan/i.test(description))
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
