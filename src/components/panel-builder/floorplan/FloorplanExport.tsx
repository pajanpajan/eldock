"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applianceSpecFor } from "@/lib/panel-builder/appliances";
import { floorplanDxf } from "@/lib/panel-builder/dxf-export";
import { paletteItem, symbolSizeOf, type FloorplanDraft, type PaletteItem, type analyzeDraft } from "@/lib/panel-builder/floorplan-editor";
import { polygonArea, roomPolygon } from "@/lib/panel-builder/room-geometry";
import { displayRoutes } from "@/lib/panel-builder/route-display";
import { productById } from "@/lib/panel-builder/smart-catalog";

import { AnnotationShape, HatchPatterns } from "./AnnotationLayer";
import { FixtureShape } from "./FixtureShape";
import { FloorSymbol, PanelSymbol } from "./FloorSymbol";
import { RouteLayer } from "./RouteLayer";

/**
 * Fáze 63: export výkresu elektroinstalace aktivního podlaží. PDF = tiskový list A3 / A4 na šířku ve skutečném
 * měřítku (1 : 20 … 1 : 500 podle velikosti půdorysu) s normovým značením tras (rysky žil, štítky okruhů), legendou
 * značek ČSN EN 60617-11, tabulkou okruhů a metráže a rohovým razítkem – tisk prohlížeče „Uložit jako PDF“ zachová
 * vektorovou kresbu. DXF = `floorplanDxf` (hladiny, mm 1 : 1) ke stažení.
 */

type Analysis = ReturnType<typeof analyzeDraft>;

const PAPERS = { A3: { w: 420, h: 297 }, A4: { w: 297, h: 210 } } as const;
type Paper = keyof typeof PAPERS;
const SCALES = [20, 25, 50, 75, 100, 150, 200, 250, 500];
const MARGIN = 8;
const COLUMN = 92;

interface SheetFields {
  project: string;
  investor: string;
  site: string;
  author: string;
  number: string;
}

/** Zobrazovaný prvek (spotřebič z knihovny, výrobek z lišty výrobců). */
function itemOf(draft: FloorplanDraft, element: FloorplanDraft["elements"][number]): PaletteItem | null {
  const base = paletteItem(element.item);
  if (!base) return null;
  if (base.kind === "appliance") {
    const spec = applianceSpecFor(draft.appliances, element);
    return spec ? { ...base, label: spec.label, symbol: spec.symbol } : base;
  }
  const product = productById(element.product);
  return product ? { ...base, label: product.label, ...(product.noBus ? { wireless: true } : {}) } : base;
}

/** Obálka obsahu výkresu (místnosti, prvky, zakreslené změny) s okrajem. */
function contentBox(draft: FloorplanDraft) {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const room of draft.rooms) for (const point of roomPolygon(room)) add(point.x, point.y);
  for (const element of draft.elements) add(element.x, element.y);
  for (const note of draft.annotations) {
    add(note.x, note.y);
    add(note.x2, note.y2);
  }
  if (!xs.length) return { x: 0, y: 0, w: draft.widthMm, h: draft.heightMm };
  const pad = 800;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

export function sheetScale(box: { w: number; h: number }, paper: Paper) {
  const drawW = PAPERS[paper].w - MARGIN * 2 - COLUMN;
  const drawH = PAPERS[paper].h - MARGIN * 2;
  return SCALES.find((scale) => box.w / scale <= drawW && box.h / scale <= drawH) ?? SCALES[SCALES.length - 1];
}

function PlanSheet({ draft, analysis, paper, fields }: { draft: FloorplanDraft; analysis: Analysis | null; paper: Paper; fields: SheetFields }) {
  const size = PAPERS[paper];
  const drawW = size.w - MARGIN * 2 - COLUMN;
  const drawH = size.h - MARGIN * 2;
  const box = contentBox(draft);
  const scale = sheetScale(box, paper);
  const view = { w: drawW * scale, h: drawH * scale };
  const origin = { x: box.x - (view.w - box.w) / 2, y: box.y - (view.h - box.h) / 2 };
  const unit = 4 * scale;
  const stroke = 0.15 * scale;
  const routes = analysis ? displayRoutes(draft, analysis) : { circuits: [], bus: null };
  const legend = [...new Map(draft.elements.map((element) => [element.item === "appliance" ? `${element.item}:${element.appliance}` : element.item, element] as const)).values()]
    .map((element) => ({ element, item: itemOf(draft, element) }))
    .filter((entry): entry is { element: FloorplanDraft["elements"][number]; item: PaletteItem } => entry.item !== null);
  const today = new Date().toLocaleDateString("cs-CZ");
  return (
    <div className="fp-sheet" style={{ width: `${size.w - MARGIN * 2}mm`, height: `${size.h - MARGIN * 2}mm`, display: "flex", gap: "3mm", fontFamily: "Arial, Helvetica, sans-serif", color: "#111827", background: "#fff" }} data-testid="print-sheet" data-paper={paper} data-scale={scale}>
      <svg width={`${drawW}mm`} height={`${drawH}mm`} viewBox={`${origin.x} ${origin.y} ${view.w} ${view.h}`} style={{ border: "0.3mm solid #111827", flexShrink: 0 }} role="img" aria-label={`Půdorys elektroinstalace ${draft.floorName} 1 : ${scale}`}>
        <defs>
          <HatchPatterns notes={draft.annotations} extra={[]} />
        </defs>
        <rect x={origin.x} y={origin.y} width={view.w} height={view.h} fill="#fff" />
        {draft.rooms.map((room) => {
          const polygon = roomPolygon(room);
          return (
            <g key={room.id}>
              <polygon points={polygon.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#111827" strokeWidth={0.5 * scale} strokeLinejoin="miter" />
              <text x={room.x + unit * 0.4} y={room.y + unit * 0.9} fontSize={2.6 * scale} fill="#374151">
                {room.name} · {(polygonArea(polygon) / 1e6).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m²
              </text>
            </g>
          );
        })}
        {draft.annotations.map((note) => (
          <AnnotationShape key={note.id} note={note} unit={unit} selected={false} interactive={false} />
        ))}
        {draft.elements
          .filter((element) => paletteItem(element.item)?.kind === "fixture")
          .map((element) => (
            <FixtureShape key={element.id} element={element} active={false} onPaper unit={unit} interactive={false} />
          ))}
        <RouteLayer circuits={routes.circuits} bus={routes.bus} view="cad" onPaper unit={unit} stroke={stroke} />
        {draft.elements.flatMap((element) =>
          element.controls.map((lightId) => {
            const light = draft.elements.find((candidate) => candidate.id === lightId);
            return light ? <line key={`${element.id}-${lightId}`} x1={element.x} y1={element.y} x2={light.x} y2={light.y} stroke="#6b7280" strokeWidth={stroke * 1.2} strokeDasharray={`${unit / 4} ${unit / 4}`} /> : null;
          }),
        )}
        {draft.elements.map((element) => {
          const item = itemOf(draft, element);
          if (!item || item.kind === "fixture") return null;
          const symbol = symbolSizeOf(draft, element);
          return (
            <g key={element.id} transform={`translate(${element.x} ${element.y})`}>
              {item.kind === "panel" ? <PanelSymbol size={symbol * 1.3} active={false} onPaper label={item.symbol} /> : <FloorSymbol item={item} size={symbol} active={false} onPaper rotation={element.rotation} level={draft.installation} />}
            </g>
          );
        })}
      </svg>
      <div style={{ width: `${COLUMN}mm`, display: "flex", flexDirection: "column", gap: "2mm", fontSize: "2.5mm", lineHeight: 1.25 }}>
        <section>
          <h2 style={{ fontSize: "3.2mm", fontWeight: 700, margin: 0 }}>Legenda značek (ČSN EN 60617-11)</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "1mm 0 0", display: "grid", gap: "0.6mm" }}>
            {legend.map(({ element, item }) => (
              <li key={`${item.id}:${element.appliance ?? ""}`} style={{ display: "flex", alignItems: "center", gap: "1.5mm" }}>
                <svg width="7mm" height="7mm" viewBox="-450 -450 900 900" style={{ flexShrink: 0 }} aria-hidden>
                  {item.kind === "panel" ? <PanelSymbol size={390} active={false} onPaper label={item.symbol} /> : item.kind === "fixture" ? <rect x={-350} y={-250} width={700} height={500} fill="none" stroke="#111827" strokeWidth={30} /> : <FloorSymbol item={item} size={300} active={false} onPaper level={draft.installation} />}
                </svg>
                <span>{item.label}</span>
              </li>
            ))}
            <li style={{ display: "flex", alignItems: "center", gap: "1.5mm" }}>
              <svg width="7mm" height="3mm" viewBox="0 0 70 30" aria-hidden>
                <line x1={0} y1={15} x2={70} y2={15} stroke="#111827" strokeWidth={2} />
                {[26, 35, 44].map((x) => (
                  <line key={x} x1={x - 5} y1={22} x2={x + 5} y2={8} stroke="#111827" strokeWidth={2} />
                ))}
              </svg>
              <span>silové vedení – rysky = počet žil (/// 3, ///// 5)</span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "1.5mm" }}>
              <svg width="7mm" height="3mm" viewBox="0 0 70 30" aria-hidden>
                <line x1={0} y1={15} x2={70} y2={15} stroke="#111827" strokeWidth={2} strokeDasharray="10 6" />
              </svg>
              <span>ovládací / sběrnicové vedení 24 V DC, svody k vypínačům</span>
            </li>
          </ul>
        </section>
        <section style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <h2 style={{ fontSize: "3.2mm", fontWeight: 700, margin: 0 }}>Okruhy a metráž</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1mm", fontSize: "2.2mm" }} data-testid="print-circuits">
            <thead>
              <tr style={{ borderBottom: "0.3mm solid #111827", textAlign: "left" }}>
                <th>Okr.</th>
                <th>Popis</th>
                <th>Kabel</th>
                <th style={{ textAlign: "right" }}>m</th>
              </tr>
            </thead>
            <tbody>
              {routes.circuits.map((circuit) => (
                <tr key={circuit.id} style={{ borderBottom: "0.1mm solid #d1d5db" }}>
                  <td>{circuit.designation ?? "–"}</td>
                  <td>{circuit.label}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{circuit.cable}</td>
                  <td style={{ textAlign: "right" }}>{circuit.lengthM.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {analysis ? (
            <p style={{ marginTop: "1mm" }}>
              Celkem k nákupu: {analysis.summary.byCable.map((row) => `${row.cable} ${row.meters} m`).join(" · ")}
            </p>
          ) : null}
        </section>
        <table style={{ width: "100%", borderCollapse: "collapse", border: "0.4mm solid #111827", fontSize: "2.3mm" }} data-testid="title-block">
          <tbody>
            {[
              ["Akce", fields.project],
              ["Investor", fields.investor],
              ["Místo stavby", fields.site],
              ["Vypracoval", fields.author],
              ["Výkres", `Půdorys elektroinstalace – ${draft.floorName}`],
              ["Měřítko · formát", `1 : ${scale} · ${paper}`],
              ["Datum · č. výkresu", `${today} · ${fields.number}`],
            ].map(([label, value]) => (
              <tr key={label} style={{ borderBottom: "0.2mm solid #111827" }}>
                <th style={{ textAlign: "left", fontWeight: 400, color: "#4b5563", padding: "0.4mm 1mm", width: "28mm" }}>{label}</th>
                <td style={{ padding: "0.4mm 1mm", fontWeight: label === "Výkres" ? 700 : 400 }}>{value || "—"}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ padding: "0.6mm 1mm", fontSize: "2mm", color: "#4b5563" }}>
                ELDOCK · značky ČSN EN 60617-11 · koupelnové zóny ČSN 33 2000-7-701 ed. 2 · okruhy ČSN 33 2130 ed. 4
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "pudorys";

export function FloorplanExport({ draft, analysis, company }: { draft: FloorplanDraft; analysis: Analysis | null; company?: string | null }) {
  const [open, setOpen] = useState(false);
  const [paper, setPaper] = useState<Paper>("A3");
  const [fields, setFields] = useState<SheetFields>({ project: "Elektroinstalace rodinného domu", investor: "", site: "", author: company ?? "", number: "E-01" });
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);
  const downloadDxf = () => {
    try {
      const text = floorplanDxf(draft, analysis, { title: fields.project || "Půdorys elektroinstalace" });
      const blob = new Blob([text], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug(`pudorys-elektroinstalace-${draft.floorName}`)}.dxf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("Výkres uložen jako DXF (mm 1 : 1, hladiny STAVBA_MISTNOSTI … POPISY_A_KOTY). DWG uložíte z CAD programu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "DXF se nepodařilo vytvořit.");
    }
  };
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)} data-testid="export-pdf">
        <FileText className="size-4" aria-hidden /> 📄 Exportovat výkres do PDF (A3/A4)
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadDxf} data-testid="export-dxf">
        <FileDown className="size-4" aria-hidden /> 📐 Exportovat do CAD (DXF / DWG kompatibilní)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="export-dialog">
          <DialogHeader>
            <DialogTitle>📄 Výkres elektroinstalace do PDF</DialogTitle>
            <DialogDescription>Tiskový list podlaží {draft.floorName} ve skutečném měřítku s normovým značením tras, legendou, tabulkou okruhů a razítkem. V dialogu tisku zvolte „Uložit jako PDF“ – kresba zůstane vektorová.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1" role="radiogroup" aria-label="Formát výkresu">
            {(Object.keys(PAPERS) as Paper[]).map((option) => (
              <button key={option} type="button" role="radio" aria-checked={paper === option} onClick={() => setPaper(option)} className={`rounded-md border px-3 py-1 text-sm font-semibold ${paper === option ? "border-primary bg-primary/20" : "border-border text-muted-foreground"}`}>
                {option} na šířku · 1 : {sheetScale(contentBox(draft), option)}
              </button>
            ))}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {(
              [
                ["project", "Akce"],
                ["investor", "Investor"],
                ["site", "Místo stavby"],
                ["author", "Vypracoval"],
                ["number", "Číslo výkresu"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {label}
                <Input value={fields[key]} maxLength={80} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Zavřít
            </Button>
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                setPrinting(true);
              }}
              data-testid="export-print"
            >
              Tisk / Uložit jako PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printing
        ? createPortal(
            <div className="fp-print-root" data-testid="print-root">
              <style>{`@media screen { .fp-print-root { display: none; } } @media print { @page { size: ${paper} landscape; margin: ${MARGIN}mm; } body > *:not(.fp-print-root) { display: none !important; } .fp-print-root { display: block !important; } html, body { background: #fff !important; } }`}</style>
              <PlanSheet draft={draft} analysis={analysis} paper={paper} fields={fields} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
