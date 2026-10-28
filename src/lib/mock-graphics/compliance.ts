import type { ComplianceCategory, InspectionResult, InspectionType } from "@/generated/prisma/enums";
import { buildInterfaceRows, parseAmps, type InterfaceSource } from "@/lib/switchboard-interface";

import { renderDocumentSvg, renderSingleLineSvg, type DocumentTone, type SingleLineFeeder } from "./document";

// Obsah dokumentů pasportu (ČSN EN 61439) a revizních zpráv (ČSN 33 1500) jako SVG.
// Používá seed i Server Action „Zapsat novou revizi“ (když technik nenahraje vlastní soubor).

export interface ComplianceContext extends InterfaceSource {
  name: string;
  issuer: string;
  documentNumber: string;
  /** „15.03.2019“ */
  date: string;
  author: string;
  feeders: SingleLineFeeder[];
}

const sumLosses = (amps: number) => Math.round(amps * 0.42);

export function renderComplianceDocumentSvg(category: ComplianceCategory, ctx: ComplianceContext): string {
  const amps = parseAmps(ctx.ratedCurrent) ?? 0;
  const meta: [string, string][] = [
    ["Rozváděč", `${ctx.tag} – ${ctx.name.replace(`${ctx.tag} - `, "")}`],
    ["Typ / systém", [ctx.manufacturer, ctx.model].filter(Boolean).join(" ") || "–"],
    ["Jmenovité napětí", ctx.ratedVoltage ?? "–"],
    ["Jmenovitý proud InA", ctx.ratedCurrent ?? "–"],
    ["Stupeň krytí", ctx.ipRating ?? "–"],
    ["Rok výroby", ctx.yearInstalled ? String(ctx.yearInstalled) : "–"],
  ];
  const signature = { name: ctx.author, role: ctx.issuer, date: ctx.date };

  switch (category) {
    case "SINGLE_LINE_DIAGRAM":
      return renderSingleLineSvg({
        tag: ctx.tag,
        name: ctx.name,
        ratedCurrent: ctx.ratedCurrent,
        supply: ctx.fedFrom ? `Přívod z ${ctx.fedFrom.tag}${ctx.fedFromCircuit ? ` (${ctx.fedFromCircuit})` : ""}` : "Přívod z transformátoru TR1 22/0,4 kV",
        documentNumber: ctx.documentNumber,
        author: ctx.author,
        date: ctx.date,
        feeders: ctx.feeders,
      });

    case "CONFORMITY_DECLARATION":
      return renderDocumentSvg({
        issuer: ctx.issuer,
        title: "EU prohlášení o shodě",
        subtitle: "Vydáno na výhradní odpovědnost výrobce rozváděče ve smyslu nařízení vlády č. 117/2016 Sb. (EMC) a č. 118/2016 Sb. (LVD).",
        documentNumber: ctx.documentNumber,
        meta,
        sections: [
          {
            heading: "Předmět prohlášení",
            lines: [`Sestava spínacích a řídicích zařízení nízkého napětí ${ctx.tag} je ve shodě s příslušnými harmonizačními právními předpisy Unie.`],
          },
          {
            heading: "Použité harmonizované normy",
            table: [
              ["Norma", "Název"],
              ["ČSN EN IEC 61439-1:2021", "Rozváděče nn – Část 1: Všeobecná pravidla"],
              ["ČSN EN IEC 61439-2:2021", "Rozváděče nn – Část 2: Výkonové rozváděče"],
              ["ČSN EN 60529", "Stupně ochrany krytem (IP kód)"],
              ["ČSN EN 62262", "Stupně ochrany proti mechanickým nárazům (IK kód)"],
            ],
          },
          {
            heading: "Charakteristiky rozhraní",
            table: [["Parametr", "Hodnota"], ...buildInterfaceRows(ctx).slice(2, 11).map((row) => [row.label, row.value])],
          },
        ],
        verdict: { label: "Označení CE", text: "Rozváděč je opatřen označením CE a výrobním štítkem dle čl. 6.1 ČSN EN 61439-1.", tone: "ok" },
        signature: { ...signature, role: `Jednatel · ${ctx.issuer}` },
      });

    case "ROUTINE_VERIFICATION":
      return renderDocumentSvg({
        issuer: ctx.issuer,
        title: "Protokol o kusové zkoušce",
        subtitle: "Kusové ověření dle čl. 11 ČSN EN IEC 61439-1 a -2 provedené ve výrobním závodě před expedicí.",
        documentNumber: ctx.documentNumber,
        meta,
        sections: [
          {
            heading: "Výsledky kusového ověření",
            table: [
              ["Článek", "Ověřovaná vlastnost", "Výsledek"],
              ["11.2", "Stupeň ochrany krytem", "Vyhovuje"],
              ["11.3", "Vzdušné vzdálenosti a povrchové cesty", "Vyhovuje"],
              ["11.4", "Ochrana před úrazem el. proudem, ochranný obvod", "Vyhovuje"],
              ["11.5", "Vestavěné komponenty", "Vyhovuje"],
              ["11.6", "Vnitřní elektrické obvody a spoje (utahovací momenty)", "Vyhovuje"],
              ["11.7", "Svorky pro vnější vodiče", "Vyhovuje"],
              ["11.8", "Mechanická funkce", "Vyhovuje"],
              ["11.9", "Elektrická pevnost (2 500 V / 1 s)", "Vyhovuje"],
              ["11.10", "Zapojení, provozní funkce", "Vyhovuje"],
            ],
          },
          {
            heading: "Měření",
            lines: [`Izolační odpor hlavních obvodů > 500 MΩ (měřeno 1 000 V DC). Spojitost ochranného obvodu: max. 0,04 Ω.`],
          },
        ],
        verdict: { label: "Závěr: VYHOVUJE", text: "Rozváděč splňuje požadavky kusového ověření a může být uveden do provozu.", tone: "ok" },
        signature: { ...signature, role: `Zkušební technik · ${ctx.issuer}` },
      });

    case "THERMAL_CALCULATION": {
      const field = Math.min(630, amps || 630);
      return renderDocumentSvg({
        issuer: ctx.issuer,
        title: "Ověření oteplení výpočtem",
        subtitle: `Návrhové ověření dle čl. 10.10.4 ČSN EN IEC 61439-1 (metoda ztrátového výkonu, IEC/TR 60890) – vývodové pole ${field} A.`,
        documentNumber: ctx.documentNumber,
        meta,
        sections: [
          {
            heading: "Vstupní údaje",
            lines: [
              `Okolní teplota 35 °C (průměr 24 h), instalace volně stojící, přirozené chlazení, faktor současnosti RDF 0,8. Efektivní ztrátový výkon pole: ${sumLosses(field)} W.`,
            ],
          },
          {
            heading: "Výsledky výpočtu",
            table: [
              ["Místo", "In [A]", "Ztráty [W]", "Δθ výpočet [K]", "Mez [K]"],
              ["Přípojnice pole", String(field), String(Math.round(field * 0.18)), "32", "70"],
              [`Jistič vývodu (${field} A)`, String(Math.round(field * 0.8)), String(Math.round(field * 0.12)), "28", "dle výrobce"],
              ["Svorky vnějších vodičů", String(Math.round(field * 0.8)), "–", "41", "70"],
              ["Vzduch v horní části skříně", "–", "–", "19", "dle komponent"],
            ],
          },
        ],
        verdict: {
          label: "Závěr: oteplení v mezích",
          text: "Vypočtené oteplení nepřekračuje meze tabulky 6. Pole lze trvale zatěžovat jmenovitým proudem při RDF 0,8.",
          tone: "ok",
        },
        signature: { ...signature, role: `Projektant · ${ctx.issuer}` },
      });
    }

    case "EXTERNAL_INFLUENCES":
      return renderDocumentSvg({
        issuer: ctx.issuer,
        title: "Protokol o určení vnějších vlivů",
        subtitle: "Určeno komisí dle ČSN 33 2000-5-51 ed. 3 a ČSN 33 2000-1 ed. 2 pro prostor, ve kterém je rozváděč instalován.",
        documentNumber: ctx.documentNumber,
        meta: [
          ["Zařízení", ctx.tag],
          ["Prostor", ctx.name],
          ["Komise", "Ing. Tomáš Král (předseda), Petr Novák, Jana Dvořáková"],
          ["Podklady", "Projekt DSP, provozní řád haly, BL chladicích kapalin"],
        ],
        sections: [
          {
            heading: "Určené vnější vlivy",
            table: [
              ["Kód", "Vliv", "Třída", "Zdůvodnění"],
              ["AA5", "Teplota okolí", "+5 až +40 °C", "Vytápěná hala"],
              ["AB5", "Vlhkost", "normální", "Bez kondenzace"],
              ["AD1–AD2", "Voda", "kapky", "Chladicí emulze u stroje"],
              ["AE2", "Cizí pevná tělesa", "malá", "Kovové třísky"],
              ["AF2", "Korozní látky", "atmosférické", "Mlha emulze"],
              ["AG2", "Mechanické rázy", "střední", "Provoz VZV"],
              ["BA4", "Způsobilost osob", "poučené", "Obsluha a údržba"],
              ["BE1", "Zpracovávané látky", "bez rizika", "–"],
            ],
          },
          { heading: "Souhrn", lines: [ctx.externalInfluences ?? "Prostory normální."] },
        ],
        verdict: {
          label: "Závěr",
          text: `Prostor je z hlediska nebezpečí úrazu elektrickým proudem prostorem normálním. Požadovaný stupeň krytí min. IP54 – rozváděč ${ctx.ipRating ?? ""} vyhovuje.`,
          tone: "ok",
        },
        signature: { ...signature, role: "Předseda komise" },
      });
  }
}

export interface InspectionReportContext {
  tag: string;
  name: string;
  location: string;
  ratedVoltage: string | null;
  ratedCurrent: string | null;
  type: InspectionType;
  reportNumber: string;
  inspectionDate: string;
  validUntil: string;
  inspectorName: string;
  inspectorLicense: string;
  result: InspectionResult;
  defectsSummary: string | null;
  /** Norma revize („ČSN 33 1600 ed. 2“); výchozí ČSN 33 1500. */
  standard?: string;
  /** Naměřené hodnoty revize spotřebiče. */
  measurements?: ReportMeasurements | null;
}

export interface ReportMeasurements {
  instrument: string;
  rpe: number | null;
  riso: number | null;
}

const num = (value: number) => String(value).replace(".", ",");

function measurementRows(m: ReportMeasurements): string[][] {
  return [
    ["Měření", "Naměřeno", "Požadavek", "Vyhovuje"],
    ["Odpor ochranného vodiče R_PE", m.rpe === null ? "neměří se (tř. II/III)" : `${num(m.rpe)} Ω`, "≤ 0,3 Ω", m.rpe === null || m.rpe <= 0.3 ? "ano" : "NE"],
    ["Izolační odpor R_iso (500 V DC)", m.riso === null ? "–" : `${num(m.riso)} MΩ`, "≥ 1 MΩ (tř. I) / 2 MΩ (tř. II)", m.riso !== null && m.riso >= 1 ? "ano" : "NE"],
    ["Měřicí přístroj", m.instrument, "kalibrace platná", "ano"],
  ];
}

const REPORT_TITLES: Record<InspectionType, string> = {
  INITIAL: "Zpráva o výchozí revizi",
  PERIODIC: "Zpráva o pravidelné revizi",
  EXTRAORDINARY: "Zpráva o mimořádné revizi",
  THERMOVISION: "Protokol o termovizním měření",
};

const VERDICTS: Record<InspectionResult, { label: string; tone: DocumentTone }> = {
  CAPABLE: { label: "Elektrické zařízení JE schopno bezpečného provozu.", tone: "ok" },
  CAPABLE_WITH_DEFECTS: { label: "Elektrické zařízení JE schopno bezpečného provozu s výhradou.", tone: "warning" },
  INCAPABLE: { label: "Elektrické zařízení NENÍ schopno bezpečného provozu!", tone: "danger" },
};

export function renderInspectionReportSvg(ctx: InspectionReportContext): string {
  const thermo = ctx.type === "THERMOVISION";
  const verdict = VERDICTS[ctx.result];
  return renderDocumentSvg({
    issuer: thermo ? `Termodiagnostika – ${ctx.inspectorName}` : `Revizní technik – ${ctx.inspectorName}`,
    title: REPORT_TITLES[ctx.type],
    subtitle: thermo
      ? "Bezkontaktní měření teplotních polí přípojnic, spojů a přístrojů za provozu (zatížení min. 40 % In)."
      : ctx.standard && ctx.standard !== "ČSN 33 1500"
        ? `Revize elektrického zařízení dle ${ctx.standard}. Revizní technik dle NV 190/2022 Sb.`
        : "Revize elektrického zařízení dle ČSN 33 1500, ČSN 33 2000-6 ed. 2 a ČSN EN 61439. Revizní technik dle NV 190/2022 Sb.",
    documentNumber: ctx.reportNumber,
    meta: [
      ["Zařízení", ctx.tag],
      ["Umístění", ctx.location],
      ["Datum provedení", ctx.inspectionDate],
      [thermo ? "Doporučené příští měření" : "Příští pravidelná revize", ctx.validUntil],
      [thermo ? "Termodiagnostik" : "Revizní technik", ctx.inspectorName],
      [thermo ? "Certifikát" : "Ev. č. osvědčení TIČR", ctx.inspectorLicense],
    ],
    sections: thermo
      ? [
          {
            heading: "Naměřené hodnoty",
            table: [
              ["Místo měření", "Max. teplota", "Δθ vůči okolí", "Hodnocení"],
              ["Přípojnice L1/L2/L3", "48,2 °C", "22 K", "v pořádku"],
              ["Hlavní vypínač – svorky", "52,7 °C", "27 K", "v pořádku"],
              ["Vývodové jističe", "44,1 °C", "18 K", "v pořádku"],
            ],
          },
          { heading: "Závady", lines: [ctx.defectsSummary ?? "Nebyla zjištěna žádná kritická teplotní anomálie."] },
        ]
      : [
          {
            heading: "Měření",
            table: ctx.measurements ? measurementRows(ctx.measurements) : [
              ["Měření", "Naměřeno", "Požadavek", "Vyhovuje"],
              ["Izolační odpor (500 V DC)", "> 200 MΩ", "≥ 1 MΩ", "ano"],
              ["Spojitost ochranných vodičů", "0,08 Ω", "≤ 0,2 Ω", "ano"],
              ["Impedance smyčky Zs", "0,21 Ω", "dle jištění", "ano"],
              ["Proudové chrániče IΔn 30 mA", "18 ms", "≤ 300 ms", "ano"],
            ],
          },
          {
            heading: "Zjištěné závady",
            lines: [ctx.defectsSummary?.trim() ? ctx.defectsSummary : "Bez závad."],
          },
          {
            heading: "Podklady",
            lines: [`${ctx.name}, jmenovité napětí ${ctx.ratedVoltage ?? "–"}, jmenovitý proud ${ctx.ratedCurrent ?? "–"}. Platná elektrodokumentace v systému Digitry.`],
          },
        ],
    verdict: {
      label: "Celkový posudek",
      text: `${verdict.label}${ctx.result === "CAPABLE_WITH_DEFECTS" ? " Zjištěné závady odstranit v nejbližším možném termínu." : ""}`,
      tone: verdict.tone,
    },
    signature: { name: ctx.inspectorName, role: ctx.inspectorLicense, date: ctx.inspectionDate },
  });
}

export interface BatchProtocolContext {
  protocolNumber: string;
  inspectionDate: string;
  inspectorName: string;
  inspectorLicense: string;
  instrument: string | null;
  result: InspectionResult;
  defectsSummary: string | null;
  items: { tag: string; name: string; standard: string; validUntil: string }[];
}

/** Společný protokol hromadné revize (jeden technik, jedno datum, více zařízení). */
export function renderBatchProtocolSvg(ctx: BatchProtocolContext): string {
  const verdict = VERDICTS[ctx.result];
  const rows = ctx.items.slice(0, 22).map((item) => [item.tag, item.name.replace(`${item.tag} - `, ""), item.standard, item.validUntil]);
  if (ctx.items.length > 22) rows.push(["…", `a dalších ${ctx.items.length - 22} položek`, "", ""]);
  return renderDocumentSvg({
    issuer: `Revizní technik – ${ctx.inspectorName}`,
    title: "Protokol hromadné revize",
    subtitle: "Souhrnný záznam o revizi více elektrických zařízení provedené jedním revizním technikem v jednom termínu.",
    documentNumber: ctx.protocolNumber,
    meta: [
      ["Datum provedení", ctx.inspectionDate],
      ["Počet zařízení", String(ctx.items.length)],
      ["Revizní technik", ctx.inspectorName],
      ["Ev. č. osvědčení TIČR", ctx.inspectorLicense],
      ["Měřicí přístroj", ctx.instrument ?? "–"],
      ["Celkový posudek", verdict.label.replace("Elektrické zařízení ", "")],
    ],
    sections: [
      { heading: "Revidovaná zařízení", table: [["Tag", "Zařízení", "Norma", "Platnost do"], ...rows] },
      { heading: "Zjištěné závady", lines: [ctx.defectsSummary?.trim() ? ctx.defectsSummary : "Bez závad."] },
    ],
    verdict: { label: "Celkový posudek", text: verdict.label, tone: verdict.tone },
    signature: { name: ctx.inspectorName, role: ctx.inspectorLicense, date: ctx.inspectionDate },
  });
}
