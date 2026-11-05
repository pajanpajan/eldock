"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Film, ImageIcon, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MANUFACTURER_OPTIONS, MIX } from "@/lib/panel-builder/catalog";
import { DEFAULT_RAIL_MODULES } from "@/lib/panel-builder/rails";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { VIDEO_ACCEPT, captureFrame, extractVideoFrames, loadVideo } from "@/lib/video-frames";
import { createPanelProjectAction } from "@/server/actions/panel-builder";
import { createScheduleProjectAction } from "@/server/actions/panel-projects";
import { INSTALL_LEVELS, INSTALL_METHODS, type InstallLevel, type InstallMethod } from "@/engine/floorplan-bridge";
import { SAMPLE_SCHEDULE, type ScheduleRoom } from "@/engine/room-schedule";

import { ScheduleEditor } from "./ScheduleEditor";
import { DEFAULT_SUPPLY, type SupplySystem } from "@/lib/panel-builder/supply";
import { SupplySelect } from "./ProjectAdmin";

const selectClass = "h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
/** Ukázková fotka referenčního rozváděče (seed PB-001). */
export const SAMPLE_PHOTO = "/api/files/photos/seed/panel-pb-001.svg";

type Mode = "DESIGN" | "PHOTO" | "SCHEDULE";

const MODES: { value: Mode | "FLOORPLAN"; icon: string; title: string; text: string }[] = [
  { value: "DESIGN", icon: "📐", title: "Navrhnout od nuly (CAD)", text: "Čisté 2D vektorové plátno s DIN lištami." },
  { value: "PHOTO", icon: "📷", title: "Pasport z fotek nebo 🎥 videa (AI Vision)", text: "Rozpoznání přístrojů z 1 až N fotek nebo z videa." },
  { value: "SCHEDULE", icon: "🏠", title: "Ze soupisu místností (ČSN 33 2130)", text: "Rychlá tabulka místností, zásuvek a spotřebičů." },
  { value: "FLOORPLAN", icon: "🗺️", title: "2D půdorys & kabeláž", text: "Vizuální kreslení půdorysu a výpočet kabelů." },
];

const HINTS: Record<Mode, string> = {
  DESIGN: "Čisté 2D vektorové plátno s 1 DIN lištou 12M – přístroje vkládáte z databáze prvků.",
  PHOTO: "Nahrajte celkovou fotku otevřeného rozváděče a libovolný počet detailů DIN lišt – nebo krátké video (5–15 s průjezd mobilem). AI spojí topologii z celkového pohledu s ostrými hodnotami z detailů.",
  SCHEDULE: "Zadejte místnosti, vzdálenost od rozváděče, zásuvky, světla a spotřebiče. Okruhy, chrániče, fáze, lišty i skříň navrhne výpočet dle ČSN 33 2130 ed. 4.",
};

/** Snímek k analýze: nahraná fotka nebo snímek z videa. */
interface Shot {
  id: string;
  url: string;
  preview: string;
  name: string;
  source: "photo" | "video" | "sample";
  /** Lišta, kterou detail zobrazuje (0 = nepoužít jako detail). */
  rail: number;
}

let shotSequence = 0;
const shotId = () => `s${++shotSequence}`;

/** Nový projekt rozváděče: návrh od nuly, pasport z fotek / videa, soupis místností nebo 2D půdorys. */
export function NewProjectDialog({ credits = null }: { credits?: number | null }) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supply, setSupply] = useState<SupplySystem["id"]>(DEFAULT_SUPPLY.id);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("DESIGN");
  const [shots, setShots] = useState<Shot[]>([]);
  const [mainId, setMainId] = useState<string | null>(null);
  const [video, setVideo] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [rooms, setRooms] = useState<ScheduleRoom[]>(SAMPLE_SCHEDULE);
  const [installMode, setInstallMode] = useState<InstallLevel>("classic");
  const [installMethod, setInstallMethod] = useState<InstallMethod>("C");
  const [countDoubleAsTwo, setCountDoubleAsTwo] = useState(true);
  const design = mode === "DESIGN";
  const schedule = mode === "SCHEDULE";
  const main = shots.find((shot) => shot.id === mainId) ?? null;
  const details = shots.filter((shot) => shot.id !== mainId && shot.rail > 0);

  // Uvolnění náhledů (blob:) a videa
  useEffect(() => () => void (video && URL.revokeObjectURL(video.url)), [video]);

  /** Nové snímky: první se stane celkovým pohledem, ostatní detaily lišt v pořadí 1, 2, 3 … */
  function addShots(added: Omit<Shot, "rail">[]) {
    let nextRail = Math.max(0, ...shots.map((shot) => shot.rail));
    const hasMain = shots.some((shot) => shot.id === mainId);
    const rows = added.map((shot, index) => ({ ...shot, rail: !hasMain && index === 0 ? 0 : ++nextRail }));
    if (!hasMain && rows[0]) setMainId(rows[0].id);
    setShots((current) => [...current, ...rows]);
  }

  async function pickPhotos(files: File[]) {
    setBusy(`Nahrávám ${files.length} ${files.length === 1 ? "fotku" : files.length < 5 ? "fotky" : "fotek"}…`);
    try {
      const uploaded = [];
      for (const file of files) {
        const resized = await resizeImage(file, 2400, 0.92);
        const result = await uploadFile("photo", resized);
        uploaded.push({ id: shotId(), url: result.url, preview: result.url, name: file.name, source: "photo" as const });
      }
      addShots(uploaded);
    } catch {
      toast.error("Fotku se nepodařilo nahrát.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadFrames(frames: { file: File; time: number }[]) {
    const uploaded = [];
    for (const frame of frames) {
      const result = await uploadFile("photo", frame.file);
      uploaded.push({ id: shotId(), url: result.url, preview: result.url, name: `Snímek ${frame.time.toLocaleString("cs-CZ")} s`, source: "video" as const });
    }
    addShots(uploaded);
  }

  async function pickVideo(file: File) {
    const url = URL.createObjectURL(file);
    setVideo({ url, name: file.name });
    setBusy("Vybírám 6 ostrých snímků z videa…");
    let release: (() => void) | null = null;
    try {
      const loaded = await loadVideo(url);
      release = loaded.release;
      const frames = await extractVideoFrames(loaded.video, { onProgress: (done, total) => setBusy(`Snímky z videa: ${done} / ${total}…`) });
      setBusy("Nahrávám snímky z videa…");
      await uploadFrames(frames);
      for (const frame of frames) URL.revokeObjectURL(frame.previewUrl);
      toast.success(`Z videa vybráno ${frames.length} ostrých snímků. Označte celkový pohled a lišty detailů.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video se nepodařilo zpracovat.");
    } finally {
      release?.();
      setBusy(null);
    }
  }

  async function captureCurrent() {
    const element = videoRef.current;
    if (!element) return;
    setBusy("Ukládám snímek z videa…");
    try {
      const frame = await captureFrame(element, "video-snimek");
      URL.revokeObjectURL(frame.previewUrl);
      await uploadFrames([frame]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Snímek se nepodařilo zachytit.");
    } finally {
      setBusy(null);
    }
  }

  function useSample() {
    const sample = { id: shotId(), url: SAMPLE_PHOTO, preview: SAMPLE_PHOTO, name: "Ukázková fotka", source: "sample" as const, rail: 0 };
    setShots((current) => [sample, ...current.filter((shot) => shot.source !== "sample")]);
    setMainId(sample.id);
  }

  function removeShot(id: string) {
    setShots((current) => current.filter((shot) => shot.id !== id));
    if (id === mainId) setMainId(shots.find((shot) => shot.id !== id)?.id ?? null);
  }

  function submit(form: FormData) {
    const header = { name: String(form.get("name") ?? ""), customerName: String(form.get("customer") ?? "") || null, installationSite: String(form.get("site") ?? "") || null, supplySystem: supply };
    if (schedule) {
      startTransition(async () => {
        const result = await createScheduleProjectAction({ ...header, mode: installMode, installMethod, countDoubleAsTwo, rooms });
        if (!result.ok) return void toast.error(result.error);
        toast.success(`Rozváděč vygenerován: ${result.data.circuits} okruhů, ${result.data.devices} přístrojů${result.data.enclosure ? `, skříň ${result.data.enclosure}` : ""}.`);
        for (const warning of result.data.warnings.slice(0, 3)) toast.warning(warning);
        setOpen(false);
        router.push(`/panel-builder/${result.data.id}`);
      });
      return;
    }
    const railPhotos = design ? [] : details.map((shot) => ({ rail: shot.rail, url: shot.url }));
    startTransition(async () => {
      const result = await createPanelProjectAction({
        ...header,
        photoUrl: design ? null : (main?.url ?? null),
        dominantManufacturer: design ? MIX : String(form.get("manufacturer") ?? MIX),
        dinRailsCount: design ? 1 : Math.max(Number(form.get("rails")), ...railPhotos.map((photo) => photo.rail)),
        modulesPerRail: design ? DEFAULT_RAIL_MODULES : Number(form.get("modules")),
        designMode: design ? "DESIGN" : "PHOTO",
        railPhotos,
      });
      if (!result.ok) return void toast.error(result.error);
      if (result.data.design) toast.success("Návrh založen – 1 DIN lišta 12M, vkládejte přístroje z pravého menu.");
      else toast.success(`${result.data.mode === "GEMINI" ? "Fotka analyzována přes Gemini" : "Fotka analyzována (Demo AI režim)"}${result.data.details ? ` + ${result.data.details} ${result.data.details === 1 ? "detail lišty" : "detaily lišt"}` : ""}.`);
      if (result.data.warning) toast.warning(result.data.warning);
      setOpen(false);
      router.push(`/panel-builder/${result.data.id}`);
    });
  }

  // Bez kreditů: místo dialogu rovnou dobití kreditů (fáze 50)
  if (credits !== null && credits <= 0) {
    return (
      <Button asChild className="touch-target gap-2" title="Došly kredity – dobijte balíček">
        <Link href="/panel-builder/credits?reason=no-credits">
          <Plus className="size-4" aria-hidden /> Nový projekt rozváděče
        </Link>
      </Button>
    );
  }

  const railOptions = Array.from({ length: 12 }, (_, index) => index + 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="touch-target gap-2" title={credits !== null ? `Spotřebuje 1 kredit (zbývá ${credits})` : undefined}>
          <Plus className="size-4" aria-hidden /> Nový projekt rozváděče
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto", schedule || mode === "PHOTO" ? "sm:max-w-3xl" : "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>Nový projekt rozváděče</DialogTitle>
          <DialogDescription>{HINTS[mode]}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Režim projektu" data-testid="project-modes">
          {MODES.map((option) => {
            const content = (
              <>
                <span className="text-2xl leading-none" aria-hidden>
                  {option.icon}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-bold text-foreground">{option.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">{option.text}</span>
                </span>
              </>
            );
            const cardClass = "touch-target flex min-h-20 items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors";
            if (option.value === "FLOORPLAN") {
              return (
                <Link key={option.value} href="/panel-builder/floorplan" onClick={() => setOpen(false)} className={cn(cardClass, "border-dashed border-border hover:border-primary/60")} aria-label={option.title}>
                  {content}
                </Link>
              );
            }
            const value = option.value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                aria-label={option.title}
                onClick={() => setMode(value)}
                className={cn(cardClass, mode === value ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")}
              >
                {content}
              </button>
            );
          })}
        </div>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-name">Název rozváděče</Label>
            <Input id="pb-name" name="name" required maxLength={120} placeholder={design ? "např. Rozvodnice RD1 – rodinný dům" : "např. Podružný rozváděč RP2 – dílna"} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pb-customer">Zákazník / objekt</Label>
              <Input id="pb-customer" name="customer" maxLength={120} placeholder="nepovinné" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pb-site">Místo instalace</Label>
              <Input id="pb-site" name="site" maxLength={120} placeholder="nepovinné, např. Liberec, Husova 5" />
            </div>
          </div>
          {/* Fáze 55: soustava a počet fází přívodu (1f = 2P hlavní vypínač, 1f svodič, 2P chrániče, vše na L1) */}
          <SupplySelect id="pb-supply" value={supply} onChange={setSupply} />
          {schedule ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Label htmlFor="pb-install">Úroveň instalace</Label>
                <select id="pb-install" className={selectClass} value={installMode} onChange={(event) => setInstallMode(event.target.value as InstallLevel)}>
                  {INSTALL_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <Label htmlFor="pb-method">Uložení kabelů</Label>
                <select id="pb-method" className={selectClass} value={installMethod} onChange={(event) => setInstallMethod(event.target.value as InstallMethod)}>
                  {INSTALL_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={countDoubleAsTwo} onChange={(event) => setCountDoubleAsTwo(event.target.checked)} />
                  Počítat dvojzásuvku jako 2 zásuvky dle ČSN 33 2130 ed. 4
                </label>
              </div>
              <p className="text-xs text-muted-foreground">{INSTALL_LEVELS.find((level) => level.id === installMode)?.description}</p>
              <ScheduleEditor rooms={rooms} onChange={setRooms} />
            </div>
          ) : design ? (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Začínáte s <b className="text-foreground">1 DIN lištou na 12 modulů</b>. Šířku řady (8–36M) i další lišty nastavíte přímo na plátně, skříň vyberete podle velikosti návrhu.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pb-manufacturer">Převažující výrobce (nápověda pro AI)</Label>
                  <select id="pb-manufacturer" name="manufacturer" className={selectClass} defaultValue={MIX}>
                    {MANUFACTURER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pb-rails">DIN lišt</Label>
                  <Input id="pb-rails" name="rails" type="number" min={1} max={12} defaultValue={3} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pb-modules">Modulů na lištu</Label>
                  <Input id="pb-modules" name="modules" type="number" min={4} max={48} defaultValue={12} />
                </div>
              </div>

              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Fotky rozváděče"
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  event.target.value = "";
                  if (files.length) void pickPhotos(files);
                }}
              />
              <input
                ref={videoInput}
                type="file"
                accept={VIDEO_ACCEPT}
                className="sr-only"
                aria-label="Video rozváděče"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void pickVideo(file);
                }}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button type="button" variant="outline" className="touch-target h-14 gap-2" onClick={() => photoInput.current?.click()} disabled={busy !== null}>
                  <Camera className="size-4" aria-hidden /> Fotky (1 celková + detaily)
                </Button>
                <Button type="button" variant="outline" className="touch-target h-14 gap-2" onClick={() => videoInput.current?.click()} disabled={busy !== null}>
                  <Film className="size-4" aria-hidden /> Video (MP4 / MOV / WebM)
                </Button>
                <Button type="button" variant="outline" className={cn("touch-target h-14 gap-2", main?.source === "sample" && "border-primary")} onClick={useSample} disabled={busy !== null}>
                  <ImageIcon className="size-4" aria-hidden /> Ukázková fotka
                </Button>
              </div>
              {busy ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> {busy}
                </p>
              ) : null}

              {video ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-2" data-testid="video-preview">
                  <video ref={videoRef} src={video.url} controls muted playsInline className="max-h-56 w-full rounded bg-black" aria-label={`Video ${video.name}`} />
                  <Button type="button" size="sm" variant="secondary" className="gap-1.5 self-start" onClick={() => void captureCurrent()} disabled={busy !== null}>
                    📸 Zachytit aktuální snímek z videa
                  </Button>
                </div>
              ) : null}

              {shots.length ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="project-shots" aria-label="Snímky k analýze">
                  {shots.map((shot) => {
                    const isMain = shot.id === mainId;
                    return (
                      <li key={shot.id} className={cn("flex flex-col gap-1 rounded-lg border-2 p-1.5", isMain ? "border-primary" : "border-border")} data-shot={isMain ? "main" : shot.rail ? `rail-${shot.rail}` : "unused"}>
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element -- nahraný snímek z /api/files */}
                          <img src={shot.preview} alt={shot.name} className="aspect-video w-full rounded bg-zinc-900 object-cover" />
                          <button type="button" onClick={() => removeShot(shot.id)} className="absolute top-1 right-1 rounded bg-black/70 p-0.5 text-white hover:bg-red-600" aria-label={`Odebrat ${shot.name}`}>
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </div>
                        <span className="truncate text-[11px] text-muted-foreground">{shot.name}</span>
                        <label className="flex items-center gap-1.5 text-xs">
                          <input type="radio" name="main-shot" checked={isMain} onChange={() => setMainId(shot.id)} />
                          Celkový pohled
                        </label>
                        {!isMain ? (
                          <select
                            value={shot.rail}
                            onChange={(event) => setShots((current) => current.map((row) => (row.id === shot.id ? { ...row, rail: Number(event.target.value) } : row)))}
                            className="h-7 rounded border border-input bg-transparent px-1 text-xs dark:bg-input/30"
                            aria-label={`Detail lišty – ${shot.name}`}
                          >
                            <option value={0}>nepoužít</option>
                            {railOptions.map((rail) => (
                              <option key={rail} value={rail}>
                                Detail lišty {rail}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {main ? (
                <p className="text-xs text-muted-foreground" data-testid="shots-summary">
                  Celkový pohled: {main.name}
                  {details.length ? ` · detaily lišt: ${details.map((shot) => shot.rail).sort((a, b) => a - b).join(", ")}` : " · bez detailů lišt"}
                </p>
              ) : null}
            </>
          )}

          <Button type="submit" className="touch-target gap-2" disabled={pending || busy !== null || (mode === "PHOTO" && !main) || (schedule && !rooms.length)}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {schedule ? "🏠 Vygenerovat rozváděč" : design ? "📐 Založit návrh rozváděče" : "Založit a analyzovat fotku"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
