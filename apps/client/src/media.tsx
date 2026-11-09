// Fáze 71 a 73: kamera v aplikaci – skenování QR štítků (jsQR, i bez internetu) a fotky k úpravám. Čtečky
// čárových kódů (klávesnice) píšou rovnou do vyhledávání. Mobilní aplikace skenuje nativně (src/scan.tsx) a tento
// dialog je záloha; fotky na telefonu fotí systémový fotoaparát (pole souboru s `capture`).

import jsQR from "jsqr";
import { Camera, ImagePlus, QrCode, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import type { SyncEngine } from "@/sync-client";
import { photoFileName } from "@/sync-client";

import { bridge, touchUi } from "./bridge";
import { Button, Dialog, inputClass } from "./ui";

const MAX_SIDE = 2560;

/** Fotka pro server: JPG / PNG / WebP, velké zmenšit (nejdelší strana 2560 px, JPG 85 %); jiný obrázek, který systém
 * umí přečíst (HEIC z iPhonu), převést na JPG. */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const supported = /^image\/(jpeg|png|webp)$/.test(file.type);
  if (!supported && file.type && !file.type.startsWith("image/")) throw new Error("Fotka musí být JPG, PNG nebo WebP.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if (supported) return file;
    throw new Error("Fotka musí být JPG, PNG nebo WebP.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (supported && scale === 1 && file.size <= 3 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}

/** Fotky → místní odkazy a přílohy úpravy (nahrají se při synchronizaci). */
export async function photoAttachments(engine: SyncEngine, photos: Blob[]) {
  const attachments = [];
  for (const [index, photo] of photos.entries()) {
    const fileName = photoFileName(photo.type, `foto-${index + 1}`);
    const url = await engine.addLocalFile(photo, { kind: "photo", name: fileName });
    attachments.push({ url, type: "PHOTO" as const, fileName, mimeType: photo.type || "image/jpeg", sizeBytes: photo.size });
  }
  return attachments;
}

const CAMERA_SETTINGS: Record<string, string> = {
  windows: "v nastavení Windows (Soukromí → Fotoaparát)",
  android: "v Nastavení → Aplikace → Eldock → Oprávnění",
  ios: "v Nastavení → Eldock → Fotoaparát",
  web: "v nastavení prohlížeče",
};

const cameraError = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return `Přístup ke kameře je zakázaný – povolte ho ${CAMERA_SETTINGS[bridge.kind] ?? CAMERA_SETTINGS.web}.`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return bridge.mobile ? "Kameru se nepodařilo najít – opište text štítku nebo označení zařízení." : "Počítač nemá kameru – použijte čtečku čárových kódů nebo opište označení.";
  if (name === "NotReadableError") return "Kameru používá jiná aplikace – zavřete ji a zkuste to znovu.";
  return "Kameru se nepodařilo spustit.";
};

function useCamera(active: boolean, deviceId: string | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<{ error: string | null; devices: MediaDeviceInfo[]; ready: boolean }>({ error: null, devices: [], ready: false });
  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const video = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } };
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then(async (opened) => {
        if (cancelled) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        if (videoRef.current) {
          videoRef.current.srcObject = opened;
          await videoRef.current.play().catch(() => undefined);
        }
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        if (!cancelled) setState({ error: null, devices, ready: true });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ error: cameraError(error), devices: [], ready: false });
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, deviceId]);
  return [videoRef, state] as const;
}

type CameraState = { error: string | null; devices: MediaDeviceInfo[]; ready: boolean };

function CameraView({ videoRef, state, deviceId, onDevice }: { videoRef: RefObject<HTMLVideoElement | null>; state: CameraState; deviceId: string | null; onDevice: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        {state.error ? <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-300">{state.error}</p> : null}
      </div>
      {state.devices.length > 1 ? (
        <select className={inputClass} value={deviceId ?? ""} onChange={(event) => onDevice(event.target.value)} aria-label="Kamera">
          <option value="">Výchozí kamera</option>
          {state.devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Kamera ${index + 1}`}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

/** Text štítku přijatý (`true` = zavřít), nebo ne – skenování pokračuje (stejný text se 3 s neopakuje). */
export type ScanHandler = (text: string) => boolean | Promise<boolean>;

/** Skenování QR štítku kamerou; text štítku i ručně (opsaný kód nebo označení zařízení). */
export function ScanDialog({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: ScanHandler }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [videoRef, cameraState] = useCamera(open, deviceId);

  useEffect(() => {
    if (!open) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let timer = 0;
    let stopped = false;
    let last = { text: "", at: 0 };
    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && context && video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 960 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
        if (code?.data && !(code.data === last.text && Date.now() - last.at < 3000)) {
          last = { text: code.data, at: Date.now() };
          void Promise.resolve(onScan(code.data)).then((accepted) => {
            if (!accepted && !stopped) timer = window.setTimeout(tick, 600);
          });
          return;
        }
      }
      timer = window.setTimeout(tick, 200);
    };
    tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [open, onScan, videoRef]);

  return (
    <Dialog open={open} title="Skenovat QR štítek" onClose={onClose} wide testId="scan-dialog">
      <CameraView videoRef={videoRef} state={cameraState} deviceId={deviceId} onDevice={(id) => setDeviceId(id || null)} />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <QrCode className="size-4 shrink-0" aria-hidden />
        Namiřte kameru na QR štítek – funguje i bez internetu.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim()) void onScan(manual.trim());
        }}
      >
        <input className={inputClass} value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Nebo vložte text štítku / označení zařízení" aria-label="Text štítku" />
        <Button type="submit" variant="outline">
          Najít
        </Button>
      </form>
    </Dialog>
  );
}

/** Fotka webkamerou. */
function CaptureDialog({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (photo: Blob) => void }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [videoRef, cameraState] = useCamera(open, deviceId);
  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.9);
  };
  return (
    <Dialog
      open={open}
      title="Vyfotit"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={capture} disabled={!cameraState.ready} data-autofocus>
            <Camera className="size-4" aria-hidden />
            Vyfotit
          </Button>
        </>
      }
    >
      <CameraView videoRef={videoRef} state={cameraState} deviceId={deviceId} onDevice={(id) => setDeviceId(id || null)} />
    </Dialog>
  );
}

/** Výběr fotek k úpravě: ze souboru nebo webkamerou (na telefonu fotoaparátem nebo z galerie), náhledy s odebráním. */
export function PhotoField({ photos, onChange, max = 6, label = "Fotky" }: { photos: Blob[]; onChange: (photos: Blob[]) => void; max?: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const add = async (files: Blob[]) => {
    setError(null);
    try {
      const prepared = await Promise.all(files.map(preparePhoto));
      onChange([...photos, ...prepared].slice(0, max));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Fotku se nepodařilo přidat.");
    }
  };

  return (
    <div className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      {photos.length ? (
        <div className="flex flex-wrap gap-2" data-testid="photo-previews">
          {previews.map((url, index) => (
            <div key={url} className="relative">
              <img src={url} alt={`Fotka ${index + 1}`} className="size-20 rounded-md border border-border object-cover" />
              <button type="button" className="absolute -top-2 -right-2 rounded-full border border-border bg-card p-1 text-muted-foreground hover:text-red-300" onClick={() => onChange(photos.filter((_, other) => other !== index))} aria-label={`Odebrat fotku ${index + 1}`}>
                <Trash2 className="size-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {photos.length < max ? (
        <div className="flex flex-wrap gap-2">
          {touchUi ? (
            <>
              {/* Android otevře fotoaparát jen pro accept="image/*" s capture */}
              <Button variant="outline" onClick={() => cameraInput.current?.click()} data-testid="photo-camera">
                <Camera className="size-4" aria-hidden />
                Vyfotit
              </Button>
              <Button variant="outline" onClick={() => input.current?.click()}>
                <ImagePlus className="size-4" aria-hidden />
                Z galerie
              </Button>
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length) void add(files);
                }}
              />
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
                <ImagePlus className="size-4" aria-hidden />
                Přidat fotku
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCapturing(true)}>
                <Camera className="size-4" aria-hidden />
                Vyfotit webkamerou
              </Button>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            hidden
            data-testid="photo-input"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length) void add(files);
            }}
          />
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <CaptureDialog
        open={capturing}
        onClose={() => setCapturing(false)}
        onCapture={(photo) => {
          setCapturing(false);
          void add([photo]);
        }}
      />
    </div>
  );
}
