"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComplianceCategory } from "@/generated/prisma/enums";
import {
  CONFORMITY_DIRECTIVES,
  CONFORMITY_STANDARDS,
  ENCLOSURE_INSTALLATIONS,
  ENCLOSURE_MATERIALS,
  INFLUENCE_CLASSES,
  PASSPORT_DOC_TITLES,
  ROUTINE_ITEMS,
  ROUTINE_RESULT_LABELS,
  SPACE_CONCLUSIONS,
  suggestConclusion,
  thermalCheck,
  wiringLossEstimate,
  type PassportPayload,
  type RoutineResult,
  type SpaceConclusion,
  type ThermalLossLine,
  type ThermalPayload,
} from "@/lib/passport-docs";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { generatePassportDocumentAction, uploadPassportDocumentAction } from "@/server/actions/passport";

/** Předvyplnění dialogů z karty zařízení, kusovníku a schématu (počítá stránka). */
export interface PassportGeneratorContext {
  equipmentId: string;
  tag: string;
  today: string;
  author: string;
  conformity: { manufacturer: string; manufacturerAddress: string; product: string; typeDesignation: string; serialNumber: string; place: string };
  revision: { id: string; version: string; schematicUrl: string; sheetCount: number } | null;
  thermal: { enclosure: ThermalPayload["enclosure"]; enclosureNote: string; ambientTempC: number; maxRiseK: number; losses: ThermalLossLine[] };
  influences: { codes: string[]; space: string; chair: string };
}

const select = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const num = (value: string) => {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
};
const cz = (value: number, digits = 1) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Fáze 116: tlačítka na kartě chybějícího dokumentu pasportu – „⚡ Doplnit / Vygenerovat v ELDOCKu“ (předvyplněný
 * dialog, potvrzení za pár vteřin) a „📤 Nahrát vlastní PDF“ (sken / PDF od výrobce rozváděče).
 */
export function PassportDocActions({ category, context }: { category: ComplianceCategory; context: PassportGeneratorContext }) {
  const [open, setOpen] = useState<"generate" | "upload" | null>(null);
  return (
    <div className="flex flex-wrap gap-2" data-testid={`passport-actions-${category}`}>
      <Button type="button" size="sm" className="h-9 gap-1.5" onClick={() => setOpen("generate")} data-testid={`passport-generate-${category}`}>
        <Zap className="size-4" aria-hidden /> ⚡ Doplnit / Vygenerovat v ELDOCKu
      </Button>
      <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setOpen("upload")} data-testid={`passport-upload-${category}`}>
        <Upload className="size-4" aria-hidden /> 📤 Nahrát vlastní PDF
      </Button>
      {open === "generate" ? <GenerateDialog category={category} context={context} onClose={() => setOpen(null)} /> : null}
      {open === "upload" ? <UploadDialog category={category} context={context} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function useSave(onClose: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function save(equipmentId: string, payload: PassportPayload, title: string) {
    setError(null);
    startTransition(async () => {
      const result = await generatePassportDocumentAction({ equipmentId, payload });
      if (!result.ok) return setError(result.error);
      toast.success(`${title} uložen do pasportu (${result.data.documentNumber}).`);
      onClose();
      router.refresh();
    });
  }
  return { pending, error, save };
}

function GenerateDialog({ category, context, onClose }: { category: ComplianceCategory; context: PassportGeneratorContext; onClose: () => void }) {
  const { pending, error, save } = useSave(onClose);
  const title = PASSPORT_DOC_TITLES[category];
  const body =
    category === "CONFORMITY_DECLARATION" ? <ConformityForm context={context} pending={pending} onSave={(payload) => save(context.equipmentId, payload, "Prohlášení o shodě")} /> :
    category === "ROUTINE_VERIFICATION" ? <RoutineForm context={context} pending={pending} onSave={(payload) => save(context.equipmentId, payload, "Protokol o kusové zkoušce")} /> :
    category === "SINGLE_LINE_DIAGRAM" ? <SingleLineForm context={context} pending={pending} onSave={(payload) => save(context.equipmentId, payload, "Liniové schéma")} /> :
    category === "THERMAL_CALCULATION" ? <ThermalForm context={context} pending={pending} onSave={(payload) => save(context.equipmentId, payload, "Výpočet oteplení")} /> :
    <InfluencesForm context={context} pending={pending} onSave={(payload) => save(context.equipmentId, payload, "Protokol o vnějších vlivech")} />;
  return (
    <Dialog open onOpenChange={(value) => (!value && !pending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl" data-testid="passport-dialog" data-category={category}>
        <DialogHeader>
          <DialogTitle>⚡ {title}</DialogTitle>
          <DialogDescription>Předvyplněno z karty {context.tag}, kusovníku a schématu – zkontrolujte parametry a potvrďte. Dokument se uloží do pasportu.</DialogDescription>
        </DialogHeader>
        {body}
        {error ? (
          <p className="text-sm text-red-300" role="alert" data-testid="passport-error">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-xs text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

function SaveFooter({ pending, disabled, label = "✅ Potvrdit a uložit do pasportu" }: { pending: boolean; disabled?: boolean; label?: string }) {
  return (
    <DialogFooter>
      <Button type="submit" className="gap-2" disabled={pending || disabled} data-testid="passport-save">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
    </DialogFooter>
  );
}

function ConformityForm({ context, pending, onSave }: { context: PassportGeneratorContext; pending: boolean; onSave: (payload: PassportPayload) => void }) {
  const [form, setForm] = useState({ ...context.conformity, date: context.today, signatory: "", signatoryRole: "jednatel / vedoucí výroby" });
  const [directives, setDirectives] = useState<string[]>([...CONFORMITY_DIRECTIVES.slice(0, 2)]);
  const [standards, setStandards] = useState<string[]>([...CONFORMITY_STANDARDS.slice(0, 2)]);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ kind: "CONFORMITY_DECLARATION", ...form, directives, standards });
      }}
    >
      <Field label="Výrobce rozváděče (obchodní firma)">
        <Input value={form.manufacturer} onChange={(event) => set({ manufacturer: event.target.value })} required data-testid="doc-manufacturer" />
      </Field>
      <Field label="Adresa výrobce">
        <Input value={form.manufacturerAddress} onChange={(event) => set({ manufacturerAddress: event.target.value })} />
      </Field>
      <Field label="Výrobek">
        <Input value={form.product} onChange={(event) => set({ product: event.target.value })} required />
      </Field>
      <Field label="Typové označení">
        <Input value={form.typeDesignation} onChange={(event) => set({ typeDesignation: event.target.value })} />
      </Field>
      <Field label="Výrobní číslo">
        <Input value={form.serialNumber} onChange={(event) => set({ serialNumber: event.target.value })} />
      </Field>
      <Field label="Místo a datum vydání">
        <div className="flex gap-2">
          <Input value={form.place} onChange={(event) => set({ place: event.target.value })} />
          <Input type="date" value={form.date} onChange={(event) => set({ date: event.target.value })} className="w-40" />
        </div>
      </Field>
      <fieldset className="flex flex-col gap-1 text-sm sm:col-span-2">
        <legend className="mb-1 text-xs text-muted-foreground">Předpisy</legend>
        {CONFORMITY_DIRECTIVES.map((item) => (
          <label key={item} className="flex items-center gap-2">
            <input type="checkbox" checked={directives.includes(item)} onChange={() => setDirectives((list) => toggle(list, item))} /> {item}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1 text-sm sm:col-span-2">
        <legend className="mb-1 text-xs text-muted-foreground">Harmonizované normy</legend>
        {CONFORMITY_STANDARDS.map((item) => (
          <label key={item} className="flex items-center gap-2">
            <input type="checkbox" checked={standards.includes(item)} onChange={() => setStandards((list) => toggle(list, item))} /> {item}
          </label>
        ))}
      </fieldset>
      <Field label="Podepisuje (jméno)">
        <Input value={form.signatory} onChange={(event) => set({ signatory: event.target.value })} required minLength={3} data-testid="doc-signatory" />
      </Field>
      <Field label="Funkce">
        <Input value={form.signatoryRole} onChange={(event) => set({ signatoryRole: event.target.value })} />
      </Field>
      <p className="text-xs text-amber-200 sm:col-span-2">Prohlášení o shodě vydává výrobce rozváděče na svou výhradní odpovědnost – ELDOCK připraví text, podpis zůstává na výrobci.</p>
      <div className="sm:col-span-2">
        <SaveFooter pending={pending} />
      </div>
    </form>
  );
}

function RoutineForm({ context, pending, onSave }: { context: PassportGeneratorContext; pending: boolean; onSave: (payload: PassportPayload) => void }) {
  const [results, setResults] = useState<Record<string, RoutineResult>>(() => Object.fromEntries(ROUTINE_ITEMS.map((item) => [item.clause, "OK"])));
  const [form, setForm] = useState({ testVoltage: "2500", insulation: "", instrument: "", performedBy: context.author, date: context.today });
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ kind: "ROUTINE_VERIFICATION", items: ROUTINE_ITEMS.map((item) => ({ clause: item.clause, label: item.label, result: results[item.clause] })), testVoltageV: num(form.testVoltage), insulationMOhm: num(form.insulation), instrument: form.instrument, performedBy: form.performedBy, date: form.date });
      }}
    >
      <table className="w-full text-sm">
        <tbody>
          {ROUTINE_ITEMS.map((item) => (
            <tr key={item.clause} className="border-b border-border">
              <td className="py-1.5 pr-2 font-mono text-xs text-muted-foreground">{item.clause}</td>
              <td className="py-1.5 pr-2">{item.label}</td>
              <td className="py-1.5">
                <select value={results[item.clause]} onChange={(event) => setResults((current) => ({ ...current, [item.clause]: event.target.value as RoutineResult }))} className={select} aria-label={`Výsledek ${item.clause}`}>
                  {(Object.keys(ROUTINE_RESULT_LABELS) as RoutineResult[]).map((key) => (
                    <option key={key} value={key}>
                      {ROUTINE_RESULT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Zkušební napětí (11.9) [V]">
          <Input value={form.testVoltage} onChange={(event) => setForm({ ...form, testVoltage: event.target.value })} inputMode="decimal" />
        </Field>
        <Field label="Izolační odpor [MΩ]">
          <Input value={form.insulation} onChange={(event) => setForm({ ...form, insulation: event.target.value })} inputMode="decimal" placeholder="např. 500" />
        </Field>
        <Field label="Měřicí přístroj">
          <Input value={form.instrument} onChange={(event) => setForm({ ...form, instrument: event.target.value })} placeholder="typ, výr. číslo, kalibrace" />
        </Field>
        <Field label="Provedl">
          <Input value={form.performedBy} onChange={(event) => setForm({ ...form, performedBy: event.target.value })} required minLength={3} />
        </Field>
        <Field label="Datum">
          <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" data-testid="routine-confirm" />
        Potvrzuji, že kusové ověření bylo provedeno a výsledky odpovídají skutečnosti (ČSN EN IEC 61439-1, čl. 11).
      </label>
      <SaveFooter pending={pending} disabled={!confirmed} />
    </form>
  );
}

function SingleLineForm({ context, pending, onSave }: { context: PassportGeneratorContext; pending: boolean; onSave: (payload: PassportPayload) => void }) {
  const revision = context.revision;
  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (revision) onSave({ kind: "SINGLE_LINE_DIAGRAM", revisionId: revision.id, version: revision.version, schematicUrl: revision.schematicUrl, sheetCount: revision.sheetCount });
      }}
    >
      {revision ? (
        <p>
          Liniové schéma se propojí se schématem platné revize <b className="font-mono">{revision.version}</b> ze záložky 📐 Schéma ({revision.sheetCount} {revision.sheetCount === 1 ? "list" : "listy"}). Při nové revizi schématu stačí propojení obnovit.
        </p>
      ) : (
        <p className="text-amber-200">Zařízení zatím nemá schéma – nahrajte ho v záložce Schéma nebo nahrajte vlastní PDF liniového schématu.</p>
      )}
      <SaveFooter pending={pending} disabled={!revision} label="🔗 Propojit schéma a uložit do pasportu" />
    </form>
  );
}

function ThermalForm({ context, pending, onSave }: { context: PassportGeneratorContext; pending: boolean; onSave: (payload: PassportPayload) => void }) {
  const [enclosure, setEnclosure] = useState(context.thermal.enclosure);
  const [ambient, setAmbient] = useState(String(context.thermal.ambientTempC));
  const [maxRise, setMaxRise] = useState(String(context.thermal.maxRiseK));
  const [losses, setLosses] = useState(context.thermal.losses.map((line) => ({ ...line, input: line.lossW === null ? "" : String(line.lossW).replace(".", ",") })));
  const parsed = losses.map((line) => ({ ...line, lossW: num(line.input) }));
  const deviceLoss = parsed.reduce((sum, line) => sum + (line.lossW ?? 0) * line.quantity, 0);
  const wiring = wiringLossEstimate(deviceLoss);
  const missing = parsed.filter((line) => line.lossW === null).length;
  const ambientC = num(ambient) ?? 35;
  const riseK = num(maxRise) ?? 30;
  const lines = parsed.map((line) => ({ designation: line.designation, description: line.description, quantity: line.quantity, lossW: line.lossW, source: line.source }));
  const result = thermalCheck({ enclosure, ambientTempC: ambientC, maxRiseK: riseK, losses: lines, wiringLossW: wiring });
  const dims = (key: "heightMm" | "widthMm" | "depthMm", label: string) => (
    <Field label={label}>
      <Input value={String(enclosure[key])} inputMode="numeric" onChange={(event) => setEnclosure({ ...enclosure, [key]: num(event.target.value) ?? 0 })} data-testid={`thermal-${key}`} />
    </Field>
  );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ kind: "THERMAL_CALCULATION", enclosure, ambientTempC: ambientC, maxRiseK: riseK, losses: lines, wiringLossW: wiring, result, date: context.today, author: context.author });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {dims("heightMm", "Výška skříně [mm]")}
        {dims("widthMm", "Šířka [mm]")}
        {dims("depthMm", "Hloubka [mm]")}
        <Field label="Instalace">
          <select value={enclosure.installation} onChange={(event) => setEnclosure({ ...enclosure, installation: event.target.value as typeof enclosure.installation })} className={select}>
            {ENCLOSURE_INSTALLATIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Materiál">
          <select value={enclosure.material} onChange={(event) => setEnclosure({ ...enclosure, material: event.target.value as typeof enclosure.material })} className={select}>
            {ENCLOSURE_MATERIALS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Okolí [°C]">
            <Input value={ambient} onChange={(event) => setAmbient(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="ΔT max [K]">
            <Input value={maxRise} onChange={(event) => setMaxRise(event.target.value)} inputMode="decimal" data-testid="thermal-max-rise" />
          </Field>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{context.thermal.enclosureNote}</p>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left">Pozice</th>
              <th className="px-2 py-1 text-left">Přístroj</th>
              <th className="px-2 py-1 text-right">Ks</th>
              <th className="px-2 py-1 text-right">Pv [W/ks]</th>
              <th className="px-2 py-1 text-left">Zdroj</th>
            </tr>
          </thead>
          <tbody>
            {losses.map((line, index) => (
              <tr key={`${line.designation}-${index}`} className="border-t border-border">
                <td className="px-2 py-1 font-mono">{line.designation}</td>
                <td className="px-2 py-1">{line.description}</td>
                <td className="px-2 py-1 text-right font-mono">{line.quantity}</td>
                <td className="px-2 py-1 text-right">
                  <input
                    value={line.input}
                    onChange={(event) => setLosses((current) => current.map((entry, position) => (position === index ? { ...entry, input: event.target.value, source: "zadáno ručně" } : entry)))}
                    inputMode="decimal"
                    className={cn("h-7 w-20 rounded border bg-transparent px-1 text-right font-mono", num(line.input) === null ? "border-amber-400" : "border-input")}
                    aria-label={`Ztrátový výkon ${line.designation}`}
                    data-testid={`thermal-loss-${line.designation}`}
                  />
                </td>
                <td className="px-2 py-1 text-muted-foreground">{line.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={cn("rounded-lg border p-3 text-sm", result.ok ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10")} data-testid="thermal-result" data-ok={result.ok ? "true" : "false"}>
        <p>
          Ztráty přístrojů <b>{cz(deviceLoss)} W</b> + vodiče {cz(wiring)} W (20 %) = <b>{cz(result.totalLossW)} W</b> · účinná plocha A<sub>e</sub> {cz(result.effectiveAreaM2, 2)} m² · Δt<sub>0,5</sub> {cz(result.deltaT05)} K · Δt<sub>1,0</sub> {cz(result.deltaT10)} K
        </p>
        <p className="font-semibold">{result.verdict}</p>
        {missing ? <p className="text-amber-200">Doplňte ztrátový výkon u {missing} přístrojů (údaj výrobce, W při jmenovitém proudu).</p> : null}
      </div>
      <SaveFooter pending={pending} disabled={missing > 0} />
    </form>
  );
}

function InfluencesForm({ context, pending, onSave }: { context: PassportGeneratorContext; pending: boolean; onSave: (payload: PassportPayload) => void }) {
  const [codes, setCodes] = useState(context.influences.codes);
  const [space, setSpace] = useState(context.influences.space);
  const [chair, setChair] = useState(context.influences.chair);
  const [members, setMembers] = useState("");
  const [date, setDate] = useState(context.today);
  const suggested = suggestConclusion(codes);
  const [conclusion, setConclusion] = useState<SpaceConclusion | null>(null);
  const final = conclusion ?? suggested;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ kind: "EXTERNAL_INFLUENCES", space, codes, conclusion: final, chair, members: members.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 6), basis: "ČSN 33 2000-5-51 ed. 3, ČSN 33 2000-1 ed. 2", date });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prostor (budova, podlaží, místnost)">
          <Input value={space} onChange={(event) => setSpace(event.target.value)} required />
        </Field>
        <Field label="Datum">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {INFLUENCE_CLASSES.map((entry, index) => (
          <Field key={entry.id} label={`${entry.id} – ${entry.label}`}>
            <select value={codes[index]} onChange={(event) => setCodes((current) => current.map((code, position) => (position === index ? event.target.value : code)))} className={select} data-testid={`influence-${entry.id}`}>
              {entry.values.map((value) => (
                <option key={value.code} value={value.code}>
                  {value.code} – {value.label}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Závěr komise (návrh podle kódů: ${SPACE_CONCLUSIONS[suggested]})`}>
          <select value={final} onChange={(event) => setConclusion(event.target.value as SpaceConclusion)} className={select} data-testid="influence-conclusion">
            {(Object.keys(SPACE_CONCLUSIONS) as SpaceConclusion[]).map((key) => (
              <option key={key} value={key}>
                {SPACE_CONCLUSIONS[key]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Předseda komise">
          <Input value={chair} onChange={(event) => setChair(event.target.value)} required minLength={3} />
        </Field>
        <Field label="Členové komise (oddělte čárkou)" className="sm:col-span-2">
          <Input value={members} onChange={(event) => setMembers(event.target.value)} placeholder="např. vedoucí výroby, BOZP technik, projektant" />
        </Field>
      </div>
      <SaveFooter pending={pending} />
    </form>
  );
}

function UploadDialog({ category, context, onClose }: { category: ComplianceCategory; context: PassportGeneratorContext; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ documentNumber: "", issuer: context.conformity.manufacturer, issuedAt: context.today });
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!file) return setError("Vyberte PDF.");
    setError(null);
    setProgress(0);
    try {
      const uploaded = await uploadFile("document", file, setProgress);
      startTransition(async () => {
        const result = await uploadPassportDocumentAction({ equipmentId: context.equipmentId, category, fileUrl: uploaded.url, ...form });
        if (!result.ok) return setError(result.error);
        toast.success(`${PASSPORT_DOC_TITLES[category]} nahráno do pasportu.`);
        onClose();
        router.refresh();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF se nepodařilo nahrát.");
    } finally {
      setProgress(null);
    }
  }
  return (
    <Dialog open onOpenChange={(value) => (!value && !pending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg" data-testid="passport-upload-dialog">
        <DialogHeader>
          <DialogTitle>📤 {PASSPORT_DOC_TITLES[category]}</DialogTitle>
          <DialogDescription>Nahrajte sken nebo PDF od výrobce rozváděče – uloží se do pasportu {context.tag}.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <input ref={input} type="file" accept="application/pdf" className="text-sm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} data-testid="passport-upload-file" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pp-number">Číslo dokumentu</Label>
              <Input id="pp-number" value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pp-date">Vydáno</Label>
              <Input id="pp-date" type="date" value={form.issuedAt} onChange={(event) => setForm({ ...form, issuedAt: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="pp-issuer">Vystavil</Label>
              <Input id="pp-issuer" value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.target.value })} />
            </div>
          </div>
          {progress !== null ? <p className="text-xs text-muted-foreground">Nahrávám… {progress} %</p> : null}
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" className="gap-2" onClick={() => void submit()} disabled={pending || progress !== null} data-testid="passport-upload-save">
            {pending || progress !== null ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} Nahrát do pasportu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
