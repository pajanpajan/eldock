"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BadgeCheck, FileSignature, Loader2, Plus, ShieldCheck, Sparkles, Trash2, UserRoundPen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InspectionResult } from "@/generated/prisma/enums";
import { formatCount } from "@/lib/format";
import { INSPECTOR_SCOPES } from "@/lib/inspector-certificate";
import {
  EMPTY_MEASUREMENTS,
  INTERVAL_YEARS,
  NO_DEFECTS_TEXT,
  RCD_TYPES,
  SIGNABLE_TYPES,
  SIGNABLE_TYPE_LABELS,
  STANDARD_MEASUREMENTS,
  VERDICT_TEXT,
  isStandardTemplate,
  shortCircuitFromLoop,
  type InspectorProfileView,
  type SignableType,
  type SignedMeasurements,
} from "@/lib/revision-signature";
import { INSPECTION_RESULT } from "@/lib/status";
import { cn } from "@/lib/utils";
import { profilesForEquipmentAction, recordSignedRevisionAction, saveInspectorProfileAction } from "@/server/actions/revision-signing";

import { InspectorStamp } from "./InspectorStamp";
import { SignaturePad } from "./SignaturePad";

// Fáze 108: „Doplnit data k revizi“ – formulář revizního technika s předvyplněným profilem (TIČR, firma z ARES,
// kontakty, přístroj a kalibrace), druhem a lhůtou revize, šablonou měření na 1 klik, závadami a podpisem
// (plátno nebo uložený podpis, razítko TIČR, osobní PIN, pečeť SHA-256). Z karty zařízení, hromadné revize,
// Chytré revize (sloučený výjezd) i po naskenování QR štítku.

export interface RevisionEquipment {
  id: string;
  tag: string;
  name: string;
}

const RESULTS: InspectionResult[] = ["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"];
const ITEMS = ["zařízení", "zařízení", "zařízení"] as const;
const STORAGE_KEY = (plantId: string) => `eldock-inspector-profile:${plantId}`;

interface DefectRow {
  text: string;
  provision: string;
  deadline: string;
}

interface SignedResult {
  reportNumber: string;
  sealHash: string;
  reportUrl: string;
  count: number;
  recordIds: string[];
}

const numberOrNull = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
};
const text = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

/** Závady do textu zprávy: „popis – odstranit do 2026-12-13 [ustanovení]“ (ustanovení na konci – § 10 písm. k). */
export function defectsText(rows: readonly DefectRow[]): string {
  return rows
    .filter((row) => row.text.trim().length >= 3)
    .map((row) => `${row.text.trim().replace(/\.\s+/g, ", ")}${row.deadline ? ` – odstranit do ${row.deadline}` : ""}${row.provision.trim() ? ` [${row.provision.trim()}]` : ""}`)
    .join("\n");
}

export function RevisionTechnicianFormModal({
  open,
  onOpenChange,
  equipment,
  today,
  title,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: readonly RevisionEquipment[];
  today: string;
  title?: string;
  onSigned?: (result: SignedResult) => void;
}) {
  const router = useRouter();
  const [plant, setPlant] = useState<{ plantId: string; plantName: string } | null>(null);
  const [profiles, setProfiles] = useState<InspectorProfileView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>("");
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);
  const [type, setType] = useState<SignableType>("PERIODIC");
  const [intervalYears, setIntervalYears] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [reportNumber, setReportNumber] = useState("");
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<SignedMeasurements>(EMPTY_MEASUREMENTS);
  const [result, setResult] = useState<InspectionResult>("CAPABLE");
  const [defects, setDefects] = useState<DefectRow[]>([{ text: "", provision: "", deadline: "" }]);
  const [signature, setSignature] = useState<string | null>(null);
  const [useSaved, setUseSaved] = useState(true);
  const [remember, setRemember] = useState(true);
  const [pin, setPin] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SignedResult | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = useMemo(() => equipment.map((item) => item.id), [equipment]);

  useEffect(() => {
    // Dialog se pokaždé připojuje znovu (podmíněné vykreslení u volajícího) – stav formuláře je čerstvý
    if (!open) return;
    let alive = true;
    void profilesForEquipmentAction(ids).then((response) => {
      if (!alive) return;
      if (!response.ok) return setLoadError(response.error);
      setPlant({ plantId: response.data.plantId, plantName: response.data.plantName });
      setProfiles(response.data.profiles);
      let remembered = "";
      try {
        remembered = window.localStorage.getItem(STORAGE_KEY(response.data.plantId)) ?? "";
      } catch {
        // prohlížeč bez úložiště – vybere se první profil
      }
      const pick = response.data.profiles.find((profile) => profile.id === remembered) ?? response.data.profiles[0];
      setProfileId(pick?.id ?? "");
      setEditing(response.data.profiles.length ? null : "new");
    });
    return () => {
      alive = false;
    };
  }, [open, ids]);

  const profile = profiles?.find((entry) => entry.id === profileId) ?? null;
  const savedSignature = Boolean(profile?.signatureUrl) && useSaved;
  const template = isStandardTemplate(values);
  const defectsSummary = result === "CAPABLE" ? NO_DEFECTS_TEXT : defectsText(defects);
  const canSign = Boolean(profile) && !profile?.locked && /^\d{4,8}$/.test(pin) && confirmed && (savedSignature || Boolean(signature)) && Boolean(date) && date <= today && (result === "CAPABLE" || defectsSummary.length >= 3) && (type !== "EXTRAORDINARY" || reason.trim().length >= 3);

  function set<K extends keyof SignedMeasurements>(key: K, value: SignedMeasurements[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "loopImpedance") next.shortCircuitA = shortCircuitFromLoop(value as number | null);
      return next;
    });
  }

  function choose(id: string) {
    setProfileId(id);
    setPin("");
    try {
      if (plant) window.localStorage.setItem(STORAGE_KEY(plant.plantId), id);
    } catch {
      // bez úložiště
    }
  }

  function submit() {
    if (!profile || !canSign) return;
    setError(null);
    startTransition(async () => {
      const response = await recordSignedRevisionAction({
        equipmentIds: ids,
        inspectorProfileId: profile.id,
        pin,
        type,
        intervalYears,
        inspectionDate: date,
        reportNumber: reportNumber.trim() || null,
        extraordinaryReason: type === "EXTRAORDINARY" ? reason : null,
        measurements: values,
        result,
        defectsSummary,
        signaturePng: savedSignature ? null : signature,
        rememberSignature: !savedSignature && remember,
        confirmMeasured: confirmed,
      });
      if (!response.ok) {
        setError(response.error);
        if (/PIN/.test(response.error)) setPin("");
        return;
      }
      setDone(response.data);
      setPin("");
      toast.success(`Revize podepsána a uzamčena: ${formatCount(response.data.count, ITEMS)}.`, { description: `Protokol ${response.data.reportNumber} · SHA-256 ${response.data.sealHash.slice(0, 12)}…` });
      onSigned?.(response.data);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl" data-testid="revision-technician-form">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="size-5 text-primary" aria-hidden />
            {title ?? "Doplnit data k revizi"} – {equipment.length === 1 ? equipment[0].tag : formatCount(equipment.length, ITEMS)}
          </DialogTitle>
          <DialogDescription>
            {plant ? `${plant.plantName} · ` : ""}
            {equipment
              .slice(0, 6)
              .map((item) => item.tag)
              .join(", ")}
            {equipment.length > 6 ? ` a dalších ${equipment.length - 6}` : ""} · jeden protokol, podpis technika a pečeť SHA-256.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <SignedSummary done={done} onClose={() => onOpenChange(false)} />
        ) : loadError ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
            {loadError}
          </p>
        ) : !profiles || !plant ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám profily revizních techniků závodu…
          </p>
        ) : (
          <div className="space-y-6">
            {/* 1. Profil revizního technika */}
            <section className="space-y-3" aria-labelledby="rt-profile-heading">
              <h3 id="rt-profile-heading" className="text-sm font-semibold">
                1 · Revizní technik
              </h3>
              {editing ? (
                <ProfileForm
                  plantId={plant.plantId}
                  profile={editing === "edit" ? profile : null}
                  onCancel={profiles.length ? () => setEditing(null) : null}
                  onSaved={(saved) => {
                    setProfiles((current) => [...(current ?? []).filter((entry) => entry.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, "cs")));
                    choose(saved.id);
                    setEditing(null);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={profileId}
                      onChange={(event) => choose(event.target.value)}
                      className="h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                      aria-label="Uložený profil revizního technika"
                      data-testid="rt-profile-select"
                    >
                      {profiles.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} · TIČR {entry.certificateNo}
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" className="touch-target gap-1.5" onClick={() => setEditing("edit")} disabled={!profile}>
                      <UserRoundPen className="size-4" aria-hidden /> Upravit
                    </Button>
                    <Button type="button" variant="outline" className="touch-target gap-1.5" onClick={() => setEditing("new")} data-testid="rt-profile-new">
                      <Plus className="size-4" aria-hidden /> Nový profil
                    </Button>
                  </div>
                  {profile ? (
                    <dl className="grid gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2" data-testid="rt-profile-card">
                      <Row label="Osvědčení TIČR" value={`${profile.certificateNo}${profile.certificateScope ? ` · ${profile.certificateScope}` : ""}${profile.certificateValidUntil ? ` · platí do ${profile.certificateValidUntil}` : ""}`} />
                      <Row label="Oprávnění TIČR" value={profile.authorizationNo} />
                      <Row label="Firma / IČO" value={[profile.company, profile.ico].filter(Boolean).join(" · ") || null} />
                      <Row label="Kontakt" value={[profile.phone, profile.email].filter(Boolean).join(" · ") || null} />
                      <Row label="Měřicí přístroj" value={[profile.instrument, profile.calibrationNo ? `KL ${profile.calibrationNo}` : null, profile.calibrationValidUntil ? `do ${profile.calibrationValidUntil}` : null].filter(Boolean).join(" · ") || null} />
                    </dl>
                  ) : null}
                  {profile?.locked ? <p className="text-sm text-red-300">Podpis je po chybných PINech dočasně zablokovaný – zkuste to za 15 minut.</p> : null}
                </div>
              )}
            </section>

            {/* 2. Druh revize a lhůta */}
            <section className="space-y-3" aria-labelledby="rt-kind-heading">
              <h3 id="rt-kind-heading" className="text-sm font-semibold">
                2 · Druh revize a lhůta příští revize
              </h3>
              <div role="radiogroup" aria-label="Druh revize" className="grid gap-2 sm:grid-cols-3">
                {SIGNABLE_TYPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={type === value}
                    onClick={() => setType(value)}
                    className={cn("touch-target rounded-lg border px-3 py-2 text-left text-sm font-medium", type === value ? "border-primary bg-primary/15 text-primary" : "border-border bg-card hover:bg-muted/50")}
                    data-testid={`rt-type-${value}`}
                  >
                    {SIGNABLE_TYPE_LABELS[value]}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rt-interval">Lhůta příští revize (ČSN 33 1500)</Label>
                  <select
                    id="rt-interval"
                    value={intervalYears ?? ""}
                    onChange={(event) => setIntervalYears(event.target.value ? Number(event.target.value) : null)}
                    className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    data-testid="rt-interval"
                  >
                    <option value="">Podle lhůty zařízení</option>
                    {INTERVAL_YEARS.map((years) => (
                      <option key={years} value={years}>
                        {formatCount(years, ["rok", "roky", "let"])}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-date">Datum revize</Label>
                  <Input id="rt-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-number">Číslo zprávy</Label>
                  <Input id="rt-number" value={reportNumber} onChange={(event) => setReportNumber(event.target.value)} placeholder="vygeneruje se (RT-…)" maxLength={60} className="h-11 font-mono" />
                </div>
              </div>
              {type === "EXTRAORDINARY" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="rt-reason">Důvod mimořádné revize</Label>
                  <Input id="rt-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="např. po výměně hlavního jističe" maxLength={500} className="h-11" />
                </div>
              ) : null}
            </section>

            {/* 3. Naměřené hodnoty */}
            <section className="space-y-3" aria-labelledby="rt-measure-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="rt-measure-heading" className="text-sm font-semibold">
                  3 · Naměřené hodnoty
                </h3>
                <Button type="button" variant="outline" className="touch-target gap-1.5 border-primary/60" onClick={() => setValues(STANDARD_MEASUREMENTS)} data-testid="rt-prefill">
                  <Sparkles className="size-4 text-primary" aria-hidden /> ✨ Předvyplnit standardní vyhovující hodnoty měření
                </Button>
              </div>
              {template ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" data-testid="rt-template-warning">
                  ⚠️ Hodnoty jsou zatím beze změny ze šablony – přepište je čísly z měřicího přístroje. Šablona není měření.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="rt-riso" label="Izolační odpor R_iso [MΩ]" value={text(values.insulationResistance)} onChange={(value) => set("insulationResistance", numberOrNull(value))} />
                <div className="space-y-1.5">
                  <Label htmlFor="rt-riso-voltage">Zkušební napětí</Label>
                  <select id="rt-riso-voltage" value={values.insulationTestVoltage ?? ""} onChange={(event) => set("insulationTestVoltage", event.target.value ? Number(event.target.value) : null)} className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    {[250, 500, 1000].map((volts) => (
                      <option key={volts} value={volts}>
                        {volts} V DC
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 self-end pb-3 text-sm">
                  <input type="checkbox" checked={values.insulationAbove} onChange={(event) => set("insulationAbove", event.target.checked)} className="size-4 accent-primary" />
                  nad rozsahem přístroje („&gt;“)
                </label>
                <Field id="rt-rpe" label="Spojitost PE a pospojování [Ω]" value={text(values.protectiveConductorResistance)} onChange={(value) => set("protectiveConductorResistance", numberOrNull(value))} />
                <Field id="rt-zs" label="Impedance smyčky Z_s [Ω]" value={text(values.loopImpedance)} onChange={(value) => set("loopImpedance", numberOrNull(value))} />
                <Field id="rt-ik" label="Zkratový proud I_k [A]" value={text(values.shortCircuitA)} onChange={(value) => set("shortCircuitA", numberOrNull(value))} hint="I_k = 230 V / Z_s" />
                <Field id="rt-rcd-ma" label="RCD I_Δn [mA]" value={text(values.rcdRatedMa)} onChange={(value) => set("rcdRatedMa", numberOrNull(value))} />
                <Field id="rt-rcd-ms" label="RCD vybavovací čas t_A [ms]" value={text(values.rcdTripTimeMs)} onChange={(value) => set("rcdTripTimeMs", numberOrNull(value))} />
                <div className="space-y-1.5">
                  <Label htmlFor="rt-rcd-type">Typ chrániče</Label>
                  <select id="rt-rcd-type" value={values.rcdType} onChange={(event) => set("rcdType", event.target.value as SignedMeasurements["rcdType"])} className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    {RCD_TYPES.map((value) => (
                      <option key={value} value={value}>
                        Typ {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm" role="radiogroup" aria-label="Kontrola oteplení / termovize a dotažení spojů">
                <span className="text-muted-foreground">Termovize / dotažení spojů:</span>
                {([
                  [true, "VYHOVUJE"],
                  [false, "NEVYHOVUJE"],
                  [null, "neprováděno"],
                ] as const).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={values.connectionsOk === value}
                    onClick={() => set("connectionsOk", value)}
                    className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", values.connectionsOk === value ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted/50")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* 4. Závady a celkový posudek */}
            <section className="space-y-3" aria-labelledby="rt-verdict-heading">
              <h3 id="rt-verdict-heading" className="text-sm font-semibold">
                4 · Zjištěné závady a celkový posudek (§ 10 NV č. 190/2022 Sb.)
              </h3>
              <div role="radiogroup" aria-label="Celkový posudek" className="grid gap-2 sm:grid-cols-3">
                {RESULTS.map((value) => {
                  const style = INSPECTION_RESULT[value];
                  const Icon = style.icon;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={result === value}
                      onClick={() => setResult(value)}
                      className={cn("touch-target flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium", result === value ? style.badge : "border-border bg-card hover:bg-muted/50")}
                      data-testid={`rt-result-${value}`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {style.label}
                    </button>
                  );
                })}
              </div>
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-semibold tracking-wide" data-testid="rt-verdict">
                {VERDICT_TEXT[result]}
              </p>
              {result === "CAPABLE" ? (
                <p className="text-sm text-muted-foreground">Zjištěné závady: {NO_DEFECTS_TEXT}.</p>
              ) : (
                <div className="space-y-2">
                  {defects.map((row, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_14rem_10rem_auto]">
                      <Input value={row.text} onChange={(event) => setDefects((current) => current.map((entry, i) => (i === index ? { ...entry, text: event.target.value } : entry)))} placeholder="Popis závady" aria-label={`Závada ${index + 1}`} className="h-10" />
                      <Input value={row.provision} onChange={(event) => setDefects((current) => current.map((entry, i) => (i === index ? { ...entry, provision: event.target.value } : entry)))} placeholder="Porušené ustanovení" aria-label={`Ustanovení závady ${index + 1}`} className="h-10" />
                      <Input type="date" value={row.deadline} min={date} onChange={(event) => setDefects((current) => current.map((entry, i) => (i === index ? { ...entry, deadline: event.target.value } : entry)))} aria-label={`Termín odstranění závady ${index + 1}`} className="h-10" />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Odebrat závadu ${index + 1}`} onClick={() => setDefects((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [{ text: "", provision: "", deadline: "" }]))}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setDefects((current) => [...current, { text: "", provision: "", deadline: "" }])}>
                    <Plus className="size-3.5" aria-hidden /> Přidat závadu
                  </Button>
                </div>
              )}
            </section>

            {/* 5. Podpis, razítko a PIN */}
            {profile ? (
              <section className="space-y-3" aria-labelledby="rt-sign-heading">
                <h3 id="rt-sign-heading" className="text-sm font-semibold">
                  5 · Podpis, razítko TIČR a autorizační PIN
                </h3>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    {profile.signatureUrl ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={useSaved} onChange={(event) => setUseSaved(event.target.checked)} className="size-4 accent-primary" data-testid="rt-use-saved-signature" />
                        Použít uložený podpis z profilu
                      </label>
                    ) : null}
                    {savedSignature && profile.signatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- uložený podpis z úložiště souborů
                      <img src={profile.signatureUrl} alt={`Uložený podpis – ${profile.name}`} className="h-24 rounded-lg border border-border bg-white object-contain p-2" />
                    ) : (
                      <>
                        <SignaturePad onChange={setSignature} />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-primary" />
                          Uložit podpis do profilu pro další revize
                        </label>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <InspectorStamp profile={profile} />
                    <span className="text-[11px] text-muted-foreground">Digitální razítko TIČR</span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-start">
                  <div className="space-y-1.5">
                    <Label htmlFor="rt-pin">Osobní bezpečnostní PIN</Label>
                    <Input id="rt-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className="h-11 font-mono tracking-[0.4em]" data-testid="rt-pin" />
                  </div>
                  <label className="flex items-start gap-2 pt-6 text-sm">
                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-primary" data-testid="rt-confirm" />
                    Potvrzuji, že jsem revizi osobně provedl(a) a uvedené hodnoty odpovídají skutečnému měření. Vydání revize stvrzuji svým PINem.
                  </label>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Vrstva A: prostý elektronický podpis (nařízení eIDAS, čl. 25 odst. 1) – podpis, razítko a PIN, k nimž Eldock uloží čas UTC / SEČ, IP adresu a zařízení a ze všech údajů protokolu spočítá neměnný otisk SHA-256 (patička protokolu i registr).
                  Vrstva B: protokol lze stáhnout, podepsat kvalifikovaným certifikátem (PAdES – zákon č. 297/2016 Sb.) a nahrát zpět k uzamčené revizi.
                </p>
              </section>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert" data-testid="rt-error">
                {error}
              </p>
            ) : null}
          </div>
        )}

        {!done && profiles && plant && !loadError ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="button" onClick={submit} disabled={pending || !canSign || Boolean(editing)} className="gap-2 font-semibold" data-testid="rt-submit">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
              Podepsat a uzamknout revizi ({formatCount(equipment.length, ITEMS)})
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 truncate">{value ?? "–"}</dd>
    </div>
  );
}

function Field({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 font-mono" data-testid={id} />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SignedSummary({ done, onClose }: { done: SignedResult; onClose: () => void }) {
  return (
    <div className="space-y-4" data-testid="rt-signed">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4">
        <BadgeCheck className="mt-0.5 size-6 shrink-0 text-emerald-400" aria-hidden />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-semibold text-emerald-100">
            Revize podepsána a uzamčena · protokol {done.reportNumber} ({formatCount(done.count, ITEMS)})
          </p>
          <p className="break-all font-mono text-xs text-emerald-200/90" data-testid="rt-seal-hash">
            SHA-256 {done.sealHash}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="touch-target gap-2">
          <Link href={`/inspections/report/${done.recordIds[0]}`} target="_blank" data-testid="rt-open-protocol">
            📄 Otevřít protokol (tisk / PDF a nahrání PAdES)
          </Link>
        </Button>
        <Button type="button" variant="outline" className="touch-target" onClick={onClose}>
          Hotovo
        </Button>
      </div>
    </div>
  );
}

/** Formulář profilu revizního technika (nový / úprava) s načtením firmy z ARES a PINem. */
function ProfileForm({ plantId, profile, onSaved, onCancel }: { plantId: string; profile: InspectorProfileView | null; onSaved: (profile: InspectorProfileView) => void; onCancel: (() => void) | null }) {
  const [form, setForm] = useState({
    name: profile?.name ?? "",
    company: profile?.company ?? "",
    ico: profile?.ico ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    certificateNo: profile?.certificateNo ?? "",
    certificateScope: profile?.certificateScope ?? "",
    certificateValidUntil: profile?.certificateValidUntil ?? "",
    authorizationNo: profile?.authorizationNo ?? "",
    instrument: profile?.instrument ?? "",
    calibrationNo: profile?.calibrationNo ?? "",
    calibrationValidUntil: profile?.calibrationValidUntil ?? "",
    pin: "",
    currentPin: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [ares, setAres] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function loadAres() {
    const ico = form.ico.replace(/\s/g, "");
    if (!/^\d{8}$/.test(ico)) return setAres("Zadejte platné 8místné IČO.");
    setAres("Načítám z ARES…");
    try {
      const response = await fetch(`/api/ares?ico=${ico}`);
      const body = (await response.json()) as { companyName?: string; error?: string };
      if (!response.ok || !body.companyName) return setAres(body.error ?? "Registr ARES je nedostupný – vyplňte firmu ručně.");
      setForm((current) => ({ ...current, ico, company: body.companyName ?? current.company }));
      setAres(`Načteno z ARES: ${body.companyName}`);
    } catch {
      setAres("Registr ARES je nedostupný – vyplňte firmu ručně.");
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const response = await saveInspectorProfileAction({
        inspectorProfileId: profile?.id ?? null,
        plantId,
        name: form.name,
        company: form.company,
        ico: form.ico.replace(/\s/g, ""),
        phone: form.phone,
        email: form.email,
        certificateNo: form.certificateNo,
        certificateScope: (form.certificateScope || null) as InspectorProfileView["certificateScope"],
        certificateValidUntil: form.certificateValidUntil,
        authorizationNo: form.authorizationNo,
        instrument: form.instrument,
        calibrationNo: form.calibrationNo,
        calibrationValidUntil: form.calibrationValidUntil,
        pin: form.pin || null,
        currentPin: form.currentPin || null,
      });
      if (!response.ok) return setError(response.error);
      toast.success(profile ? "Profil technika uložen." : "Profil technika založen.");
      onSaved(response.data);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3" data-testid="rt-profile-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <Text id="rtp-name" label="Jméno, příjmení a titul" value={form.name} onChange={update("name")} placeholder="Ing. Martin Dvořák" />
        <div className="space-y-1.5">
          <Label htmlFor="rtp-ico">IČO (načtení firmy z ARES)</Label>
          <div className="flex gap-2">
            <Input id="rtp-ico" value={form.ico} onChange={update("ico")} inputMode="numeric" maxLength={8} placeholder="12345678" className="h-10" data-testid="rtp-ico" />
            <Button type="button" variant="outline" onClick={loadAres}>
              ARES
            </Button>
          </div>
          {ares ? <p className="text-[11px] text-muted-foreground">{ares}</p> : null}
        </div>
        <Text id="rtp-company" label="Firma" value={form.company} onChange={update("company")} />
        <Text id="rtp-phone" label="Telefon" value={form.phone} onChange={update("phone")} />
        <Text id="rtp-email" label="E-mail (měsíční bezpečnostní report)" value={form.email} onChange={update("email")} type="email" />
        <Text id="rtp-cert" label="Evidenční číslo osvědčení TIČR" value={form.certificateNo} onChange={update("certificateNo")} placeholder="1248/23/R-EZ-E2A" mono />
        <div className="space-y-1.5">
          <Label htmlFor="rtp-scope">Rozsah osvědčení</Label>
          <select id="rtp-scope" value={form.certificateScope} onChange={update("certificateScope")} className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" data-testid="rtp-scope">
            <option value="">Neuvedeno</option>
            {INSPECTOR_SCOPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Text id="rtp-cert-until" label="Osvědčení platí do" value={form.certificateValidUntil} onChange={update("certificateValidUntil")} type="date" />
        <Text id="rtp-auth" label="Evidenční číslo oprávnění TIČR (podnikající FO / PO)" value={form.authorizationNo} onChange={update("authorizationNo")} mono />
        <Text id="rtp-instrument" label="Měřicí přístroj" value={form.instrument} onChange={update("instrument")} placeholder="Metrel EurotestXC MI 3155" />
        <Text id="rtp-cal" label="Číslo kalibračního listu" value={form.calibrationNo} onChange={update("calibrationNo")} placeholder="KL-2026-0842" mono />
        <Text id="rtp-cal-until" label="Kalibrace platí do" value={form.calibrationValidUntil} onChange={update("calibrationValidUntil")} type="date" />
        {profile ? <Text id="rtp-current-pin" label="Současný PIN (jen při změně PINu)" value={form.currentPin} onChange={update("currentPin")} type="password" mono /> : null}
        <Text id="rtp-pin" label={profile ? "Nový PIN (nepovinné)" : "Osobní bezpečnostní PIN (4–8 číslic)"} value={form.pin} onChange={update("pin")} type="password" mono />
      </div>
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Zpět
          </Button>
        ) : null}
        <Button type="button" onClick={save} disabled={pending} className="gap-1.5" data-testid="rtp-save">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Uložit profil technika
        </Button>
      </div>
    </div>
  );
}

function Text({ id, label, value, onChange, placeholder, type = "text", mono = false }: { id: string; label: string; value: string; onChange: (event: { target: { value: string } }) => void; placeholder?: string; type?: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} className={cn("h-10", mono && "font-mono")} autoComplete="off" inputMode={type === "password" ? "numeric" : undefined} data-testid={id} />
    </div>
  );
}
