"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MODULE_MM_OPTIONS, STRIP_HEIGHT_OPTIONS, labelRows, labelStrips, labelsCsv, splitStrip, type LabelDevice, type ModuleMm, type StripHeight } from "@/lib/panel-builder/labels";
import { symbolTexts } from "@/lib/panel-builder/vector-symbols";
import { buildXlsx } from "@/lib/xlsx";
import { cn } from "@/lib/utils";

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Choice<T extends number>({ label, options, value, onChange, format }: { label: string; options: readonly T[]; value: T; onChange: (value: T) => void; format: (value: T) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label={label}>
      <span className="text-muted-foreground">{label}:</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn("min-h-8 rounded-md border px-2.5 font-semibold", value === option ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

const mm = (value: number) => `${value}mm`;
const n = (value: number) => String(value).replace(".", ",");

/**
 * „🏷️ Tisk popisků a štítků (1:1)“: A4 bez okrajů prohlížeče s kalibračním měřítkem 100 mm, souvislé
 * samolepicí pásy nad / pod DIN lišty v přesné fyzické šířce přístrojů a štítky 17 × 9 mm na přístroje.
 */
export function LabelSheet({ code, name, devices, capacities }: { code: string; name: string; devices: LabelDevice[]; capacities: number[] }) {
  const [moduleMm, setModuleMm] = useState<ModuleMm>(17.5);
  const [height, setHeight] = useState<StripHeight>(12);
  const strips = labelStrips(devices, capacities, moduleMm);
  const rows = labelRows(devices, moduleMm);
  const small = height <= 9;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <Choice label="Šířka modulu" options={MODULE_MM_OPTIONS} value={moduleMm} onChange={setModuleMm} format={(value) => `${n(value)} mm`} />
        <Choice label="Výška pásu" options={STRIP_HEIGHT_OPTIONS} value={height} onChange={setHeight} format={(value) => `${value} mm`} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => download(`${code}-popisky.csv`, labelsCsv(rows), "text/csv;charset=utf-8")}>
            <FileText className="size-4" aria-hidden /> Export CSV (P-Touch / Dymo)
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => download(`${code}-popisky.xlsx`, buildXlsx("Popisky", rows) as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>
            <FileSpreadsheet className="size-4" aria-hidden /> Export XLSX
          </Button>
          <Button className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Tisknout A4 (100 %)
          </Button>
        </div>
        <p className="w-full text-xs text-muted-foreground">
          Tiskněte ve skutečné velikosti (100 %, bez „přizpůsobit stránce“) a ověřte pravítkem kalibrační měřítko 100 mm. Pás se přilepí nad nebo pod DIN lištu, políčko = šířka přístroje.
        </p>
      </div>

      <section className="label-sheet mx-auto flex w-[210mm] max-w-full flex-col gap-[6mm] bg-white p-[10mm] text-black shadow-2xl shadow-black/50" aria-label="Tisková sestava popisků" data-testid="label-sheet">
        <div className="flex items-end justify-between border-b border-black pb-[2mm]">
          <div>
            <p className="text-[7pt] tracking-widest text-zinc-600 uppercase">Popisky rozváděče · měřítko 1:1</p>
            <h2 className="text-[12pt] font-bold">
              {code} – {name}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-[1mm]" data-testid="calibration">
            <div className="relative h-[4mm] border-x border-b border-black" style={{ width: "100mm" }}>
              {Array.from({ length: 11 }, (_, index) => (
                <span key={index} className="absolute bottom-0 w-px bg-black" style={{ left: `${index * 10}mm`, height: index % 5 === 0 ? "4mm" : "2.5mm" }} />
              ))}
            </div>
            <span className="text-[7pt] font-semibold">Kalibrační měřítko: 100 mm = 10 cm</span>
          </div>
        </div>

        <div className="flex flex-col gap-[4mm]">
          <h3 className="text-[9pt] font-bold">1) Souvislé popisovací pásy nad / pod DIN lišty ({n(moduleMm)} mm / modul, výška {height} mm)</h3>
          {strips.map((strip) =>
            splitStrip(strip).map((part, index) => (
              <div key={`${strip.rail}-${index}`} className="flex flex-col gap-[0.8mm]" data-testid={`label-strip-${strip.rail}`}>
                <span className="text-[6.5pt] text-zinc-600">
                  Lišta {strip.rail}
                  {index ? ` (pokračování ${index + 1})` : ""} · {strip.capacity} M = {n(strip.widthMm)} mm
                </span>
                <div className="flex border-y border-l border-black" style={{ height: mm(height), width: "fit-content" }}>
                  {part.map((cell, cellIndex) => (
                    <div
                      key={cell.id ?? `empty-${cellIndex}`}
                      className={cn("flex flex-col overflow-hidden border-r border-black leading-none", cell.empty && "bg-zinc-50")}
                      style={{ width: mm(cell.widthMm), height: mm(height) }}
                      data-cell={cell.designation || "empty"}
                      data-width-mm={cell.widthMm}
                    >
                      {cell.empty ? null : (
                        <>
                          <div className="flex shrink-0" style={{ height: "1.4mm" }}>
                            {cell.colors.map((color, colorIndex) => (
                              <span key={colorIndex} className="flex-1" style={{ background: color }} />
                            ))}
                          </div>
                          <div className={cn("flex flex-1 flex-col justify-center px-[0.6mm] text-center", small ? "gap-0" : "gap-[0.4mm]")}>
                            <b className={small ? "text-[5.5pt]" : "text-[6.5pt]"}>{cell.designation}</b>
                            {cell.label && !small ? <span className="line-clamp-2 text-[5pt] break-words">{cell.label}</span> : null}
                            {cell.value ? <span className={cn("font-mono", small ? "text-[5pt]" : "text-[5.5pt]")}>{cell.value}</span> : null}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )),
          )}
        </div>

        <div className="flex flex-col gap-[2mm]">
          <h3 className="text-[9pt] font-bold">2) Štítky na přístroje (17 × 9 mm)</h3>
          <div className="flex flex-wrap gap-[1mm]" data-testid="device-labels">
            {devices.map((device) => (
              <div key={device.id} className="flex flex-col items-center justify-center border border-black leading-none" style={{ width: "17mm", height: "9mm" }} data-label={device.designation}>
                <b className="text-[7pt]">{device.designation}</b>
                <span className="font-mono text-[5pt]">{symbolTexts(device).value.replace("?", "")}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
