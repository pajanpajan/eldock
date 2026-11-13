"use client";

import { useRef, useState, useTransition, type ClipboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, Expand, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ID_LABEL_SIZES, type IdLabelData } from "@/lib/equipment-id-label";
import { PROTECTION_CLASS_LABELS, type NameplateReading } from "@/lib/nameplate";
import { resizeImage } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { applyNameplateAction } from "@/server/actions/equipment-card";

import { EquipmentIdLabel } from "./EquipmentIdLabel";

type Form = {
  title: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  voltage: string;
  powerW: string;
  currentA: string;
  ipRating: string;
  protectionClass: string;
  usageGroup: string;
  year: string;
  handHeld: boolean;
};

const toForm = (reading: NameplateReading | null, current: { title: string; manufacturer: string | null; model: string | null; serialNumber: string | null; ratedVoltage: string | null; ipRating: string | null; protectionClass: string | null; usageGroup: string | null; handHeld: boolean }): Form => ({
  title: reading?.name ?? current.title,
  manufacturer: reading?.manufacturer ?? current.manufacturer ?? "",
  model: reading?.model ?? current.model ?? "",
  serialNumber: reading?.serialNumber ?? current.serialNumber ?? "",
  voltage: reading?.voltage ?? current.ratedVoltage ?? "",
  powerW: reading?.powerW ? String(reading.powerW) : "",
  currentA: reading?.currentA ? String(reading.currentA).replace(".", ",") : "",
  ipRating: reading?.ipRating ?? current.ipRating ?? "",
  protectionClass: reading?.protectionClass ?? current.protectionClass ?? "",
  usageGroup: reading?.usageGroup ?? current.usageGroup ?? "",
  year: reading?.year ? String(reading.year) : "",
  handHeld: current.handHeld,
});

const num = (value: string) => {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Fáze 111: „🏷️ Fotka výrobního štítku + AI čtení údajů“ – druhý fotografický slot zařízení. Tlačítko
 * „[ 📷 Vyfotit / Nahrát výrobní štítek (AI přečte údaje) ]“ (fotoaparát mobilu, soubor i Ctrl+V): fotka se trvale
 * uloží ke kartě, AI přečte název, výrobce, model, S/N, napětí, příkon / proud, krytí a třídu ochrany; údaje se
 * potvrdí do karty (lhůta revize podle třídy a skupiny) a pod fotkou je přehledný identifikační štítek k tisku.
 */
export function NameplateCard({
  equipmentId,
  tag,
  photoUrl,
  readAt,
  reading,
  current,
  label,
  canEdit,
  onSaved,
}: {
  equipmentId: string;
  tag: string;
  photoUrl: string | null;
  readAt: string | null;
  reading: NameplateReading | null;
  current: { title: string; manufacturer: string | null; model: string | null; serialNumber: string | null; ratedVoltage: string | null; ipRating: string | null; protectionClass: string | null; usageGroup: string | null; handHeld: boolean };
  label: IdLabelData;
  canEdit: boolean;
  /** Fáze 111: dialog detailu zařízení – po uložení fotky / údajů znovu načíst data. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [saving, startSaving] = useTransition();
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [zoom, setZoom] = useState(false);

  async function read(file: File | undefined | null) {
    if (!file) return;
    setBusy(true);
    try {
      const resized = await resizeImage(file, 2000);
      const body = new FormData();
      body.set("file", resized, resized.name || "vyrobni-stitek.jpg");
      body.set("equipmentId", equipmentId);
      if (text.trim()) body.set("text", text.trim());
      const response = await fetch("/api/ocr-nameplate", { method: "POST", body });
      const data = (await response.json()) as { error?: string; photoUrl?: string; mode?: string; reading?: NameplateReading; warning?: string | null };
      if (!response.ok || !data.reading) throw new Error(data.error ?? "Výrobní štítek se nepodařilo zpracovat.");
      setPreview(data.photoUrl ?? null);
      setMode(data.mode ?? null);
      setForm(toForm(data.reading, current));
      if (data.warning) toast.warning(data.warning, { duration: 8000 });
      else toast.success(`Fotka štítku uložena – ${data.mode === "GEMINI" ? "AI přečetla údaje" : "údaje z textu štítku"}, zkontrolujte a potvrďte.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Výrobní štítek se nepodařilo zpracovat.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function paste(event: ClipboardEvent) {
    if (!canEdit || busy) return;
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    void read(file);
  }

  function save() {
    if (!form) return;
    startSaving(async () => {
      const result = await applyNameplateAction({
        equipmentId,
        title: form.title.trim() && form.title.trim() !== current.title ? form.title.trim() : null,
        manufacturer: form.manufacturer,
        model: form.model,
        serialNumber: form.serialNumber,
        voltage: form.voltage,
        powerW: num(form.powerW),
        currentA: num(form.currentA),
        ipRating: form.ipRating,
        protectionClass: (form.protectionClass || null) as "I" | "II" | "III" | null,
        usageGroup: (form.usageGroup || null) as "A" | "B" | "C" | "D" | "E" | null,
        year: num(form.year) ? Math.round(num(form.year)!) : null,
        handHeld: form.handHeld,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Údaje ze štítku uloženy do ${tag} · lhůta revize ${result.data.inspectionIntervalMonths} měsíců · štítek ${result.data.labelSerial}.`);
      setForm(null);
      router.refresh();
      onSaved?.();
    });
  }

  const field = (key: Exclude<keyof Form, "handHeld" | "protectionClass" | "usageGroup">, title: string, props: { mono?: boolean; inputMode?: "decimal" | "numeric" } = {}) => (
    <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {title}
      <input
        value={form?.[key] ?? ""}
        onChange={(event) => setForm((currentForm) => (currentForm ? { ...currentForm, [key]: event.target.value } : currentForm))}
        inputMode={props.inputMode}
        className={cn("h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground", props.mono && "font-mono")}
        data-testid={`nameplate-field-${key}`}
      />
    </label>
  );

  return (
    <section aria-label="Výrobní štítek zařízení" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3" onPaste={paste} data-testid="nameplate-card">
      <h3 className="text-sm font-semibold">🏷️ Fotka výrobního štítku + AI čtení údajů</h3>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-zinc-900">
        {preview ? (
          <button type="button" onClick={() => setZoom(true)} className="group absolute inset-0" aria-label={`Fotka výrobního štítku ${tag} v plném rozlišení`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files */}
            <img src={preview} alt={`Výrobní štítek ${tag}`} className="size-full object-contain" data-testid="nameplate-photo" />
            <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-zinc-950/80 px-2 py-1 text-xs text-zinc-100">
              <Expand className="size-3.5" aria-hidden /> Plné rozlišení
            </span>
          </button>
        ) : (
          <div className="bg-blueprint absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">Fotka výrobního štítku zatím chybí – vyfoťte ho, AI přečte údaje.</div>
        )}
      </div>
      {readAt ? <p className="text-xs text-muted-foreground">Štítek vyfocen {new Date(readAt).toLocaleString("cs-CZ")}{reading?.serialNumber ? ` · S/N ${reading.serialNumber}` : ""}</p> : null}
      {canEdit ? (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => void read(event.target.files?.[0])} data-testid="nameplate-input" />
          <Button type="button" className="touch-target h-auto min-h-11 gap-2 whitespace-normal" disabled={busy} onClick={() => input.current?.click()} data-testid="nameplate-capture">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />} [ 📷 Vyfotit / Nahrát výrobní štítek (AI přečte údaje) ]
          </Button>
          <p className="text-xs text-muted-foreground">Fotoaparát mobilu, soubor nebo vložení obrázku přes Ctrl+V.</p>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Text ze štítku (nepovinné – zkopírovaný z mobilu nebo přepsaný)</summary>
            <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 4000))} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs" placeholder="např. Model: U2723QE · S/N: CN-0892K1-74210 · 100–240 V~ 1,5 A · Class I" data-testid="nameplate-text" />
          </details>
        </>
      ) : null}

      {form ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3" data-testid="nameplate-form">
          <p className="text-xs font-semibold">{mode === "GEMINI" ? "✨ AI přečetla ze štítku – zkontrolujte a potvrďte:" : "Údaje ze štítku – zkontrolujte a doplňte:"}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {field("title", "Název a typ zařízení")}
            {field("manufacturer", "Výrobce (Brand)")}
            {field("model", "Model / typové označení", { mono: true })}
            {field("serialNumber", "Výrobní číslo (S/N)", { mono: true })}
            {field("voltage", "Napětí")}
            {field("powerW", "Příkon [W]", { inputMode: "decimal" })}
            {field("currentA", "Proud [A]", { inputMode: "decimal" })}
            {field("ipRating", "Krytí (IP)", { mono: true })}
            <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              Třída ochrany dle ČSN 33 1600 ed. 2
              <select value={form.protectionClass} onChange={(event) => setForm({ ...form, protectionClass: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" data-testid="nameplate-field-protectionClass">
                <option value="">–</option>
                {(Object.keys(PROTECTION_CLASS_LABELS) as (keyof typeof PROTECTION_CLASS_LABELS)[]).map((key) => (
                  <option key={key} value={key}>
                    {PROTECTION_CLASS_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              Skupina používání (lhůta revize)
              <select value={form.usageGroup} onChange={(event) => setForm({ ...form, usageGroup: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" data-testid="nameplate-field-usageGroup">
                <option value="">–</option>
                {["A", "B", "C", "D", "E"].map((group) => (
                  <option key={group} value={group}>
                    Skupina {group}
                  </option>
                ))}
              </select>
            </label>
            {field("year", "Rok výroby", { inputMode: "numeric" })}
            <label className="flex items-center gap-2 self-end pb-2 text-xs">
              <input type="checkbox" checked={form.handHeld} onChange={(event) => setForm({ ...form, handHeld: event.target.checked })} /> Držený v ruce při používání
            </label>
          </div>
          <Button type="button" className="gap-2 self-start" onClick={save} disabled={saving} data-testid="nameplate-save">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Uložit údaje do karty zařízení
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2" aria-label="Identifikační štítek zařízení">
        <p className="text-xs font-semibold">Přehledný štítek zařízení (Zebra ZD421t)</p>
        <EquipmentIdLabel label={label} size="50x25" className="w-full max-w-[22rem]" />
        <div className="flex flex-wrap gap-2">
          {ID_LABEL_SIZES.map((size) => (
            <Button key={size.id} asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={`/equipment/${equipmentId}/stitek?rozmer=${size.id}`} target="_blank" data-testid={`id-label-print-${size.id}`}>
                <Printer className="size-3.5" aria-hidden /> Tisk {size.title}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Výrobní štítek {tag}</DialogTitle>
            <DialogDescription>Fotka v plném rozlišení pro revizního technika a inspektora.</DialogDescription>
          </DialogHeader>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- soubory z /api/files
            <img src={preview} alt={`Výrobní štítek ${tag}`} className="max-h-[75dvh] w-full rounded-lg object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
