// Výstupní dokumentace rozváděče: 6 listů A4 (tiskově čisté, černá na bílé). Výkresy jsou SVG
// generované ze stromu zapojení, oteplení počítá stejný engine jako krok 3.

import type { ReactNode } from "react";

import { LogoMark } from "@/components/layout/Logo";
import { DOCUMENT_SHEETS, type ComponentRow, type PartsRow } from "@/lib/panel-builder/documentation";
import type { ManufacturerInfo } from "@/lib/panel-builder/project";
import type { ThermalResult } from "@/lib/thermalCalculation";

import { PhaseBalance, ThermalCurve, ThermalTable } from "../ThermalViews";
import { CeLabelQr } from "./DocumentationActions";

export interface DocumentationData {
  code: string;
  name: string;
  customerName: string | null;
  norm: string;
  enclosure: string;
  manufacturer: ManufacturerInfo;
  date: string;
  year: string;
  panelDrawingSvg: string;
  singleLineSvg: string;
  functions: { designation: string; label: string }[];
  parts: PartsRow[];
  components: ComponentRow[];
  thermal: ThermalResult;
  ambientTempC: number;
  technical: [string, string][];
  label: { operatingVoltage: string; operatingCurrent: string; shortCircuit: string; ipRating: string; mainBreaker: string; type: string; deviceManufacturer: string };
  qrUrl: string;
}

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function Sheet({ data, number, children }: { data: DocumentationData; number: number; children: ReactNode }) {
  return (
    <section className="doc-sheet mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[10mm] text-[9pt] leading-snug text-black shadow-2xl shadow-black/50 sm:min-h-[297mm]" data-testid={`doc-sheet-${number}`} aria-label={`List ${number}: ${DOCUMENT_SHEETS[number - 1]}`}>
      <header className="mb-3 flex items-baseline justify-between border-b-2 border-black pb-1.5">
        <h2 className="text-[13pt] font-bold">{DOCUMENT_SHEETS[number - 1]}</h2>
        <span className="font-mono text-[8pt]">
          {data.code} · list {number}/{DOCUMENT_SHEETS.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
      {/* Rohové razítko */}
      <table className="mt-4 w-full border-collapse text-[7pt]">
        <tbody>
          <tr>
            <td className="border border-black px-1.5 py-1">
              <div className="text-zinc-500">Projekt</div>
              <div className="font-semibold">{data.name}</div>
            </td>
            <td className="border border-black px-1.5 py-1">
              <div className="text-zinc-500">Zákazník</div>
              <div>{data.customerName ?? "–"}</div>
            </td>
            <td className="border border-black px-1.5 py-1">
              <div className="text-zinc-500">Výrobce rozváděče</div>
              <div>{data.manufacturer.name || "–"}</div>
            </td>
            <td className="border border-black px-1.5 py-1">
              <div className="text-zinc-500">Datum</div>
              <div>{data.date}</div>
            </td>
            <td className="w-24 border border-black px-1.5 py-1">
              <div className="flex items-center gap-1 font-bold">
                <LogoMark className="size-3.5" /> ELDOCK
              </div>
              <div className="text-zinc-500">AI Panel Builder</div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const cell = "border border-zinc-400 px-1.5 py-1 text-left align-top";

function CeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 100" className={className} aria-label="Označení CE" role="img">
      <path d="M58 16a34 34 0 1 0 0 68" fill="none" stroke="#000" strokeWidth={9} />
      <path d="M128 16a34 34 0 1 0 0 68M92 50h32" fill="none" stroke="#000" strokeWidth={9} />
    </svg>
  );
}

export function DocumentationSheets({ data }: { data: DocumentationData }) {
  const m = data.manufacturer;
  return (
    <div className="doc-sheets flex flex-col gap-6" data-testid="documentation">
      {/* List 1 – titulní strana a obsah */}
      <Sheet data={data} number={1}>
        <div className="flex flex-1 flex-col justify-center gap-8 py-10">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10" />
            <span className="text-[20pt] font-black tracking-tight">ELDOCK</span>
          </div>
          <div>
            <p className="text-[10pt] tracking-[0.15em] text-zinc-600 uppercase">Dokumentace rozváděče nízkého napětí · {data.norm}</p>
            <h1 className="mt-2 text-[24pt] leading-tight font-bold">{data.name}</h1>
            <p className="mt-1 font-mono text-[14pt]">{data.code}</p>
          </div>
          <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[10pt]">
            <dt className="text-zinc-600">Zákazník</dt>
            <dd>{data.customerName ?? "–"}</dd>
            <dt className="text-zinc-600">Skříň</dt>
            <dd>{data.enclosure}</dd>
            <dt className="text-zinc-600">Výrobce rozváděče</dt>
            <dd>{[m.name, m.address, m.city].filter(Boolean).join(", ") || "–"}</dd>
            <dt className="text-zinc-600">Datum</dt>
            <dd>{data.date}</dd>
          </dl>
          <div>
            <h2 className="mb-2 border-b border-black text-[11pt] font-bold">Obsah</h2>
            <ol className="flex flex-col gap-1 text-[10pt]">
              {DOCUMENT_SHEETS.map((title, index) => (
                <li key={title} className="flex gap-2">
                  <span className="w-8 font-mono">{index + 1}</span>
                  <span className="flex-1 border-b border-dotted border-zinc-400">{title}</span>
                  <span className="font-mono">list {index + 1}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Sheet>

      {/* List 2 – výkres osazení a výpis funkcí */}
      <Sheet data={data} number={2}>
        <div className="grid flex-1 grid-cols-[1.35fr_1fr] gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- vektorový výkres generovaný kódem */}
          <img src={svgUri(data.panelDrawingSvg)} alt="Výkres osazení rozváděče" className="h-auto w-full self-start" />
          <div>
            <h3 className="mb-1 font-bold">Výpis funkcí přístrojů</h3>
            <table className="w-full border-collapse" data-testid="doc-functions">
              <thead>
                <tr>
                  <th className={cell}>Název</th>
                  <th className={cell}>Funkce</th>
                </tr>
              </thead>
              <tbody>
                {data.functions.map((row) => (
                  <tr key={row.designation}>
                    <td className={`${cell} font-mono font-semibold`}>{row.designation}</td>
                    <td className={cell}>{row.label || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Sheet>

      {/* List 3 – jednopólové schéma */}
      <Sheet data={data} number={3}>
        {/* eslint-disable-next-line @next/next/no-img-element -- vektorové schéma ze stromu zapojení */}
        <img src={svgUri(data.singleLineSvg)} alt="Jednopólové schéma rozváděče" className="h-auto w-full" data-testid="doc-sld" />
      </Sheet>

      {/* List 4 – kusovník a seznam komponent */}
      <Sheet data={data} number={4}>
        <h3 className="font-bold">Kusovník (Parts list)</h3>
        <table className="w-full border-collapse" data-testid="doc-parts">
          <thead>
            <tr>
              <th className={cell}>Objednací číslo</th>
              <th className={cell}>Typ</th>
              <th className={cell}>Výrobce</th>
              <th className={cell}>Popis</th>
              <th className={`${cell} text-right`}>Množství</th>
            </tr>
          </thead>
          <tbody>
            {data.parts.map((row) => (
              <tr key={row.articleNumber + row.typeCode}>
                <td className={`${cell} font-mono`}>{row.articleNumber}</td>
                <td className={cell}>{row.typeCode}</td>
                <td className={cell}>{row.manufacturer}</td>
                <td className={cell}>{row.description}</td>
                <td className={`${cell} text-right font-mono`}>{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-2 font-bold">Seznam komponent (Components list)</h3>
        <table className="w-full border-collapse text-[8pt]" data-testid="doc-components">
          <thead>
            <tr>
              <th className={cell}>Značení</th>
              <th className={cell}>Objednací číslo</th>
              <th className={cell}>Typ</th>
              <th className={cell}>Popis</th>
              <th className={cell}>Pozice</th>
              <th className={cell}>Funkce</th>
            </tr>
          </thead>
          <tbody>
            {data.components.map((row) => (
              <tr key={row.designation}>
                <td className={`${cell} font-mono font-semibold`}>{row.designation}</td>
                <td className={`${cell} font-mono`}>{row.articleNumber}</td>
                <td className={cell}>{row.typeCode}</td>
                <td className={cell}>{row.description}</td>
                <td className={`${cell} font-mono`}>{row.position}</td>
                <td className={cell}>{row.function}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>

      {/* List 5 – oteplení a technická data */}
      <Sheet data={data} number={5}>
        <p className={`border-2 p-2 font-bold ${data.thermal.ok ? "border-emerald-700" : "border-red-700"}`} data-testid="doc-verdict">
          {data.thermal.verdict}
        </p>
        <p className="text-[8pt]">
          Celkový ztrátový výkon {data.thermal.totalLossW.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} W = přístroje {data.thermal.deviceLossW.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} W + vnitřní vodiče{" "}
          {data.thermal.wiringLossW.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} W · Ae {data.thermal.effectiveAreaM2.toLocaleString("cs-CZ", { maximumFractionDigits: 3 })} m² · ověření výpočtem dle IEC TR 60890
        </p>
        <ThermalTable result={data.thermal} print />
        <div className="grid grid-cols-[1fr_1fr] gap-4">
          <div>
            <h3 className="mb-1 font-bold">Technická data rozváděče</h3>
            <table className="w-full border-collapse text-[8pt]" data-testid="doc-technical">
              <tbody>
                {data.technical.map(([label, value]) => (
                  <tr key={label}>
                    <td className={`${cell} text-zinc-600`}>{label}</td>
                    <td className={cell}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3">
            <ThermalCurve result={data.thermal} ambientTempC={data.ambientTempC} print />
            <PhaseBalance result={data.thermal} print />
          </div>
        </div>
      </Sheet>

      {/* List 6 – ES prohlášení o shodě a výrobní štítek */}
      <Sheet data={data} number={6}>
        <div className="flex flex-col gap-2 text-[10pt]" data-testid="doc-declaration">
          <h3 className="text-center text-[14pt] font-bold tracking-wide">ES PROHLÁŠENÍ O SHODĚ</h3>
          <p>Níže podepsaný, zastupující výrobce</p>
          <p className="pl-6 font-semibold">
            {m.name || "–"}
            <br />
            {[m.address, m.city].filter(Boolean).join(", ")}
            {m.phone ? (
              <>
                <br />
                tel. {m.phone}
              </>
            ) : null}
          </p>
          <p>
            prohlašuje, že výrobek <b>{data.name}</b> (<span className="font-mono">{data.code}</span>) je ve shodě s ustanoveními následujících směrnic EU:
          </p>
          <ul className="list-disc pl-10">
            <li>Směrnice o elektrických zařízeních nízkého napětí – LVD 2014/35/EU</li>
            <li>Směrnice o elektromagnetické kompatibilitě – EMC 2014/30/EU</li>
          </ul>
          <p>a že byly použity následující harmonizované normy:</p>
          <ul className="list-disc pl-10">
            <li>ČSN EN 61439-1 – Rozváděče nízkého napětí – Část 1: Všeobecná pravidla</li>
            <li>ČSN EN 61439-3 – Rozváděče nízkého napětí – Část 3: Rozvodnice určené k provozování laiky (DBO)</li>
          </ul>
          <p>Rok, ve kterém bylo připojeno označení CE: {data.year}</p>
          <div className="mt-6 grid grid-cols-2 gap-10">
            <div className="border-t border-black pt-1 text-[8pt] text-zinc-600">Datum a místo</div>
            <div className="border-t border-black pt-1 text-[8pt] text-zinc-600">Podpis, jméno a funkce</div>
          </div>
        </div>

        <h3 className="mt-4 font-bold">Výrobní štítek rozváděče</h3>
        <div className="flex w-[150mm] gap-4 rounded-md border-2 border-black p-3" data-testid="ce-label">
          <div className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[8pt]">
            <span className="text-zinc-600">Norma</span>
            <b>{data.norm}</b>
            <span className="text-zinc-600">Typ</span>
            <b>{data.label.type}</b>
            <span className="text-zinc-600">Výrobce přístrojů</span>
            <b>{data.label.deviceManufacturer}</b>
            <span className="text-zinc-600">Provozní napětí</span>
            <b>{data.label.operatingVoltage}</b>
            <span className="text-zinc-600">Provozní proud</span>
            <b>{data.label.operatingCurrent}</b>
            <span className="text-zinc-600">Max. hlavní jistič</span>
            <b>{data.label.mainBreaker}</b>
            <span className="text-zinc-600">Max. zkratový proud</span>
            <b>{data.label.shortCircuit}</b>
            <span className="text-zinc-600">Krytí</span>
            <b>{data.label.ipRating}</b>
            <span className="text-zinc-600">Výrobce</span>
            <b>{[m.name, m.city].filter(Boolean).join(", ") || "–"}</b>
            <span className="text-zinc-600">ID</span>
            <b className="font-mono">{data.code}</b>
          </div>
          <div className="flex w-28 flex-col items-center gap-2">
            <CeMark className="w-20" />
            <div className="size-24">
              <CeLabelQr value={data.qrUrl} />
            </div>
            <span className="text-center text-[6pt] text-zinc-600">Karta rozváděče v Eldocku</span>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
