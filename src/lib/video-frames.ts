// Snímky z videa rozváděče (fáze 51): průjezd mobilem 5–15 s → 6 rovnoměrně rozložených ostrých
// snímků (JPEG 1920 px, kvalita 0,92) přímo v prohlížeči přes <video> a <canvas> – video se na server
// neposílá. Čisté výpočty (časy, rozměry, ostrost) jsou testovatelné bez DOM.

export const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
export const KEYFRAME_COUNT = 6;
export const FRAME_MAX_SIZE = 1920;
export const FRAME_QUALITY = 0.92;
/** Okolí cílového času [s], ve kterém se hledá nejostřejší snímek (rozmazání pohybem). */
const SHARPNESS_OFFSETS = [0, -0.25, 0.25];

/** `count` rovnoměrně rozložených časů uprostřed úseků videa (bez úplného začátku a konce). */
export function keyframeTimes(durationS: number, count = KEYFRAME_COUNT): number[] {
  if (!(durationS > 0) || count < 1) return [];
  const step = durationS / count;
  return Array.from({ length: count }, (_, index) => Math.round((step * (index + 0.5)) * 1000) / 1000);
}

/** Kandidátní časy pro výběr ostrého snímku v okolí cíle (oříznuté na délku videa). */
export function candidateTimes(target: number, durationS: number): number[] {
  const max = Math.max(0, durationS - 0.05);
  return [...new Set(SHARPNESS_OFFSETS.map((offset) => Math.min(max, Math.max(0, Math.round((target + offset) * 1000) / 1000))))];
}

/** Rozměr snímku: delší strana max. `maxSize` px, poměr stran zachován. */
export function scaledSize(width: number, height: number, maxSize = FRAME_MAX_SIZE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSize / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Ostrost snímku = rozptyl Laplaceova operátoru jasu (vyšší = ostřejší, rozmazaný snímek má malé
 * hrany). `data` je RGBA (ImageData.data) o rozměru `width` × `height`.
 */
export function sharpnessScore(data: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export interface VideoFrame {
  /** Čas snímku ve videu [s]. */
  time: number;
  file: File;
  /** Náhled (blob:) – po použití uvolnit přes `URL.revokeObjectURL`. */
  previewUrl: string;
  sharpness: number;
}

// ---------------------------------------------------------------------------
//  Prohlížeč: <video> + <canvas>
// ---------------------------------------------------------------------------

const seek = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      reject(new Error("Video se nepodařilo přehrát v prohlížeči (zkuste MP4 / H.264)."));
    };
    video.addEventListener("seeked", done);
    video.addEventListener("error", fail);
    video.currentTime = time;
  });

/** Video z prohlížeče připravené ke čtení snímků (metadata načtená). */
export async function loadVideo(source: File | string): Promise<{ video: HTMLVideoElement; release: () => void }> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Video se nepodařilo načíst – podporované jsou MP4, MOV a WebM."));
  });
  return { video, release: () => (typeof source === "string" ? undefined : URL.revokeObjectURL(url)) };
}

/** Ostrost aktuálního snímku na zmenšenině 320 px (rychlé porovnání kandidátů). */
function currentSharpness(video: HTMLVideoElement, canvas: HTMLCanvasElement): number {
  const { width, height } = scaledSize(video.videoWidth, video.videoHeight, 320);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !width) return 0;
  ctx.drawImage(video, 0, 0, width, height);
  return sharpnessScore(ctx.getImageData(0, 0, width, height).data, width, height);
}

/** Aktuální snímek videa jako JPEG (1920 px, 0,92). */
export async function captureFrame(video: HTMLVideoElement, name = "snimek"): Promise<VideoFrame> {
  const { width, height } = scaledSize(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !width) throw new Error("Snímek z videa se nepodařilo zachytit.");
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", FRAME_QUALITY));
  if (!blob) throw new Error("Snímek z videa se nepodařilo uložit.");
  const time = Math.round(video.currentTime * 100) / 100;
  const file = new File([blob], `${name}-${String(time).replace(".", "_")}s.jpg`, { type: "image/jpeg" });
  const probe = document.createElement("canvas");
  return { time, file, previewUrl: URL.createObjectURL(blob), sharpness: currentSharpness(video, probe) };
}

/**
 * 6 rovnoměrně rozložených ostrých snímků: v okolí každého cílového času vybere nejostřejší kandidát
 * (méně rozmazání pohybem) a ten uloží v plném rozlišení.
 */
export async function extractVideoFrames(video: HTMLVideoElement, options: { count?: number; onProgress?: (done: number, total: number) => void } = {}): Promise<VideoFrame[]> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const targets = keyframeTimes(duration, options.count ?? KEYFRAME_COUNT);
  if (!targets.length) throw new Error("Video nemá čitelnou délku.");
  const probe = document.createElement("canvas");
  const frames: VideoFrame[] = [];
  for (const [index, target] of targets.entries()) {
    let best = { time: target, score: -1 };
    for (const time of candidateTimes(target, duration)) {
      await seek(video, time);
      const score = currentSharpness(video, probe);
      if (score > best.score) best = { time, score };
    }
    await seek(video, best.time);
    frames.push(await captureFrame(video, `video-snimek-${index + 1}`));
    options.onProgress?.(index + 1, targets.length);
  }
  return frames;
}
