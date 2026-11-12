// Výstupní dokumentace rozváděče: 6 listů A4 (tiskově čisté, černá na bílé). Výkresy jsou SVG
// generované ze stromu zapojení, oteplení počítá stejný engine jako krok 4 (oteplení).

import type { ReactNode } from "react";

import { LogoMark } from "@/components/layout/Logo";
import { DOCUMENT_SHEETS, type ComponentRow, type PartsRow } from "@/lib/panel-builder/documentation";
import { FULL_COVER_NOTE, type ExternalInfluencesProtocol } from "@/lib/panel-builder/external-influences";
import { ROUTING_LABEL, type CableReport } from "@/lib/panel-builder/floorplan-editor";
import type { ManufacturerInfo } from "@/lib/panel-builder/project";
import type { ThermalResult } from "@/lib/thermalCalculation";
import { ROUTINE_TEST_POINTS, minInsulationMOhm, routineTestVerdict, type RoutineTest, type StandardEdition } from "@/lib/legislation-2027";
import { type WiringBomRow, BOX_TABLE_TITLE, bomOrderLabel } from "@/lib/panel-builder/wiring-bom";
import { czDate, versionBadge, type DocVersionMark, type InspectionBlock } from "@/lib/switchboard-versions";
import type { HotspotSink } from "@/lib/panel-builder/drawings";
import type { FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import type { DisplayCircuit } from "@/lib/panel-builder/route-display";
import type { FeederInfo } from "@/server/services/panel-projects";

import { FloorplanPlanSvg } from "../floorplan/FloorplanExport";

import { PhaseBalance, ThermalCurve, ThermalTable } from "../ThermalViews";
import { CeLabelQr } from "./DocumentationActions";

export interface DocumentationData {
  code: string;
  name: string;
  customerName: string | null;
  /** Místo instalace (fáze 48). */
  installationSite?: string | null;
  norm: string;
  enclosure: string;
  manufacturer: ManufacturerInfo;
  date: string;
  year: string;
  panelDrawingSvg: string;
  singleLineSvg: string;
  /** Fáze 58: legenda značek jednopólového schématu (ČSN EN 60617). */
  symbolLegend?: { label: string; norm: string; svg: string }[];
  functions: { designation: string; label: string }[];
  parts: PartsRow[];
  components: ComponentRow[];
  thermal: ThermalResult;
  ambientTempC: number;
  /** Fáze 55: jednofázový přívod (fázová bilance jen L1 + N). */
  singlePhase?: boolean;
  technical: [string, string][];
  label: { operatingVoltage: string; operatingCurrent: string; shortCircuit: string; ipRating: string; mainBreaker: string; type: string; deviceManufacturer: string };
  qrUrl: string;
  /** Firemní logo a otisk razítka s podpisem (fáze 43, profil firmy). */
  logoUrl: string | null;
  stampUrl: string | null;
  /** Edice normy rozváděče (fáze 46) a protokol o kusové zkoušce. */
  edition: StandardEdition;
  routineTest: RoutineTest;
  /** Domovní instalace po obvodech (fáze 47): vypínače, zásuvky, rámečky. */
  wiring?: { designation: string; circuit: string; room: string | null; quantity: number; articleNumber: string; title: string }[];
  /** Fáze 55: kusovník domovní instalace z 2D půdorysu (přístroj + kryt + rámeček, krabice, kabely). */
  homeBom?: WiringBomRow[];
  /** Výkaz kabeláže z 2D půdorysu (fáze 49). */
  cableReport?: CableReport | null;
  /** Fáze 52: právní a normativní rámec, protokol o určení vnějších vlivů, rozvodnice pod omítku (úplný kryt). */
  legalFramework?: readonly string[];
  influences?: ExternalInfluencesProtocol;
  fullCover?: boolean;
  /** Fáze 75: klikací oblasti přístrojů ve výkresu osazení a v jednopólovém schématu (chytré PDF). */
  panelHotspots?: HotspotSink;
  sldHotspots?: HotspotSink;
  /** Fáze 75: příloha – půdorys elektroinstalace po podlažích s trasami okruhů tohoto rozváděče. */
  floorplanSheets?: { floorId: string; floorName: string; scale: number; draft: FloorplanDraft; routes: { circuits: DisplayCircuit[]; bus: DisplayCircuit | null } }[];
  /** Fáze 103: část revizního technika ve vydané verzi (naměřené hodnoty, verdikt, elektronické potvrzení). */
  inspection?: InspectionBlock;
  /** Fáze 103: verze zobrazovaného snímku z cloudu (hlavička listů, vodoznak NEAKTUÁLNÍ) – jen při zobrazení. */
  docVersion?: DocVersionMark;
  /** Fáze 75: propojené rozváděče z jednoho půdorysu – nadřazený (přívod) a podružné. */
  boards?: { code: string; parent: { code: string; projectCode: string; url: string; feeder: FeederInfo | null } | null; children: { code: string; projectCode: string; name: string; url: string; feeder: FeederInfo | null }[] };
}

/**
 * Fáze 75: kotva přístroje / okruhu v chytrém PDF – `fn` rozcestník obvodů (List 2), `osa` výkres osazení, `sld`
 * jednopólové schéma, `kab` výkaz kabeláže, `pud` příloha s půdorysem. Prohlížeč (Chrome / Edge) při „Uložit jako PDF“
 * převede odkazy na vnitřní odkazy PDF.
 */
export const docAnchor = (prefix: "fn" | "osa" | "sld" | "kab" | "pud", designation: string) => `${prefix}-${designation.replace(/^-+/, "").replace(/[^A-Za-z0-9]+/g, "_") || "x"}`;
/** Označení okruhu bez kódu rozváděče („RP1 -F3“ → „-F3“) pro odkaz do dokumentace rozváděče. */
const plainDesignation = (designation: string | null) => designation?.replace(/^(RH|RP\d+)\s+/, "") ?? null;

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Logo firmy (nahrané v profilu) – `<img>`, protože jde i o SVG od uživatele. */
function CompanyLogo({ url, className }: { url: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- nahraný soubor firmy (/api/files)
  return <img src={url} alt="Logo výrobce rozváděče" className={`object-contain ${className ?? ""}`} data-testid="doc-logo" />;
}

/** Otisk razítka a podpisu odpovědné osoby (PNG s průhledným pozadím) přes čáru podpisu. */
function SignatureStamp({ url }: { url: string | null }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- nahraný soubor firmy (/api/files)
  return <img src={url} alt="Razítko a podpis odpovědné osoby výrobce" className="pointer-events-none absolute -top-[22mm] left-1/2 h-[26mm] max-w-[60mm] -translate-x-1/2 object-contain" data-testid="doc-stamp" />;
}

/** Fáze 103: verze snímku z cloudu v hlavičce listu – aktuální, nebo výrazně červeně NEAKTUÁLNÍ. */
function VersionMark({ data }: { data: DocumentationData }) {
  const mark = data.docVersion;
  if (!mark) return null;
  return mark.current ? (
    <span className="rounded border border-black px-1 font-sans text-[7.5pt] font-bold" data-testid="doc-version-badge">
      Verze {mark.version} – AKTUÁLNÍ
    </span>
  ) : (
    <span className="rounded bg-red-600 px-1.5 py-0.5 font-sans text-[8pt] font-black text-white" data-testid="doc-version-badge" data-superseded="true">
      {versionBadge(mark.version, "SUPERSEDED", mark.supersededBy)}
    </span>
  );
}

/** Fáze 103: vodoznak přes celý list neaktuální verze (tiskne se i do PDF). */
function SupersededWatermark({ data }: { data: DocumentationData }) {
  const mark = data.docVersion;
  if (!mark || mark.current) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" data-testid="doc-watermark">
      <span className="-rotate-[35deg] whitespace-nowrap text-[40pt] font-black tracking-wider text-red-600/25">NEAKTUÁLNÍ VERZE {mark.version}</span>
    </div>
  );
}

function Sheet({ data, number, children }: { data: DocumentationData; number: number; children: ReactNode }) {
  return (
    <section id={`list-${number}`} className="doc-sheet relative mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[10mm] text-[9pt] leading-snug text-black shadow-2xl shadow-black/50 sm:min-h-[297mm]" data-testid={`doc-sheet-${number}`} aria-label={`List ${number}: ${DOCUMENT_SHEETS[number - 1]}`}>
      <SupersededWatermark data={data} />
      <header className="mb-3 flex items-baseline justify-between border-b-2 border-black pb-1.5">
        <h2 className="text-[13pt] font-bold">{DOCUMENT_SHEETS[number - 1]}</h2>
        <span className="flex items-baseline gap-3 font-mono text-[8pt]">
          {/* Fáze 75: chytré PDF – zpět na obsah a rozcestník obvodů */}
          {number > 1 ? (
            <a href="#list-1" className="text-zinc-500 underline decoration-dotted" data-testid="doc-back-toc">
              ↩ obsah
            </a>
          ) : null}
          {number !== 2 ? (
            <a href="#doc-hub" className="text-zinc-500 underline decoration-dotted">
              ↩ obvody
            </a>
          ) : null}
          <VersionMark data={data} />
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
            <td className="border border-black px-1.5 py-1" data-testid="stamp-manufacturer">
              <div className="text-zinc-500">Výrobce rozváděče</div>
              <div className="font-semibold">{data.manufacturer.name || "–"}</div>
            </td>
            <td className="border border-black px-1.5 py-1" data-testid="stamp-author">
              <div className="text-zinc-500">Zpracoval</div>
              <div>{data.manufacturer.contactName || "–"}</div>
            </td>
            <td className="border border-black px-1.5 py-1">
              <div className="text-zinc-500">Datum</div>
              <div>{data.date}</div>
            </td>
            <td className="w-24 border border-black px-1.5 py-1">
              {data.logoUrl ? (
                <CompanyLogo url={data.logoUrl} className="h-7 w-full" />
              ) : (
                <>
                  <div className="flex items-center gap-1 font-bold">
                    <LogoMark className="size-3.5" /> ELDOCK
                  </div>
                  <div className="text-zinc-500">AI Panel Builder</div>
                </>
              )}
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

/** Protokol o kusové zkoušce (čl. 11 ČSN EN IEC 61439-1 ed. 3) – 8 bodů, R_iso a podpis. */
function RoutineTestSheet({ data }: { data: DocumentationData }) {
  const m = data.manufacturer;
  const test = data.routineTest;
  const evaluation = routineTestVerdict(test);
  const mark = (value: "PASS" | "FAIL" | null) => (value === "PASS" ? "✓ vyhovuje" : value === "FAIL" ? "✗ nevyhovuje" : "–");
  return (
    <div className="mt-4 rounded border border-black p-2 text-[8pt]" data-testid="doc-routine-test">
      <h3 className="mb-1 text-[10pt] font-bold">Protokol o kusové zkoušce (čl. 11 ČSN EN IEC 61439-1 ed. 3)</h3>
      <table className="w-full border-collapse">
        <tbody>
          {ROUTINE_TEST_POINTS.map((point, index) => (
            <tr key={point.id}>
              <td className="border border-zinc-400 px-1 py-0.5 font-mono">{index + 1}.</td>
              <td className="border border-zinc-400 px-1 py-0.5">
                {point.label} (čl. {point.clause})
              </td>
              <td className="border border-zinc-400 px-1 py-0.5 font-semibold" data-testid={`routine-point-${point.id}`}>
                {point.id === "dielectric" && test.insulationMOhm !== null ? `R_iso = ${String(test.insulationMOhm).replace(".", ",")} MΩ (min. ${String(minInsulationMOhm()).replace(".", ",")} MΩ) · ` : ""}
                {mark(test.points[point.id])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 font-bold" data-testid="routine-sheet-verdict">
        Výsledek: {evaluation.verdict === "PASS" ? "rozváděč VYHOVUJE" : evaluation.verdict === "FAIL" ? "rozváděč NEVYHOVUJE" : "protokol není úplný"}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-10">
        <div className="border-t border-black pt-1 text-zinc-600">Datum zkoušky: {test.testedAt ? test.testedAt.split("-").reverse().join(". ").replace(/^0/, "") : data.date}</div>
        <div className="relative border-t border-black pt-1 text-zinc-600" data-testid="routine-test-signature">
          <SignatureStamp url={data.stampUrl} />
          Zkoušku provedl: {test.testedBy || m.contactName || "–"}
          {m.authorizationNumber ? ` (oprávnění ${m.authorizationNumber})` : ""}
        </div>
      </div>
      {data.inspection ? <InspectorSection block={data.inspection} /> : null}
    </div>
  );
}

/** Fáze 103: část pro revizního technika – výstupní kusová zkouška potvrzená při uzamčení verze v cloudu. */
function InspectorSection({ block }: { block: InspectionBlock }) {
  return (
    <div className="mt-3 border-t border-black pt-2" data-testid="doc-inspection">
      <h4 className="text-[9pt] font-bold">Část pro revizního technika – výstupní kusová zkouška a měření (verze {block.version})</h4>
      <table className="mt-1 w-full border-collapse">
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.label}>
              <td className="border border-zinc-400 px-1 py-0.5">{row.label}</td>
              <td className="border border-zinc-400 px-1 py-0.5 font-semibold">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10pt] font-black" data-testid="doc-inspection-verdict">
        {block.verdict}
      </p>
      {block.note ? <p className="mt-0.5">Poznámka revizního technika: {block.note}</p> : null}
      <p className="mt-1 text-zinc-700" data-testid="doc-inspection-signature">
        Měřil a potvrdil: <strong>{block.inspectorName}</strong>, osvědčení / oprávnění TIČR {block.inspectorCert}, měření dne {czDate(block.measuredAt)} · elektronicky potvrzeno a uzamčeno v cloudu ELDOCK {block.confirmedAt}
      </p>
    </div>
  );
}

export function DocumentationSheets({ data }: { data: DocumentationData }) {
  const m = data.manufacturer;
  return (
    <div className="doc-sheets flex flex-col gap-6" data-testid="documentation">
      {/* List 1 – titulní strana a obsah */}
      <Sheet data={data} number={1}>
        <div className="flex flex-1 flex-col justify-center gap-8 py-10">
          {data.logoUrl ? (
            <CompanyLogo url={data.logoUrl} className="h-[22mm] max-w-[80mm] self-start" />
          ) : (
            <div className="flex items-center gap-3">
              <LogoMark className="size-10" />
              <span className="text-[20pt] font-black tracking-tight">ELDOCK</span>
            </div>
          )}
          <div>
            <p className="text-[10pt] tracking-[0.15em] text-zinc-600 uppercase">Dokumentace rozváděče nízkého napětí · {data.norm}</p>
            <h1 className="mt-2 text-[24pt] leading-tight font-bold">{data.name}</h1>
            <p className="mt-1 font-mono text-[14pt]">{data.code}</p>
          </div>
          <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[10pt]">
            <dt className="text-zinc-600">Zákazník</dt>
            <dd>{data.customerName ?? "–"}</dd>
            {data.installationSite ? (
              <>
                <dt className="text-zinc-600">Místo instalace</dt>
                <dd data-testid="doc-site">{data.installationSite}</dd>
              </>
            ) : null}
            <dt className="text-zinc-600">Skříň</dt>
            <dd>{data.enclosure}</dd>
            <dt className="text-zinc-600">Datum</dt>
            <dd>{data.date}</dd>
          </dl>
          <section className="max-w-lg rounded border border-black p-3 text-[10pt]" data-testid="doc-manufacturer" aria-label="Výrobce rozváděče">
            <h2 className="mb-1.5 text-[11pt] font-bold">Výrobce rozváděče</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-0.5">
              <dt className="text-zinc-600">Název firmy</dt>
              <dd className="font-semibold">{m.name || "–"}</dd>
              {m.ico ? (
                <>
                  <dt className="text-zinc-600">IČO</dt>
                  <dd>{m.ico}</dd>
                </>
              ) : null}
              {m.dic ? (
                <>
                  <dt className="text-zinc-600">DIČ</dt>
                  <dd>{m.dic}</dd>
                </>
              ) : null}
              <dt className="text-zinc-600">Sídlo</dt>
              <dd>{[m.address, m.city].filter(Boolean).join(", ") || "–"}</dd>
              {m.contactName ? (
                <>
                  <dt className="text-zinc-600">Odpovědná osoba</dt>
                  <dd>
                    {m.contactName}
                    {m.authorizationNumber ? ` (oprávnění TIČR ${m.authorizationNumber})` : ""}
                  </dd>
                </>
              ) : null}
              {m.phone ? (
                <>
                  <dt className="text-zinc-600">Telefon</dt>
                  <dd>{m.phone}</dd>
                </>
              ) : null}
              {m.email ? (
                <>
                  <dt className="text-zinc-600">E-mail</dt>
                  <dd>{m.email}</dd>
                </>
              ) : null}
            </dl>
          </section>
          {data.legalFramework?.length ? (
            <section className="text-[8pt]" data-testid="doc-legal" aria-label="Právní a normativní rámec">
              <h2 className="mb-1 text-[10pt] font-bold">Právní a normativní rámec dokumentace</h2>
              <ul className="list-disc pl-5">
                {data.legalFramework.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {data.fullCover ? <li data-testid="doc-full-cover">{FULL_COVER_NOTE}</li> : null}
              </ul>
            </section>
          ) : null}
          <div>
            <h2 className="mb-2 border-b border-black text-[11pt] font-bold">Obsah</h2>
            <ol className="flex flex-col gap-1 text-[10pt]">
              {DOCUMENT_SHEETS.map((title, index) => (
                <li key={title} className="flex gap-2">
                  <span className="w-8 font-mono">{index + 1}</span>
                  <a href={`#list-${index + 1}`} className="flex-1 border-b border-dotted border-zinc-400" data-testid="doc-toc-link">
                    {title}
                  </a>
                  <span className="font-mono">list {index + 1}</span>
                </li>
              ))}
              {data.floorplanSheets?.map((sheet, index) => (
                <li key={sheet.floorId} className="flex gap-2">
                  <span className="w-8 font-mono">{String.fromCharCode(65 + index)}</span>
                  <a href={`#priloha-${sheet.floorId}`} className="flex-1 border-b border-dotted border-zinc-400" data-testid="doc-toc-link">
                    Příloha – půdorys elektroinstalace {sheet.floorName}
                  </a>
                  <span className="font-mono">příloha {String.fromCharCode(65 + index)}</span>
                </li>
              ))}
            </ol>
          </div>
          {data.boards ? <LinkedBoards boards={data.boards} /> : null}
        </div>
      </Sheet>

      {/* List 2 – výkres osazení a výpis funkcí */}
      <Sheet data={data} number={2}>
        <div className="grid flex-1 grid-cols-[1.35fr_1fr] gap-4">
          <HotspotImage svg={data.panelDrawingSvg} sink={data.panelHotspots} alt="Výkres osazení rozváděče" prefix="osa" className="self-start" />
          <div>
            <h3 className="mb-1 font-bold" id="doc-hub">
              Výpis funkcí přístrojů – rozcestník obvodů
            </h3>
            <p className="mb-1 text-[7pt] text-zinc-600">Klik na přístroj ve výkresu nebo na odkaz v řádku přejde na související list (schéma, osazení, kabel, půdorys).</p>
            <table className="w-full border-collapse" data-testid="doc-functions">
              <thead>
                <tr>
                  <th className={cell}>Název</th>
                  <th className={cell}>Funkce</th>
                  <th className={cell}>Odkazy</th>
                </tr>
              </thead>
              <tbody>
                {data.functions.map((row) => (
                  <tr key={row.designation} id={docAnchor("fn", row.designation)} data-testid="doc-hub-row">
                    <td className={`${cell} font-mono font-semibold`}>
                      <a href={`#${docAnchor("sld", row.designation)}`}>{row.designation}</a>
                    </td>
                    <td className={cell}>{row.label || "–"}</td>
                    <td className={`${cell} whitespace-nowrap text-[7pt]`}>
                      <HubLinks designation={row.designation} label={row.label} data={data} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Sheet>

      {/* List 3 – jednopólové schéma */}
      <Sheet data={data} number={3}>
        <HotspotImage svg={data.singleLineSvg} sink={data.sldHotspots} alt="Jednopólové schéma rozváděče" prefix="sld" testId="doc-sld" />
        {data.symbolLegend?.length ? (
          <div className="mt-3 border-t border-zinc-300 pt-2" data-testid="doc-symbol-legend">
            <p className="mb-1 text-[10px] font-bold">Legenda značek (ČSN EN 60617)</p>
            <ul className="grid grid-cols-3 gap-x-3 gap-y-1 text-[9px] leading-tight">
              {data.symbolLegend.map((row) => (
                <li key={row.label} className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vlastní vektorová značka */}
                  <img src={svgUri(row.svg)} alt="" className="h-8 w-9 shrink-0" />
                  <span>
                    <b>{row.label}</b>
                    <span className="block text-zinc-500">{row.norm}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
              <th className={cell}>Výrobce</th>
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
                <td className={cell}>{row.manufacturer}</td>
                <td className={cell}>{row.description}</td>
                <td className={`${cell} font-mono`}>{row.position}</td>
                <td className={cell}>{row.function}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.wiring?.length ? (
          <>
            <h3 className="mt-2 font-bold">Domovní instalace po obvodech (Wiring devices)</h3>
            <table className="w-full border-collapse text-[8pt]" data-testid="doc-wiring">
              <thead>
                <tr>
                  <th className={cell}>Obvod</th>
                  <th className={cell}>Funkce</th>
                  <th className={cell}>Místnost</th>
                  <th className={cell}>Objednací číslo</th>
                  <th className={cell}>Přístroj</th>
                  <th className={`${cell} text-right`}>Ks</th>
                </tr>
              </thead>
              <tbody>
                {data.wiring.map((row, index) => (
                  <tr key={`${row.designation}-${row.articleNumber}-${row.room ?? ""}-${index}`}>
                    <td className={`${cell} font-mono font-semibold`}>{row.designation}</td>
                    <td className={cell}>{row.circuit}</td>
                    <td className={cell}>{row.room ?? "–"}</td>
                    <td className={`${cell} font-mono`}>{row.articleNumber}</td>
                    <td className={cell}>{row.title}</td>
                    <td className={`${cell} text-right font-mono`}>{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        {data.homeBom?.length ? (
          <>
            <h3 className="mt-2 font-bold">Kusovník domovní instalace (objednací čísla)</h3>
            <table className="w-full border-collapse text-[8pt]" data-testid="doc-home-bom">
              <thead>
                <tr>
                  <th className={cell}>Kategorie</th>
                  <th className={cell}>Objednací číslo</th>
                  <th className={cell}>Název a specifikace</th>
                  <th className={cell}>Řada a barva</th>
                  <th className={`${cell} text-right`}>Počet</th>
                </tr>
              </thead>
              <tbody>
                {data.homeBom.filter((row) => !row.box).map((row) => (
                  <tr key={`${row.category}-${row.mpn ?? row.name}-${row.appearance}`}>
                    <td className={cell}>{row.category}</td>
                    <td className={`${cell} font-mono`}>
                      {/* Fáze 101: bez čísla v datech výrobce pravdivý původ položky místo „doplnit“ */}
                      {row.mpn ? `${row.mpn}${row.verified ? "" : " (ověřit)"}` : <span className="font-sans italic">{bomOrderLabel(row)}</span>}
                      {/* Fáze 94: EAN z oficiálních dat výrobce ABB ETIM 9.0 */}
                      {row.ean ? <span className="block text-[6.5pt] text-zinc-500">EAN {row.ean}</span> : null}
                    </td>
                    <td className={cell}>{row.name}</td>
                    <td className={cell}>{row.appearance}</td>
                    <td className={`${cell} text-right font-mono`}>
                      {row.quantity} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Fáze 91: doporučené instalační krabice podle prostředí a hloubky */}
            {data.homeBom.some((row) => row.box) ? (
              <>
                <h3 className="mt-2 font-bold">{BOX_TABLE_TITLE.replace(/^📦\s*/, "")}</h3>
                <table className="w-full border-collapse text-[8pt]" data-testid="doc-home-boxes">
                  <thead>
                    <tr>
                      <th className={cell}>Výrobce</th>
                      <th className={cell}>Typové označení</th>
                      <th className={cell}>Objednací kód</th>
                      <th className={`${cell} text-right`}>Hloubka (mm)</th>
                      <th className={cell}>Určení / prostředí</th>
                      <th className={`${cell} text-right`}>Počet ks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.homeBom.filter((row) => row.box).map((row) => (
                      <tr key={`${row.mpn ?? row.name}-${row.box!.maker}`}>
                        <td className={cell}>{row.box!.maker}</td>
                        <td className={cell}>{row.box!.type}</td>
                        <td className={`${cell} font-mono`}>{bomOrderLabel(row)}</td>
                        <td className={`${cell} text-right font-mono`}>{row.box!.depthMm ?? "–"}</td>
                        <td className={cell}>{row.box!.purpose}</td>
                        <td className={`${cell} text-right font-mono`}>{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </>
        ) : null}
        {data.cableReport ? <CableReportTable report={data.cableReport} designationOf={(label) => data.functions.find((row) => row.label === label)?.designation ?? null} /> : null}
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
        <p className="text-[8pt] font-semibold" data-testid="doc-thermal-basis">
          {data.edition.thermalBasis}
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
            <PhaseBalance result={data.thermal} print singlePhase={data.singlePhase} />
          </div>
        </div>
        {data.influences ? <InfluencesProtocol protocol={data.influences} /> : null}
      </Sheet>

      {/* List 6 – ES prohlášení o shodě a výrobní štítek */}
      <Sheet data={data} number={6}>
        <div className="flex flex-col gap-2 text-[10pt]" data-testid="doc-declaration">
          <h3 className="text-center text-[14pt] font-bold tracking-wide" data-testid="declaration-title">
            {data.edition.declarationTitle}
          </h3>
          <p>Výrobce</p>
          <p className="pl-6 font-semibold" data-testid="declaration-manufacturer">
            {m.name || "–"}
            <br />
            {[m.address, m.city].filter(Boolean).join(", ")}
            {m.ico ? (
              <>
                <br />
                IČO {m.ico}
                {m.dic ? `, DIČ ${m.dic}` : ""}
              </>
            ) : null}
            {m.phone ? (
              <>
                <br />
                tel. {m.phone}
              </>
            ) : null}
          </p>
          <p>
            který tímto na svou výhradní odpovědnost prohlašuje, že výrobek <b>{data.name}</b> (<span className="font-mono">{data.code}</span>) je ve shodě s ustanoveními následujících
            předpisů EU:
          </p>
          <ul className="list-disc pl-10" data-testid="declaration-directives">
            {data.edition.directives.map((directive) => (
              <li key={directive}>{directive}</li>
            ))}
          </ul>
          <p>a že byly použity následující harmonizované normy:</p>
          <ul className="list-disc pl-10" data-testid="declaration-norms">
            {data.edition.norms.map((norm) => (
              <li key={norm}>{norm}</li>
            ))}
          </ul>
          <p>Rok, ve kterém bylo připojeno označení CE: {data.year}</p>
          <div className="mt-6 grid grid-cols-2 gap-10">
            <div className="border-t border-black pt-1 text-[8pt] text-zinc-600">
              Datum a místo{m.city ? `: ${data.date}, ${m.city.replace(/^\d{3} ?\d{2} /, "")}` : ""}
            </div>
            <div className="relative border-t border-black pt-1 text-[8pt] text-zinc-600" data-testid="declaration-signature">
              <SignatureStamp url={data.stampUrl} />
              Podpis a razítko odpovědné osoby výrobce{m.contactName ? `: ${m.contactName}` : ""}
            </div>
          </div>
        </div>

        <RoutineTestSheet data={data} />

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
            <b data-testid="label-manufacturer">{[m.name, m.address, m.city].filter(Boolean).join(", ") || "–"}</b>
            <span className="text-zinc-600">ID</span>
            <b className="font-mono">{data.code}</b>
          </div>
          <div className="flex w-28 flex-col items-center gap-2">
            {data.logoUrl ? <CompanyLogo url={data.logoUrl} className="h-8 w-24" /> : null}
            <CeMark className="w-20" />
            <div className="size-24">
              <CeLabelQr value={data.qrUrl} />
            </div>
            <span className="text-center text-[6pt] text-zinc-600">Karta rozváděče v Eldocku</span>
          </div>
        </div>
      </Sheet>

      {/* Fáze 75: přílohy – půdorys elektroinstalace po podlažích, trasy okruhů odkazují do rozcestníku obvodů */}
      {data.floorplanSheets?.map((sheet, index) => (
        <FloorplanAnnex key={sheet.floorId} data={data} sheet={sheet} letter={String.fromCharCode(65 + index)} />
      ))}
    </div>
  );
}

/** Fáze 75: výkres (SVG) s klikacími přístroji – průhledné odkazy nad obrázkem v procentech viewBoxu. */
function HotspotImage({ svg, sink, alt, prefix, className, testId }: { svg: string; sink?: HotspotSink; alt: string; prefix: "osa" | "sld"; className?: string; testId?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- vektorový výkres generovaný kódem */}
      <img src={svgUri(svg)} alt={alt} className="h-auto w-full" data-testid={testId} />
      {sink && sink.width > 0 && sink.height > 0
        ? sink.hotspots.map((spot) => (
            <a
              key={spot.id}
              id={docAnchor(prefix, spot.designation)}
              href={`#${docAnchor("fn", spot.designation)}`}
              aria-label={`Přístroj ${spot.designation} – rozcestník obvodů`}
              className="absolute block"
              style={{ left: `${(spot.x / sink.width) * 100}%`, top: `${(spot.y / sink.height) * 100}%`, width: `${(spot.w / sink.width) * 100}%`, height: `${(spot.h / sink.height) * 100}%` }}
              data-testid="doc-hotspot"
            />
          ))
        : null}
    </div>
  );
}

/** Fáze 75: odkazy řádku rozcestníku – schéma, osazení, kabel a půdorys (jen existující cíle). */
function HubLinks({ designation, label, data }: { designation: string; label: string; data: DocumentationData }) {
  const has = (sink: HotspotSink | undefined) => sink?.hotspots.some((spot) => spot.designation === designation) ?? false;
  const cable = Boolean(label) && (data.cableReport?.circuits.some((row) => row.label === label) ?? false);
  const plan = data.floorplanSheets?.some((sheet) => sheet.routes.circuits.some((circuit) => plainDesignation(circuit.designation) === designation)) ?? false;
  const links = [
    has(data.sldHotspots) ? { href: `#${docAnchor("sld", designation)}`, label: "schéma" } : null,
    has(data.panelHotspots) ? { href: `#${docAnchor("osa", designation)}`, label: "osazení" } : null,
    cable ? { href: `#${docAnchor("kab", designation)}`, label: "kabel" } : null,
    plan ? { href: `#${docAnchor("pud", designation)}`, label: "půdorys" } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);
  if (!links.length) return <span className="text-zinc-400">–</span>;
  return (
    <span className="flex gap-1.5">
      {links.map((link) => (
        <a key={link.href} href={link.href} className="text-blue-800 underline">
          {link.label}
        </a>
      ))}
    </span>
  );
}

/** Fáze 75: propojené rozváděče – přívod z nadřazeného rozváděče a podružné rozváděče (odkazy na jejich dokumentaci). */
function LinkedBoards({ boards }: { boards: NonNullable<DocumentationData["boards"]> }) {
  return (
    <section className="max-w-lg rounded border border-black p-3 text-[9pt]" data-testid="doc-boards" aria-label="Propojené rozváděče">
      <h2 className="mb-1 text-[10pt] font-bold">Rozváděč {boards.code} a propojené rozváděče</h2>
      {boards.parent ? (
        <p>
          Napájen z rozváděče {boards.parent.code}{" "}
          <a href={boards.parent.url} className="font-mono text-blue-800 underline">
            {boards.parent.projectCode}
          </a>
          {boards.parent.feeder ? ` – jistič ${boards.parent.feeder.designation ?? "?"} ${boards.parent.feeder.protection}, ${boards.parent.feeder.cable}, ${num(boards.parent.feeder.lengthM)} m, ΔU ${num(boards.parent.feeder.voltageDropPct)} %` : ""}
        </p>
      ) : null}
      {boards.children.length ? (
        <ul className="mt-1 list-disc pl-5">
          {boards.children.map((child) => (
            <li key={child.code}>
              Podružný rozváděč {child.code}{" "}
              <a href={child.url} className="font-mono text-blue-800 underline">
                {child.projectCode}
              </a>
              {child.feeder ? ` – přívod ${child.feeder.designation ?? "?"} ${child.feeder.protection}, ${child.feeder.cable}, ${num(child.feeder.lengthM)} m` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Fáze 75: příloha – půdorys podlaží s trasami okruhů rozváděče (trasy a řádky okruhů odkazují do rozcestníku). */
export function FloorplanAnnex({ data, sheet, letter, title }: { data: DocumentationData; sheet: NonNullable<DocumentationData["floorplanSheets"]>[number]; letter: string; title?: string }) {
  const links = Object.fromEntries(
    sheet.routes.circuits.flatMap((circuit) => {
      const designation = plainDesignation(circuit.designation);
      return designation && data.functions.some((row) => row.designation === designation) ? [[circuit.id, `#${docAnchor("fn", designation)}`]] : [];
    }),
  );
  return (
    <section id={`priloha-${sheet.floorId}`} className="doc-sheet relative mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[10mm] text-[9pt] leading-snug text-black shadow-2xl shadow-black/50 sm:min-h-[297mm]" data-testid="doc-annex" aria-label={`Příloha ${letter}: půdorys elektroinstalace ${sheet.floorName}`}>
      <SupersededWatermark data={data} />
      <header className="mb-3 flex items-baseline justify-between border-b-2 border-black pb-1.5">
        <h2 className="text-[13pt] font-bold">{title ?? `Příloha ${letter} – půdorys elektroinstalace ${sheet.floorName}`}</h2>
        <span className="flex items-baseline gap-3 font-mono text-[8pt]">
          <a href="#list-1" className="text-zinc-500 underline decoration-dotted">
            ↩ obsah
          </a>
          <a href="#doc-hub" className="text-zinc-500 underline decoration-dotted">
            ↩ obvody
          </a>
          <VersionMark data={data} />
          {data.code} · 1 : {sheet.scale}
        </span>
      </header>
      <FloorplanPlanSvg draft={sheet.draft} routes={sheet.routes} widthMm={190} heightMm={175} scale={sheet.scale} links={links} />
      <table className="mt-2 w-full border-collapse text-[8pt]" data-testid="doc-annex-circuits">
        <thead>
          <tr>
            <th className={cell}>Okruh</th>
            <th className={cell}>Popis</th>
            <th className={cell}>Kabel</th>
            <th className={cellRight}>Délka</th>
          </tr>
        </thead>
        <tbody>
          {sheet.routes.circuits.map((circuit) => {
            const designation = plainDesignation(circuit.designation);
            const inHub = designation !== null && data.functions.some((row) => row.designation === designation);
            return (
              <tr key={circuit.id} id={inHub && designation ? docAnchor("pud", designation) : undefined}>
                <td className={cellMono}>{inHub && designation ? <a href={`#${docAnchor("fn", designation)}`}>{circuit.designation}</a> : (circuit.designation ?? "–")}</td>
                <td className={cell}>{circuit.label}</td>
                <td className={cellMono}>{circuit.cable}</td>
                <td className={cellRight}>{num(circuit.lengthM)} m</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[7pt] text-zinc-600">Trasy v normovém značení (rysky = počet žil). Klik na trasu nebo označení okruhu přejde do rozcestníku obvodů rozváděče.</p>
    </section>
  );
}

/**
 * Fáze 103: druhý dokument vydané verze – „📐 Prováděcí 2D půdorys a kabelové trasy“ navázaného 2D půdorysu: podlaží
 * se všemi okruhy, kusovník domovní instalace a metry kabelů (stejné listy A4, verze v hlavičce, vodoznak NEAKTUÁLNÍ).
 */
export function FloorplanVersionSheets({ data, plan }: { data: DocumentationData; plan: { name: string; sheets: NonNullable<DocumentationData["floorplanSheets"]>; bom: WiringBomRow[]; cables: { cable: string; meters: number }[] } }) {
  return (
    <div className="doc-sheets flex flex-col gap-6" data-testid="floorplan-document">
      {plan.sheets.map((sheet, index) => (
        <FloorplanAnnex key={sheet.floorId} data={data} sheet={sheet} letter={String.fromCharCode(65 + index)} title={`Půdorys ${sheet.floorName} – prováděcí výkres a kabelové trasy`} />
      ))}
      <section className="doc-sheet relative mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[10mm] text-[9pt] leading-snug text-black shadow-2xl shadow-black/50 sm:min-h-[297mm]" data-testid="floorplan-document-bom">
        <SupersededWatermark data={data} />
        <header className="mb-3 flex items-baseline justify-between border-b-2 border-black pb-1.5">
          <h2 className="text-[13pt] font-bold">Kusovník a kabeláž – {plan.name}</h2>
          <span className="flex items-baseline gap-3 font-mono text-[8pt]">
            <VersionMark data={data} />
            {data.code}
          </span>
        </header>
        <table className="w-full border-collapse text-[8pt]" data-testid="floorplan-document-bom-table">
          <thead>
            <tr>
              <th className={cell}>Kategorie</th>
              <th className={cell}>Objednací číslo</th>
              <th className={cell}>Název a specifikace</th>
              <th className={cell}>Řada a barva</th>
              <th className={`${cell} text-right`}>Počet</th>
            </tr>
          </thead>
          <tbody>
            {plan.bom.filter((row) => !row.box).map((row) => (
              <tr key={`${row.category}-${row.mpn ?? row.name}-${row.appearance}`}>
                <td className={cell}>{row.category}</td>
                <td className={`${cell} font-mono`}>{row.mpn ? `${row.mpn}${row.verified ? "" : " (ověřit)"}` : <span className="font-sans italic">{bomOrderLabel(row)}</span>}</td>
                <td className={cell}>{row.name}</td>
                <td className={cell}>{row.appearance}</td>
                <td className={`${cell} text-right font-mono`}>
                  {row.quantity} {row.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan.cables.length ? (
          <>
            <h3 className="mt-3 font-bold">Kabely podle typu (délky tras z půdorysu)</h3>
            <table className="w-full border-collapse text-[8pt]">
              <tbody>
                {plan.cables.map((row) => (
                  <tr key={row.cable}>
                    <td className={`${cell} font-mono`}>{row.cable}</td>
                    <td className={`${cell} text-right font-mono`}>{String(row.meters).replace(".", ",")} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </section>
    </div>
  );
}

/** List 5 – protokol o určení vnějších vlivů (fáze 52) pro výchozí a pravidelné revize. */
function InfluencesProtocol({ protocol }: { protocol: ExternalInfluencesProtocol }) {
  return (
    <section className="break-inside-avoid text-[7.5pt]" data-testid="doc-influences" aria-label="Protokol o určení vnějších vlivů">
      <h3 className="text-[9pt] font-bold">Protokol o určení vnějších vlivů dle {protocol.basis}</h3>
      <p>
        Prostředí: <b>{protocol.environment}</b> ({protocol.codes}) · požadované krytí <b>{protocol.requiredIp}</b> (doporučeno {protocol.recommendedIp})
        {protocol.requiredIk ? (
          <>
            {" "}
            · odolnost <b>{protocol.requiredIk}</b>
          </>
        ) : null}
      </p>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr>
            <th className={cell}>Vliv</th>
            <th className={cell}>Třída</th>
            <th className={cell}>Charakteristika</th>
            <th className={cell}>Stanovené opatření</th>
          </tr>
        </thead>
        <tbody>
          {protocol.rows.map((row) => (
            <tr key={row.code} data-influence={row.code}>
              <td className={cell}>
                <b>{row.code}</b> {row.name}
              </td>
              <td className={`${cell} font-mono font-semibold`}>{row.value}</td>
              <td className={cell}>{row.description}</td>
              <td className={cell}>{row.measure}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {protocol.occupancy ? (
        <div className="mt-1 rounded border border-zinc-400 p-1" data-testid="doc-occupancy">
          <p>
            Typ objektu: <b>{protocol.occupancy.label}</b> – {protocol.occupancy.norms.join(" · ")}
          </p>
          <ul className="list-disc pl-5">
            {protocol.occupancy.measures.map((measure) => (
              <li key={measure}>{measure}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {protocol.notes.length || protocol.construction.length ? (
        <ul className="mt-1 list-disc pl-5" data-testid="doc-construction">
          {[...protocol.notes, ...protocol.construction].map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-zinc-600">Protokol je součástí dokumentace pro výchozí a pravidelné revize (ČSN 33 2000-6 ed. 2). Určil: odpovědný projektant / komise dle TNI 33 2000-5-51:2022.</p>
    </section>
  );
}

const num = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
const cellRight = cell + " text-right font-mono";
const cellMono = cell + " font-mono";

/** List 4 – výkaz kabeláže z 2D půdorysu: režim vedení, porovnání metráže, kabely k nákupu a ΔU okruhů. */
function CableReportTable({ report, designationOf = () => null }: { report: CableReport; designationOf?: (label: string) => string | null }) {
  return (
    <section className="mt-2" data-testid="doc-cables" aria-label="Výkaz kabeláže">
      <h3 className="font-bold">Výkaz kabeláže a okruhů (ČSN 33 2130 ed. 4) – {ROUTING_LABEL[report.mode]}</h3>
      <p className="text-[8pt]">
        Spodem {num(report.totals.BOTTOM)} m · Vrchem {num(report.totals.TOP)} m · Optimalizovaně {num(report.totals.OPTIMIZED)} m (úspora {num(Math.max(report.savingVsBottomM, report.savingVsTopM))} m). Strop {report.profile.ceilingHeightMm} mm, rozváděč {report.profile.switchboardHeightMm} mm, zásuvky {report.profile.defaultSocketHeightMm} / {report.profile.worktopSocketHeightMm} mm, vypínače {report.profile.defaultSwitchHeightMm} mm, rezerva {report.profile.slackPercent} % + přídavky na zapojení.
      </p>
      <div className="mt-1 grid grid-cols-[1fr_2fr] gap-2">
        <table className="w-full border-collapse text-[8pt]">
          <thead>
            <tr>
              <th className={cell}>Kabel</th>
              <th className={cellRight}>Metráž</th>
            </tr>
          </thead>
          <tbody>
            {report.byCable.map((row) => (
              <tr key={row.cable}>
                <td className={cellMono}>{row.cable}</td>
                <td className={cellRight}>{row.meters} m</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full border-collapse text-[8pt]">
          <thead>
            <tr>
              <th className={cell}>Okruh</th>
              <th className={cell}>Kabel</th>
              <th className={cell}>Trasa</th>
              <th className={cellRight}>Délka</th>
              <th className={cellRight}>ΔU</th>
            </tr>
          </thead>
          <tbody>
            {report.circuits.map((row, index) => {
              // Fáze 75: chytré PDF – řádek okruhu odkazuje do rozcestníku obvodů (List 2)
              const designation = designationOf(row.label);
              return (
              <tr key={row.label + "-" + index} id={designation ? docAnchor("kab", designation) : undefined}>
                <td className={cell}>{designation ? <a href={`#${docAnchor("fn", designation)}`}><b className="font-mono">{designation}</b> {row.label}</a> : row.label}</td>
                <td className={cellMono}>{row.cable}</td>
                <td className={cell}>{row.routing === "TOP" ? "vrchem" : "spodem"}</td>
                <td className={cellRight}>{num(row.lengthM)} m</td>
                <td className={row.ok ? cellRight : cellRight + " font-bold"}>{num(row.voltageDropPct)} % {row.ok ? "✓" : "✗"}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
