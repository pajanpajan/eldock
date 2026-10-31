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
