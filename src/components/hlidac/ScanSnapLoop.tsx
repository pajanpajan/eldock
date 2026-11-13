"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, QrCode, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { sendOrQueue } from "@/lib/offline-sync-queue";
import { cn } from "@/lib/utils";

import { offlineQueue, postSnap, type SnapPayload } from "./offline-queue";

/**
 * Fáze 112: ⚡ Rychlý sekvenční sběr v místnosti (Scan & Snap Loop) – technik vybere budovu a místnost a pak v plynulé
 * smyčce: 1) naskenuje nalepený QR štítek ELDOCK (EL-xxxxxx) nebo vezme další v pořadí, 2) vyfotí výrobní štítek
 * (AI na pozadí přečte název, výrobce, model, S/N a třídu), 3) jedním klikem zadá výsledek – záznam se hned uloží
 * (bez signálu do offline fronty) a fotoaparát se sám otevře pro další kus v místnosti.
 */

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const INSPECTOR_KEY = "eldock-inspector";
const SERIAL = /EL-\d{6}/i;

/** Kód štítku z naskenovaného QR (URL karty /q/EL-…, nebo samotný kód). */
export function labelFromScan(raw: string): string | null {
  return SERIAL.exec(raw)?.[0].toUpperCase() ?? null;
}

function detectorCtor(): DetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

function readInspector(): { name: string; license: string } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(INSPECTOR_KEY) ?? "null") as { name?: string; license?: string } | null;
    return { name: raw?.name ?? "", license: raw?.license ?? "" };
  } catch {
    return { name: "", license: "" };
  }
}

type Step = 1 | 2 | 3;
interface Captured {
  key: string;
  status: "sent" | "queued";
  tag: string | null;
  label: string | null;
  passed: boolean;
  warning: string | null;
}

export function ScanSnapLoop({ floors, floorId: initialFloor = null, room: initialRoom = null, inspectorName: defaultInspector = null }: { floors: { id: string; label: string; rooms: string[] }[]; floorId?: string | null; room?: string | null; inspectorName?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [floorId, setFloorId] = useState(initialFloor ?? floors[0]?.id ?? "");
  const [room, setRoom] = useState(initialRoom ?? floors.find((floor) => floor.id === (initialFloor ?? floors[0]?.id))?.rooms[0] ?? "");
  const [inspector, setInspector] = useState({ name: defaultInspector ?? "", license: "" });
  const [step, setStep] = useState<Step>(1);
  const [labelCode, setLabelCode] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [riso, setRiso] = useState("");
  const [rpe, setRpe] = useState("");
  const [saving, setSaving] = useState(false);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [scanning, setScanning] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rooms = floors.find((floor) => floor.id === floorId)?.rooms ?? [];

  function stopScan() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setScanning(false);
  }

  useEffect(() => () => stopScan(), []);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  /** Kamera + BarcodeDetector (Chrome / Android); jinde ruční zadání kódu nebo „další v pořadí“. */
  async function startScan() {
    const Detector = detectorCtor();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      toast.info("Tento prohlížeč neumí číst QR kamerou – opište kód EL-xxxxxx ze štítku nebo vezměte další štítek v pořadí.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = media;
      setScanning(true);
      const element = video.current;
      if (!element) return stopScan();
      element.srcObject = media;
      await element.play();
      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!stream.current || !video.current) return;
        const found = (await detector.detect(video.current).catch(() => [])).map((code) => labelFromScan(code.rawValue)).find(Boolean);
        if (found) {
          setLabelCode(found);
          stopScan();
          setStep(2);
          return;
        }
        window.setTimeout(() => void tick(), 250);
      };
      void tick();
    } catch {
      stopScan();
      toast.error("Kameru se nepodařilo spustit – povolte přístup ke kameře, nebo kód opište.");
    }
  }

  function chooseFloor(next: string) {
    setFloorId(next);
    setRoom(floors.find((floor) => floor.id === next)?.rooms[0] ?? "");
  }

  function takePhoto(file: File | undefined) {
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setStep(3);
  }

  function resetCycle() {
    setLabelCode("");
    setPhoto(null);
    setPreview(null);
    setText("");
    setRiso("");
    setRpe("");
    setStep(1);
  }

  function save(passed: boolean) {
    if (!floorId || !room) return void toast.error("Vyberte patro a místnost.");
    if (!inspector.name.trim()) return void toast.error("Vyplňte jméno revizního technika.");
    try {
      window.localStorage.setItem(INSPECTOR_KEY, JSON.stringify(inspector));
    } catch {
      // bez úložiště – jméno platí do zavření okna
    }
    const number = (value: string) => {
      const parsed = Number(value.replace(",", "."));
      return value.trim() && Number.isFinite(parsed) ? parsed : null;
    };
    const payload: SnapPayload = { floorId, room, labelCode: labelCode.trim() || null, passed, rpe: number(rpe), riso: number(riso), inspectorName: inspector.name.trim(), inspectorLicense: inspector.license.trim() || "neuvedeno", text: text.trim() || null };
    const blobs: Record<string, Blob> = photo ? { photo } : {};
    const key = `${Date.now()}-${captured.length}`;
    setCaptured((current) => [{ key, status: "queued", tag: null, label: payload.labelCode, passed, warning: null }, ...current]);
    setSaving(true);
    void sendOrQueue(offlineQueue(), "snap", payload, blobs, (entry, files) => postSnap(entry, files))
      .then((outcome) => {
        if (outcome.status === "sent") {
          const { result } = outcome.result;
          setCaptured((current) => current.map((row) => (row.key === key ? { ...row, status: "sent", tag: result.tag, label: result.label, warning: result.warning } : row)));
          if (result.warning) toast.warning(result.warning);
          router.refresh();
        } else toast.info("📡 Bez signálu – záznam čeká v offline frontě a odešle se po obnovení připojení.");
      })
      .catch((error: unknown) => {
        setCaptured((current) => current.filter((row) => row.key !== key));
        toast.error(error instanceof Error ? error.message : "Záznam se nepodařilo uložit.");
      })
      .finally(() => setSaving(false));
    resetCycle();
    // Další kus v místnosti: bez čtečky QR rovnou fotoaparát na výrobní štítek (v rámci kliknutí – prohlížeč ho pustí)
    if (!detectorCtor()) {
      setStep(2);
      photoInput.current?.click();
    } else void startScan();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setInspector((current) => (current.name ? current : { ...readInspector(), name: readInspector().name || defaultInspector || "" }));
        else {
          stopScan();
          resetCycle();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="touch-target gap-2" data-testid="snap-open">
          <ScanLine className="size-4" aria-hidden /> ⚡ Rychlý sekvenční sběr v místnosti (Scan & Snap)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-2xl" data-testid="snap-loop" data-step={step}>
        <DialogHeader>
          <DialogTitle>⚡ Rychlý sekvenční sběr v místnosti</DialogTitle>
          <DialogDescription>Pípni QR ➔ vyfoť výrobní štítek ➔ výsledek jedním klikem ➔ další kus. Bez signálu se záznamy uloží do telefonu a odešlou se samy.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            Budova / patro
            <select value={floorId} onChange={(event) => chooseFloor(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" data-testid="snap-floor">
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            Místnost
            <select value={room} onChange={(event) => setRoom(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" data-testid="snap-room">
              {rooms.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            Revizní technik
            <Input value={inspector.name} maxLength={120} onChange={(event) => setInspector((current) => ({ ...current, name: event.target.value }))} data-testid="snap-inspector" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            Ev. č. osvědčení
            <Input value={inspector.license} maxLength={120} onChange={(event) => setInspector((current) => ({ ...current, license: event.target.value }))} />
          </label>
        </div>

        <ol className="grid grid-cols-3 gap-1 text-center text-xs font-semibold" aria-label="Kroky sběru">
          {["1 · QR štítek", "2 · Výrobní štítek", "3 · Výsledek"].map((label, index) => (
            <li key={label} className={cn("rounded-md border px-2 py-1", step === index + 1 ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
              {label}
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="snap-step-1">
            <video ref={video} className={cn("aspect-video w-full rounded-md bg-black object-cover", scanning ? "" : "hidden")} muted playsInline />
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => void startScan()} disabled={scanning} data-testid="snap-scan">
                <QrCode className="size-4" aria-hidden /> Naskenovat QR štítek
              </Button>
              <label className="flex flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                nebo kód ze štítku
                <Input value={labelCode} placeholder="EL-000123" maxLength={12} onChange={(event) => setLabelCode(event.target.value.toUpperCase())} data-testid="snap-label" />
              </label>
              <Button type="button" onClick={() => setStep(2)} disabled={Boolean(labelCode) && !labelFromScan(labelCode)} data-testid="snap-label-ok">
                {labelCode ? "Pokračovat" : "➕ Další štítek v pořadí"}
              </Button>
            </div>
          </section>
        ) : null}

        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => takePhoto(event.target.files?.[0])} data-testid="snap-photo-input" />
        {step === 2 ? (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="snap-step-2">
            <p className="text-sm">
              Štítek: <b className="font-mono">{labelCode || "další v pořadí"}</b> · vyfoťte výrobní štítek spotřebiče – AI přečte název, výrobce, model, S/N a třídu.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="gap-2" onClick={() => photoInput.current?.click()} data-testid="snap-photo">
                <Camera className="size-4" aria-hidden /> 📷 Vyfotit výrobní štítek
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(3)} data-testid="snap-skip-photo">
                Bez fotky
              </Button>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Text štítku (bez AI – opsaný nebo zkopírovaný)</summary>
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground" data-testid="snap-text" />
            </details>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="snap-step-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- náhled fotky z fotoaparátu (blob:)
              <img src={preview} alt="Vyfocený výrobní štítek" className="max-h-40 w-auto self-start rounded-md object-contain" />
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                Riso [MΩ] (volitelně)
                <Input inputMode="decimal" value={riso} onChange={(event) => setRiso(event.target.value)} data-testid="snap-riso" />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                RPE [Ω] (volitelně)
                <Input inputMode="decimal" value={rpe} onChange={(event) => setRpe(event.target.value)} data-testid="snap-rpe" />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" className="h-auto min-h-12 whitespace-normal bg-emerald-600 py-2 font-bold text-white hover:bg-emerald-500" onClick={() => save(true)} data-testid="snap-pass">
                ✅ VYHOVUJE – Riso &gt; 200 MΩ, RPE &lt; 0,3 Ω
              </Button>
              <Button type="button" variant="destructive" className="h-auto min-h-12 whitespace-normal py-2 font-bold" onClick={() => save(false)} data-testid="snap-fail">
                ❌ NEVYHOVUJE – vyřadit z provozu
              </Button>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-1" aria-label="Uložené kusy v místnosti" data-testid="snap-captured" data-count={captured.length}>
          <p className="text-xs font-semibold text-muted-foreground">
            V této smyčce: {captured.length} {captured.length === 1 ? "kus" : captured.length >= 2 && captured.length <= 4 ? "kusy" : "kusů"}
            {saving ? <Loader2 className="ml-1 inline size-3 animate-spin" aria-hidden /> : null}
          </p>
          <ul className="flex flex-col gap-1 text-xs">
            {captured.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-1" data-testid="snap-row" data-status={row.status}>
                <span>{row.passed ? "✅" : "❌"}</span>
                <span className="font-mono">{row.tag ?? "…"}</span>
                <span className="font-mono text-muted-foreground">{row.label ?? "štítek v pořadí"}</span>
                <span className={cn("ml-auto rounded-full px-2", row.status === "sent" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200")}>{row.status === "sent" ? "uloženo" : "📡 ve frontě"}</span>
                {row.warning ? <span className="w-full text-amber-200">{row.warning}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
