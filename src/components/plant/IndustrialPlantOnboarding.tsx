"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MACHINE_TYPES, SAMPLE_SCHEMATIC, cleanTag, sourceCurrentA, transformerCurrentA, type MachineInput, type MainSourceKind, type OnboardingMode } from "@/lib/plant-onboarding";
import { labelUrl } from "@/lib/qr-label";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { addOnboardingMachineAction, createOnboardingHallAction } from "@/server/actions/plant-onboarding";

import { NightShiftMission } from "./NightShiftMission";
import { PLANT_GUIDE_EVENT } from "./PlantGuideButton";

export interface PlantOnboardingProps {
  plantId: string;
  plantName: string;
  /** Smí stavět ve Studiu výstavby (režim A zakládá skutečná data). */
  canBuild: boolean;
  /** Kniha revizí (auditní report) je v tarifu a účet ji smí otevřít. */
  canAudit: boolean;
  /** Prázdný závod – nabídka průvodce jako karta na stránce. */
  empty: boolean;
  /** `?pruvodce=` – otevřít hned (volba režimu / režim A / režim B). */
  open: OnboardingMode | "choose" | null;
}

const MODES: readonly { id: OnboardingMode; title: string; text: string; testId: string }[] = [
  { id: "build", title: "🏗️ Postavit náš vlastní závod a první stroj za 3 minuty", text: "Rychlý průvodce založením závodu: první hala s hlavním rozváděčem, první stroj s PDF schématem a QR štítek k tisku.", testId: "onboarding-mode-build" },
  { id: "mission", title: "🚨 Simulace noční poruchy linky (90 s)", text: "Interaktivní mise pro údržbu nad vzorovým závodem: mapa a QR, Červenka ve schématu, zálohy PLC a EU 2023/1230, simulátor zátěže a Kniha revizí.", testId: "onboarding-mode-mission" },
];

/**
 * Fáze 92: průvodce výrobním závodem (ELDOCK Průmysl) – jen správa závodu a dokumentace (žádné bytové přístroje ani
 * domovní půdorysy). Na prázdném závodě karta se dvěma režimy, jinak dialog z tlačítka „🧭 Průvodce závodem“.
 */
export function IndustrialPlantOnboarding(props: PlantOnboardingProps) {
  const [mode, setMode] = useState<OnboardingMode | "choose" | null>(props.open);
  // „🧭 Průvodce závodem“ z horní lišty na této stránce – otevřít volbu režimu bez nového načtení
  useEffect(() => {
    const open = (event: Event) => {
      event.preventDefault();
      setMode((current) => current ?? "choose");
    };
    window.addEventListener(PLANT_GUIDE_EVENT, open);
    return () => window.removeEventListener(PLANT_GUIDE_EVENT, open);
  }, []);
  return (
    <>
      {props.empty ? (
        <section className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/50 bg-card p-4" aria-label="Průvodce závodem" data-testid="industrial-onboarding-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">🧭 Průvodce závodem – začněte tady</h2>
            <span className="text-xs text-muted-foreground">Pro vedoucí údržby, technické ředitele a revizní techniky</span>
          </div>
          <ModeCards canBuild={props.canBuild} onPick={setMode} />
        </section>
      ) : null}
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl" data-testid="industrial-onboarding">
          <DialogHeader>
            <DialogTitle>{mode === "build" ? "🏗️ Rychlý průvodce založením závodu" : mode === "mission" ? "🚨 Simulace noční poruchy linky" : "🧭 Průvodce závodem"}</DialogTitle>
            <DialogDescription>{props.plantName} · ELDOCK Průmysl – správa výrobního závodu a dokumentace</DialogDescription>
          </DialogHeader>
          {mode === "choose" ? <ModeCards canBuild={props.canBuild} onPick={setMode} /> : null}
          {mode === "build" ? <BuildWizard plantId={props.plantId} canAudit={props.canAudit} canBuild={props.canBuild} onMission={() => setMode("mission")} /> : null}
          {mode === "mission" ? <NightShiftMission canAudit={props.canAudit} canBuild={props.canBuild} onBuild={() => setMode("build")} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModeCards({ canBuild, onPick }: { canBuild: boolean; onPick: (mode: OnboardingMode) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="onboarding-modes">
      {MODES.map((mode) => {
        const locked = mode.id === "build" && !canBuild;
        return (
          <button key={mode.id} type="button" onClick={() => onPick(mode.id)} disabled={locked} className={cn("flex flex-col gap-1 rounded-xl border-2 p-4 text-left", mode.id === "mission" ? "border-red-500/60 bg-red-500/5 hover:bg-red-500/10" : "border-primary/60 bg-primary/5 hover:bg-primary/10", locked && "cursor-not-allowed opacity-60")} data-testid={mode.testId}>
            <b className="text-base">{mode.title}</b>
            <span className="text-xs text-muted-foreground">{locked ? "Halu a stroje zakládá technický ředitel nebo vedoucí údržby (právo Studio výstavby)." : mode.text}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Režim A – hala a hlavní zdroj → první stroj s PDF schématem → QR štítek a karta stroje
// ---------------------------------------------------------------------------

type Hall = { buildingId: string; boardId: string; boardTag: string; boardName: string };
type Machine = { equipmentId: string; tag: string; name: string; qrToken: string | null; type: MachineInput["type"] };

function BuildWizard({ plantId, canAudit, canBuild, onMission }: { plantId: string; canAudit: boolean; canBuild: boolean; onMission: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hall, setHall] = useState<Hall | null>(null);
  const [machine, setMachine] = useState<Machine | null>(null);
  const step = machine ? 3 : hall ? 2 : 1;

  // Krok 1
  const [hallName, setHallName] = useState("Hala 1 – Výroba");
  const [sourceKind, setSourceKind] = useState<MainSourceKind>("SWITCHBOARD");
  const [boardTag, setBoardTag] = useState("HR-1");
  const [rating, setRating] = useState("630");
  // Krok 2
  const [machineName, setMachineName] = useState("CNC Centrum 1");
  const [machineTag, setMachineTag] = useState("CNC-1");
  const [tagTouched, setTagTouched] = useState(false);
  const [machineType, setMachineType] = useState<MachineInput["type"]>("CNC_MACHINE");
  const [powerKw, setPowerKw] = useState("22");
  const [schematic, setSchematic] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!canBuild) return <p className="text-sm text-muted-foreground">Halu a stroje zakládá technický ředitel nebo vedoucí údržby (právo Studio výstavby). Vyzkoušejte zatím misi noční poruchy.</p>;

  const number = (value: string) => Number(value.replace(",", "."));

  function submitHall(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createOnboardingHallAction(plantId, { hallName, boardTag, sourceKind, rating: number(rating) });
      if (!result.ok) return void toast.error(result.error);
      setHall(result.data);
      toast.success(`Hala „${hallName}“ je v mapě areálu – s rozvodnou a ${sourceKind === "TRANSFORMER" ? "trafostanicí" : "hlavním rozváděčem"} ${result.data.boardTag}.`);
      router.refresh();
    });
  }

  async function attach(file: File) {
    if (!/\.pdf$/i.test(file.name)) return void toast.error("Schéma nahrajte jako PDF.");
    setUploading(true);
    try {
      const uploaded = await uploadFile("revision", file);
      setSchematic({ url: uploaded.url, name: file.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schéma se nepodařilo nahrát.");
    } finally {
      setUploading(false);
    }
  }

  function submitMachine(event: React.FormEvent) {
    event.preventDefault();
    if (!hall) return;
    if (!schematic) return void toast.error("Přetáhněte PDF schéma, nebo použijte vzorové průmyslové schéma.");
    startTransition(async () => {
      const result = await addOnboardingMachineAction(plantId, { buildingId: hall.buildingId, name: machineName, tag: machineTag, type: machineType, powerKw: number(powerKw), schematicUrl: schematic.url, schematicTitle: schematic.url === SAMPLE_SCHEMATIC.url ? "Elektrické schéma (vzor)" : schematic.name.replace(/\.pdf$/i, "") });
      if (!result.ok) return void toast.error(result.error);
      setMachine({ ...result.data, type: machineType });
      toast.success(`${result.data.tag} je zdokumentovaný – schéma v1.0 a QR štítek jsou připravené.`);
      router.refresh();
    });
  }

  const steps = ["Vaše první hala a hlavní zdroj", "První stroj a PDF schéma", "QR štítek a vyzkoušení Červenky"];
  const amps = sourceKind === "TRANSFORMER" ? transformerCurrentA(number(rating) || 0) : sourceCurrentA({ sourceKind, rating: number(rating) || 0 });
  return (
    <div className="flex flex-col gap-4" data-testid="onboarding-build" data-step={step}>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((label, index) => (
          <li key={label} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", step === index + 1 ? "border-primary bg-primary/10 font-semibold" : step > index + 1 ? "border-emerald-500/40 text-emerald-200" : "border-border text-muted-foreground")}>
            {step > index + 1 ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden /> : <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-xs">{index + 1}</span>}
            Krok {index + 1}: {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <form onSubmit={submitHall} className="grid gap-3 sm:grid-cols-2" data-testid="onboarding-hall-form">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="onb-hall">Název první výrobní haly</Label>
            <Input id="onb-hall" value={hallName} onChange={(event) => setHallName(event.target.value)} maxLength={80} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onb-source">Hlavní zdroj haly</Label>
            <select
              id="onb-source"
              value={sourceKind}
              onChange={(event) => {
                const next = event.target.value as MainSourceKind;
                setSourceKind(next);
                setBoardTag(next === "TRANSFORMER" ? "TS-1" : "HR-1");
                setRating(next === "TRANSFORMER" ? "1000" : "630");
              }}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="SWITCHBOARD">Hlavní rozváděč</option>
              <option value="TRANSFORMER">Trafostanice</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onb-board">Označení {sourceKind === "TRANSFORMER" ? "trafostanice" : "hlavního rozváděče"}</Label>
            <Input id="onb-board" value={boardTag} onChange={(event) => setBoardTag(event.target.value)} maxLength={20} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onb-rating">{sourceKind === "TRANSFORMER" ? "Jmenovitý výkon [kVA]" : "Jmenovitý proud [A]"}</Label>
            <Input id="onb-rating" value={rating} onChange={(event) => setRating(event.target.value)} inputMode="decimal" required />
          </div>
          <p className="self-end text-xs text-muted-foreground">{sourceKind === "TRANSFORMER" ? `≈ ${amps.toLocaleString("cs-CZ")} A na straně 400 V` : "Hala 54 × 30 m s výrobou a rozvodnou – v mapě areálu ji pak posunete ve Studiu."}</p>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending} className="gap-1.5" data-testid="onboarding-hall-submit">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Vygenerovat halu s rozvodnou →
            </Button>
          </div>
        </form>
      ) : null}

      {step === 2 && hall ? (
        <form onSubmit={submitMachine} className="grid gap-3 sm:grid-cols-2" data-testid="onboarding-machine-form">
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm sm:col-span-2" data-testid="onboarding-hall-done">
            ✅ Hala je v mapě areálu, napájí ji <b>{hall.boardTag}</b>. Teď první stroj nebo podružný rozváděč – napojí se na {hall.boardTag}.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onb-machine">Název stroje / rozváděče</Label>
            <Input
              id="onb-machine"
              value={machineName}
              onChange={(event) => {
                setMachineName(event.target.value);
                if (!tagTouched) setMachineTag(cleanTag(event.target.value.replace(/centrum/i, ""), "STROJ-1"));
              }}
              maxLength={80}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onb-tag">Označení (tag)</Label>
            <Input
              id="onb-tag"
              value={machineTag}
              onChange={(event) => {
                setTagTouched(true);
                setMachineTag(event.target.value);
              }}
              maxLength={20}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onb-type">Druh</Label>
            <select id="onb-type" value={machineType} onChange={(event) => setMachineType(event.target.value as MachineInput["type"])} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
              {MACHINE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onb-kw">Příkon [kW]</Label>
            <Input id="onb-kw" value={powerKw} onChange={(event) => setPowerKw(event.target.value)} inputMode="decimal" required />
          </div>
          <div
            className={cn("flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 text-center text-sm sm:col-span-2", dragging ? "border-primary bg-primary/10" : "border-border")}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void attach(file);
            }}
            data-testid="onboarding-schematic-drop"
          >
            {schematic ? (
              <span className="font-medium" data-testid="onboarding-schematic">
                📄 {schematic.name}
              </span>
            ) : (
              <span className="text-muted-foreground">Přetáhněte sem PDF elektrické schéma stroje (nebo rozváděče)</span>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} Vybrat PDF
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSchematic({ ...SAMPLE_SCHEMATIC })} data-testid="onboarding-sample-schematic">
                Použít vzorové průmyslové schéma (1 klik)
              </Button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void attach(file);
                event.target.value = "";
              }}
            />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={pending || uploading} className="gap-1.5" data-testid="onboarding-machine-submit">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Založit stroj se schématem →
            </Button>
          </div>
        </form>
      ) : null}

      {step === 3 && machine ? <MachineReady machine={machine} canAudit={canAudit} onMission={onMission} /> : null}
    </div>
  );
}

function MachineReady({ machine, canAudit, onMission }: { machine: Machine; canAudit: boolean; onMission: () => void }) {
  // Průvodce běží jen v prohlížeči (dynamický import bez SSR) – původ adresy pro QR je známý hned
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const card = `/equipment/${machine.equipmentId}`;
  const url = origin ? labelUrl(origin, machine.equipmentId, machine.qrToken) : card;
  const software = machine.type !== "SWITCHBOARD";
  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]" data-testid="onboarding-ready">
      <div className="flex flex-col items-center gap-2">
        {/* Čtvercový štítek pro tisk 20 × 20 / 40 × 40 mm (QR vede rovnou na kartu stroje s kódem štítku) */}
        <div className="flex size-40 flex-col items-center justify-center gap-1 rounded-lg border-4 border-black bg-white p-2 text-black" data-testid="onboarding-qr">
          <QRCodeSVG value={url} level="M" marginSize={0} className="size-28" title={`QR kód – ${machine.tag}`} />
          <span className="font-mono text-sm font-black leading-none">{machine.tag}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 text-xs">
          <a href={`${card}/label?format=20`} target="_blank" rel="noopener" className="rounded-md border border-border px-2 py-1 hover:border-primary" data-testid="onboarding-label-20">
            🖨️ 20 × 20 mm
          </a>
          <a href={`${card}/label?format=40`} target="_blank" rel="noopener" className="rounded-md border border-border px-2 py-1 hover:border-primary" data-testid="onboarding-label-40">
            🖨️ 40 × 40 mm
          </a>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
          ✅ <b>{machine.tag}</b> – {machine.name.replace(`${machine.tag} - `, "")} je zdokumentovaný: platná revize schématu v1.0, QR štítek a místo v hale. Nalepte štítek na stroj – údržbář se k dokumentaci dostane mobilem bez hledání.
        </p>
        <p className="font-semibold">Vyzkoušejte rovnou na kartě stroje:</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild data-testid="onboarding-open-card">
            <Link href={card}>Otevřít kartu stroje</Link>
          </Button>
          <Button asChild variant="outline" data-testid="onboarding-open-redline">
            <Link href={`${card}/change-request`}>✏️ Zakreslit první změnu (Červenka)</Link>
          </Button>
          {software ? (
            <Button asChild variant="outline" data-testid="onboarding-open-software">
              <Link href={`${card}?tab=software`}>💾 Nahrát zálohu PLC</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" data-testid="onboarding-open-logbook">
            <Link href={canAudit ? "/inspections/audit-report" : `${card}?tab=inspections`}>📗 Zkontrolovat v Knize revizí</Link>
          </Button>
        </div>
        <button type="button" onClick={onMission} className="w-fit text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          🚨 Vyzkoušet i 90s misi noční poruchy linky
        </button>
      </div>
    </div>
  );
}
