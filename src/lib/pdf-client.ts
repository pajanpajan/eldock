// pdf.js v prohlížeči: vykreslení stránky PDF do obrázku (porovnání revizí, interaktivní výkres).
// Worker se přibalí přes `new Worker(new URL(...))` – žádné CDN.

import type { PDFDocumentProxy } from "pdfjs-dist";

let library: Promise<typeof import("pdfjs-dist")> | null = null;
const documents = new Map<string, Promise<PDFDocumentProxy>>();
const pages = new Map<string, Promise<RenderedPage>>();

function pdfjs() {
  library ??= import("pdfjs-dist").then((pdf) => {
    pdf.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    return pdf;
  });
  return library;
}

export function loadPdf(url: string): Promise<PDFDocumentProxy> {
  let doc = documents.get(url);
  if (!doc) {
    doc = pdfjs().then((pdf) => pdf.getDocument({ url, verbosity: 0 }).promise);
    doc.catch(() => documents.delete(url));
    documents.set(url, doc);
  }
  return doc;
}

export interface RenderedPage {
  /** PNG jako object URL (pro `<img>` i načtení do plátna). */
  src: string;
  width: number;
  height: number;
  pageCount: number;
}

/** Vykreslí stránku (od 1) v šířce `width` px; výsledky se cachují. */
export function renderPdfPage(url: string, pageNumber: number, width = 1600): Promise<RenderedPage> {
  const key = `${url}#${pageNumber}@${width}`;
  let rendered = pages.get(key);
  if (!rendered) {
    rendered = (async () => {
      const doc = await loadPdf(url);
      const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages));
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Plátno není k dispozici.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Stránku se nepodařilo vykreslit.");
      return { src: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, pageCount: doc.numPages };
    })();
    rendered.catch(() => pages.delete(key));
    pages.set(key, rendered);
  }
  return rendered;
}

/**
 * Fáze 57: stránka PDF ze souboru (podklad půdorysu) – pdf.js dostane přímo data souboru (bez blob URL a cache).
 * Fáze 113: vykreslí se do plátna s delší stranou `maxSide` px (kódování WebP / JPEG řeší `encodeBackground`)
 * a z textové vrstvy se přečtou popisky místností (čísla 1.01, názvy, výměry m²) v px plátna.
 */
export async function renderPdfBackground(
  file: Blob,
  options: { pageNumber?: number; maxSide?: number; keepText?: (text: string) => boolean; maxLabels?: number } = {},
): Promise<{ canvas: HTMLCanvasElement; pageCount: number; pagePt: { width: number; height: number }; labels: { text: string; x: number; y: number; h: number }[] }> {
  const pdf = await pdfjs();
  const task = pdf.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(Math.min(Math.max(1, options.pageNumber ?? 1), doc.numPages));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (options.maxSide ?? 2400) / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Plátno není k dispozici.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const labels: { text: string; x: number; y: number; h: number }[] = [];
    try {
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const text = item.str.replace(/\s+/g, " ").trim();
        if (options.keepText && !options.keepText(text)) continue;
        const [a, b, c, d, e, f] = item.transform as number[];
        // Jen vodorovný text (popisky místností); otočené kóty se přeskočí
        if (Math.abs(b) > Math.abs(a) * 0.2 || Math.abs(c) > Math.abs(d) * 0.2) continue;
        const height = Math.hypot(c, d) * viewport.scale;
        const width = (item.width || text.length * Math.abs(a) * 0.5) * viewport.scale;
        const [x, y] = viewport.convertToViewportPoint(e, f);
        labels.push({ text: text.slice(0, 80), x: Math.round((x + width / 2) * 10) / 10, y: Math.round((y - height / 2) * 10) / 10, h: Math.round(height * 10) / 10 });
        if (labels.length >= (options.maxLabels ?? 400)) break;
      }
    } catch {
      // PDF bez textové vrstvy (sken) – místnosti se rozpoznají jen z rastru
    }
    return { canvas, pageCount: doc.numPages, pagePt: { width: base.width, height: base.height }, labels };
  } finally {
    void task.destroy();
  }
}

/**
 * Text PDF po stránkách a řádcích (útržky se stejnou svislou polohou = jeden řádek) – podklad pro
 * atomizaci datasheetů a kusovníků. Nejvýše `maxPages` stran.
 */
export async function extractPdfText(url: string, maxPages = 80): Promise<string[][]> {
  const doc = await loadPdf(url);
  const result: string[][] = [];
  for (let number = 1; number <= Math.min(doc.numPages, maxPages); number++) {
    const content = await (await doc.getPage(number)).getTextContent();
    const lines = new Map<number, string>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      lines.set(y, `${lines.get(y) ?? ""} ${item.str}`);
    }
    result.push(
      [...lines]
        .sort((a, b) => b[0] - a[0])
        .map(([, text]) => text.replace(/\s+/g, " ").trim().slice(0, 2000))
        .filter(Boolean)
        .slice(0, 400),
    );
  }
  return result;
}
