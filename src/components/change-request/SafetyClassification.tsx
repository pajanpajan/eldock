"use client";

import { useRef, useState, type Dispatch } from "react";
import { Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import type { SafetyImpactLevel } from "@/generated/prisma/enums";
import { formatFileSize } from "@/lib/equipment-documents";
import { SAFETY_IMPACT, SUBSTANTIAL_MOD_WARNING } from "@/lib/legislation-2027";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

import type { WizardAction, WizardState } from "./wizard-state";

const TONES = { green: "border-emerald-500 bg-emerald-500/10", yellow: "border-amber-400 bg-amber-400/10", red: "border-red-500 bg-red-500/15" } as const;
const ACCEPT = ".zip,.7z,.rar,.zap16,.zap17,.zap18,.zap19,.s7p,.acd,.xml,.json,.par,.bin,.hex,.csv,.pdf";

/**
 * Klasifikace zásahu dle Nařízení (EU) 2023/1230 a úprava řídicího SW (fáze 46): 🟢 výměna 1:1,
 * 🟡 provozní úprava, 🔴 podstatná změna bezpečnosti (varování). Zálohu SW jde přiložit rovnou.
 */
export function SafetyClassification({ state, dispatch, units }: { state: WizardState; dispatch: Dispatch<WizardAction>; units: string[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState(units[0] ?? "");
  const [platform, setPlatform] = useState("");
  const [safety, setSafety] = useState(false);
  const [checksum, setChecksum] = useState("");
  const [uploading, setUploading] = useState(false);
  const backup = state.softwareBackup;

  async function attach(file: File) {
    if (!unit.trim() || !platform.trim()) return void toast.error("Vyplňte řídicí uzel a platformu zálohy.");
    setUploading(true);
    try {
      const uploaded = await uploadFile("software", file);
      dispatch({ type: "setSoftwareBackup", backup: { targetUnit: unit.trim(), platform: platform.trim(), fileUrl: uploaded.url, fileName: file.name, fileSizeBytes: file.size, isSafetyRelated: safety, safetyChecksum: checksum } });
      toast.success("Záloha SW připravena – uloží se s odesláním změny.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zálohu se nepodařilo nahrát.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section aria-label="Klasifikace zásahu" className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="safety-classification">
      <h3 className="font-semibold">Klasifikace zásahu dle Nařízení (EU) 2023/1230</h3>
      <div className="grid gap-2" role="radiogroup" aria-label="Klasifikace zásahu">
        {(Object.keys(SAFETY_IMPACT) as SafetyImpactLevel[]).map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={state.safetyImpact === level}
            onClick={() => dispatch({ type: "setSafetyImpact", safetyImpact: level })}
            className={cn("min-h-12 rounded-lg border-2 px-3 py-2 text-left text-sm font-medium", state.safetyImpact === level ? TONES[SAFETY_IMPACT[level].tone] : "border-border hover:border-primary/60")}
          >
            {SAFETY_IMPACT[level].label}
          </button>
        ))}
      </div>
      {state.safetyImpact === "SUBSTANTIAL_SAFETY_MOD" ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border-2 border-red-500 bg-red-500/15 p-3 text-sm font-semibold text-red-100" data-testid="substantial-warning">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-400" aria-hidden />
          {SUBSTANTIAL_MOD_WARNING}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="size-5 accent-primary" checked={state.softwareChanged} onChange={(event) => dispatch({ type: "setSoftwareChanged", value: event.target.checked })} />
        💾 Součástí zásahu byla i úprava řídicího SW / parametrů měniče
      </label>
      {state.softwareChanged ? (
        backup ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-2.5 text-sm" data-testid="wizard-backup">
            Záloha <b>{backup.targetUnit}</b> · {backup.platform} · {backup.fileName} ({formatFileSize(backup.fileSizeBytes)})
            {backup.isSafetyRelated ? <span className="font-mono text-xs text-amber-200">Safety {backup.safetyChecksum}</span> : null}
            <button type="button" className="ml-auto rounded p-1 hover:bg-muted" onClick={() => dispatch({ type: "setSoftwareBackup", backup: null })} aria-label="Odebrat zálohu">
              <X className="size-4" aria-hidden />
            </button>
          </p>
        ) : (
          <div className="grid gap-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">Nepovinné: přiložte novou zálohu hned (uloží se jako další verze uzlu). Jinak ji CAE uvidí jako úkol „Čeká na nahrání aktualizované zálohy SW“.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={unit} onChange={(event) => setUnit(event.target.value)} list="wizard-units" maxLength={120} placeholder="Řídicí uzel, např. PLC -A1" aria-label="Řídicí uzel zálohy" />
              <datalist id="wizard-units">
                {units.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <Input value={platform} onChange={(event) => setPlatform(event.target.value)} maxLength={80} placeholder="Platforma, např. TIA Portal V19" aria-label="Platforma zálohy" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={safety} onChange={(event) => setSafety(event.target.checked)} />
              Bezpečnostní program (Safety PLC / F-CPU)
            </label>
            {safety ? <Input value={checksum} onChange={(event) => setChecksum(event.target.value)} maxLength={60} placeholder="CRC: 0x8F4A-2C91" aria-label="Safety Checksum" /> : null}
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Soubor zálohy SW"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void attach(file);
              }}
            />
            <button type="button" disabled={uploading} onClick={() => input.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm hover:border-primary disabled:opacity-50">
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} Přiložit zálohu SW / parametrů
            </button>
          </div>
        )
      ) : null}
    </section>
  );
}
