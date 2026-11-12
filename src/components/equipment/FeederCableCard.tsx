"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CABLE_INSTALL_METHODS,
  CABLE_STATUS,
  CROSS_SECTIONS,
  cableLabel,
  kwToAmps,
  simulateAddedLoad,
  type CableCheck,
  type CableInstallMethod,
  type FeederCable,
  type PowerCableNode,
} from "@/lib/cable-sizing";
import { cn } from "@/lib/utils";
import { updateFeederCableAction } from "@/server/actions/lifespan";

const n = (value: number, digits = 1) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });
const select =
  "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

/**
 * Sekce 2 záložky Diagnostika (fáze 53): 🔌 dimenzování a zatížení přívodního kabelu (ČSN 33 2000-5-52
 * ed. 2) – Itab → Iz → In → IB, ΔU, úprava pasportu a simulátor připojení dalšího stroje.
 */
export function FeederCableCard({
  equipmentId,
  tag,
  parentTag,
  cable,
  check,
  nominalCurrentA,
  measuredCurrentA,
  nodes,
  canEdit,
}: {
  equipmentId: string;
  tag: string;
  parentTag: string | null;
  cable: FeederCable | null;
  check: CableCheck | null;
  nominalCurrentA: number | null;
  measuredCurrentA: number | null;
  nodes: PowerCableNode[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Dimenzování a zatížení přívodního kabelu"
      data-testid="feeder-cable"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">
          🔌 Dimenzování a zatížení přívodního kabelu (ČSN 33 2000-5-52)
        </h3>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil className="size-3.5" aria-hidden /> ✏️ Upravit parametry
            kabelu a měření klešťákem
          </Button>
        ) : null}
      </header>

      {cable && check ? (
        <>
          <p className="text-sm" data-testid="feeder-summary">
            <b>
              {parentTag ?? "?"} ➔ {tag}
            </b>{" "}
            · Kabel {cableLabel(cable)}
            {cable.lengthM ? ` · délka ${n(cable.lengthM, 0)} m` : ""} · uložení{" "}
            {cable.method}
            {cable.groupingCount > 1
              ? ` (${cable.groupingCount} kabelů v souběhu)`
              : ""}{" "}
            · okolí {n(cable.ambientTempC, 0)} °C
          </p>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
            data-testid="cable-chain"
          >
            <Metric
              label="Tabulková Itab"
              value={`${n(check.itabA)} A`}
              hint={
                cable.parallelRuns > 1
                  ? `× ${cable.parallelRuns} paralelně`
                  : undefined
              }
            />
            <Metric
              label="Skutečná Iz"
              value={`${n(check.izA)} A`}
              hint={`k₁ ${n(check.kTemp, 2)} × k₂ ${n(check.kGroup, 2)}`}
              testId="cable-iz"
            />
            <Metric
              label="Předřazený jistič In"
              value={
                cable.upstreamBreakerA
                  ? `${n(cable.upstreamBreakerA, 0)} A`
                  : "–"
              }
              danger={!check.protectedOk}
            />
            <Metric
              label="Zatížení IB"
              value={`${n(check.designCurrentA)} A`}
              hint={
                measuredCurrentA !== null
                  ? "naměřeno klešťákem"
                  : nominalCurrentA !== null
                    ? "jmenovitý odběr"
                    : "součet odběrů × 0,8"
              }
            />
            <Metric
              label="Úbytek ΔU"
              value={
                check.voltageDropPct === null
                  ? "–"
                  : `${n(check.voltageDropPct, 2)} %`
              }
              danger={(check.voltageDropPct ?? 0) > 5}
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span
                className={cn("font-bold", CABLE_STATUS[check.status].text)}
                data-testid="cable-load"
              >
                {CABLE_STATUS[check.status].emoji} Vytížení{" "}
                {n(check.loadPercent)} % Iz
              </span>
              <span className="text-muted-foreground">
                rezerva {n(Math.max(0, check.izA - check.designCurrentA))} A
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full", CABLE_STATUS[check.status].bar)}
                style={{ width: `${Math.min(100, check.loadPercent)}%` }}
              />
            </div>
          </div>
          {check.messages.map((message) => (
            <p
              key={message}
              className={cn(
                "rounded-md border p-2 text-sm font-semibold",
                message.startsWith("🔴")
                  ? "border-red-500/60 bg-red-500/10 text-red-200"
                  : "border-amber-400/60 bg-amber-400/10 text-amber-100",
              )}
              data-testid="cable-message"
            >
              {message}
            </p>
          ))}
          {check.status === "CRITICAL" && check.recommendedMm2 ? (
            <p className="text-sm text-muted-foreground">
              Doporučený průřez pro stávající uložení:{" "}
              <b className="text-foreground">{n(check.recommendedMm2)} mm²</b>.
            </p>
          ) : null}
        </>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Přívodní kabel zatím nemá vyplněný pasport (typ, průřez, délka,
          uložení). Doplňte ho tlačítkem Upravit.
        </p>
      )}

      {editing ? (
        <CableForm
          equipmentId={equipmentId}
          cable={cable}
          nominalCurrentA={nominalCurrentA}
          measuredCurrentA={measuredCurrentA}
          onDone={() => setEditing(false)}
        />
      ) : null}

      <LoadSimulator equipmentId={equipmentId} nodes={nodes} />
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  danger,
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border p-2",
        danger ? "border-red-500/60 bg-red-500/10" : "border-border",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-mono text-lg font-bold tabular-nums",
            danger && "text-red-300",
          )}
          data-testid={testId}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <ArrowRight
        className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
        aria-hidden
      />
    </div>
  );
}

/**
 * 🧪 Simulátor: přírůstek proudu nového stroje kaskádou přívod → hlavní rozváděč → transformátor (fáze 98: i v agendě
 * „4. Kniha revizí, Legislativa & Simulátor“ závodu nad zvoleným rozváděčem).
 */
export function LoadSimulator({
  equipmentId,
  nodes,
}: {
  equipmentId: string;
  nodes: PowerCableNode[];
}) {
  const [unit, setUnit] = useState<"kW" | "A">("kW");
  const [value, setValue] = useState(30);
  const amps = unit === "kW" ? kwToAmps(value) : value;
  const rows = useMemo(
    () => simulateAddedLoad(nodes, equipmentId, amps),
    [nodes, equipmentId, amps],
  );
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-sky-400/40 bg-sky-400/5 p-3"
      data-testid="load-simulator"
    >
      <h4 className="font-semibold">
        🧪 Simulátor: Co když sem připojím další stroj?
      </h4>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="range"
          min={0}
          max={unit === "kW" ? 200 : 360}
          step={1}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-label="Příkon nového stroje"
          className="w-48 accent-sky-400"
        />
        <Input
          className="h-9 w-24 font-mono"
          inputMode="decimal"
          value={String(value)}
          onChange={(event) =>
            setValue(
              Math.max(0, Number(event.target.value.replace(",", ".")) || 0),
            )
          }
          aria-label={`Nový stroj [${unit}]`}
        />
        <select
          className={select}
          value={unit}
          onChange={(event) => setUnit(event.target.value as "kW" | "A")}
          aria-label="Jednotka"
        >
          <option value="kW">kW</option>
          <option value="A">A</option>
        </select>
        <span className="text-muted-foreground" data-testid="simulator-amps">
          = +{n(amps)} A (3f 400 V, cos φ 0,9)
        </span>
      </div>
      {rows.length ? (
        <ul className="flex flex-col gap-1" data-testid="simulator-rows">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
              data-sim={row.tag}
              data-status={row.status}
            >
              <span>{row.label}</span>
              <span
                className={cn(
                  "font-mono font-bold",
                  CABLE_STATUS[row.status].text,
                )}
              >
                {n(row.beforePercent)} % ➔ {CABLE_STATUS[row.status].emoji}{" "}
                {n(row.afterPercent)} %
                {row.recommendedMm2
                  ? ` · potřeba ${n(row.recommendedMm2)} mm²`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          V trase nahoru není žádný kabel s vyplněným pasportem.
        </p>
      )}
    </div>
  );
}

function CableForm({
  equipmentId,
  cable,
  nominalCurrentA,
  measuredCurrentA,
  onDone,
}: {
  equipmentId: string;
  cable: FeederCable | null;
  nominalCurrentA: number | null;
  measuredCurrentA: number | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const text = (value: number | null | undefined) =>
    value === null || value === undefined
      ? ""
      : String(value).replace(".", ",");
  const [form, setForm] = useState({
    cableType: cable?.cableType ?? "CYKY-J",
    material: cable?.material ?? "CU",
    crossSection: text(cable?.crossSectionMm2 ?? 16),
    runs: text(cable?.parallelRuns ?? 1),
    length: text(cable?.lengthM),
    method: (cable?.method ?? "E") as CableInstallMethod,
    grouping: text(cable?.groupingCount ?? 1),
    ambient: text(cable?.ambientTempC ?? 30),
    breaker: text(cable?.upstreamBreakerA),
    nominal: text(nominalCurrentA),
    measured: text(measuredCurrentA),
  });
  const set = (patch: Partial<typeof form>) =>
    setForm((current) => ({ ...current, ...patch }));
  const num = (value: string) =>
    value.trim() === "" ? null : Number(value.replace(",", "."));
  return (
    <form
      className="grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:grid-cols-4"
      data-testid="cable-form"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateFeederCableAction({
            equipmentId,
            cableType: form.cableType || null,
            material: form.material,
            crossSectionMm2: num(form.crossSection),
            parallelRuns: num(form.runs) ?? 1,
            lengthM: num(form.length),
            method: form.method,
            groupingCount: num(form.grouping) ?? 1,
            ambientTempC: num(form.ambient) ?? 30,
            upstreamBreakerA: num(form.breaker),
            nominalCurrentA: num(form.nominal),
            measuredCurrentA: num(form.measured),
          });
          if (!result.ok) return void toast.error(result.error);
          toast.success("Kabelový pasport uložen.");
          onDone();
          router.refresh();
        });
      }}
    >
      <Field
        label="Typ kabelu"
        id="cf-type"
        value={form.cableType}
        onChange={(value) => set({ cableType: value })}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor="cf-material">Materiál</Label>
        <select
          id="cf-material"
          className={select}
          value={form.material}
          onChange={(event) =>
            set({ material: event.target.value as "CU" | "AL" })
          }
        >
          <option value="CU">Cu – měď</option>
          <option value="AL">Al – hliník</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cf-section">Průřez fáze [mm²]</Label>
        <select
          id="cf-section"
          className={select}
          value={form.crossSection}
          onChange={(event) => set({ crossSection: event.target.value })}
        >
          {CROSS_SECTIONS.map((size) => (
            <option key={size} value={String(size).replace(".", ",")}>
              {String(size).replace(".", ",")}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Paralelních kabelů"
        id="cf-runs"
        value={form.runs}
        onChange={(value) => set({ runs: value })}
      />
      <Field
        label="Délka trasy [m]"
        id="cf-length"
        value={form.length}
        onChange={(value) => set({ length: value })}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor="cf-method">Uložení</Label>
        <select
          id="cf-method"
          className={select}
          value={form.method}
          onChange={(event) =>
            set({ method: event.target.value as CableInstallMethod })
          }
        >
          {CABLE_INSTALL_METHODS.map((method) => (
            <option key={method.id} value={method.id}>
              {method.label}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Kabelů v souběhu"
        id="cf-grouping"
        value={form.grouping}
        onChange={(value) => set({ grouping: value })}
      />
      <Field
        label="Teplota okolí [°C]"
        id="cf-ambient"
        value={form.ambient}
        onChange={(value) => set({ ambient: value })}
      />
      <Field
        label="Předřazený jistič In [A]"
        id="cf-breaker"
        value={form.breaker}
        onChange={(value) => set({ breaker: value })}
      />
      <Field
        label="Jmenovitý odběr Ib [A]"
        id="cf-nominal"
        value={form.nominal}
        onChange={(value) => set({ nominal: value })}
      />
      <Field
        label="Naměřeno klešťákem [A]"
        id="cf-measured"
        value={form.measured}
        onChange={(value) => set({ measured: value })}
      />
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending} className="gap-1.5">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}{" "}
          Uložit kabel
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
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
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10"
      />
    </div>
  );
}
