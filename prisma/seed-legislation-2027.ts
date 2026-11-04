// Ukázková data legislativního paketu 2027 (fáze 46): návody a datasheety (čisté SVG dokumenty),
// verzované zálohy řídicího SW (PLC, měniče, roboty, HMI, Safety PLC) a digitální pas baterie u UPS.
// Přírůstkově – nic nemaže, každé zařízení doplní jen jednou (`npm run db:demo-legislation`, entrypoint).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AttachmentCategory } from "../src/generated/prisma/enums";
import type { PrismaClient } from "../src/generated/prisma/client";

const UPLOADS = fileURLToPath(new URL("../storage/uploads", import.meta.url));
const PLANT = "plant-jbc";
export const LEGISLATION_MARKER = "demo.legislation-2027";
export const LEGISLATION_VERSION = 46;

const xml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Jednoduchý A4 dokument (SVG) – titulek, podtitul a odstavce; čistá grafika bez externích zdrojů. */
export function renderDocumentSvg(doc: { title: string; subtitle: string; badge: string; sections: { heading: string; lines: string[] }[] }): string {
  let y = 210;
  const body = doc.sections
    .map((section) => {
      const heading = `<text x="70" y="${y}" font-size="22" font-weight="700" fill="#0f172a">${xml(section.heading)}</text>`;
      y += 34;
      const lines = section.lines
        .map((line) => {
          const out = `<text x="86" y="${y}" font-size="16" fill="#334155">• ${xml(line)}</text>`;
          y += 26;
          return out;
        })
        .join("");
      y += 18;
      return heading + lines;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123" font-family="Arial, Helvetica, sans-serif">
<rect width="794" height="1123" fill="#ffffff"/>
<rect width="794" height="130" fill="#0f172a"/>
<rect x="70" y="40" width="${Math.max(120, doc.badge.length * 11 + 30)}" height="30" rx="6" fill="#facc15"/>
<text x="85" y="61" font-size="15" font-weight="700" fill="#0f172a">${xml(doc.badge)}</text>
<text x="70" y="108" font-size="26" font-weight="700" fill="#ffffff">${xml(doc.title)}</text>
<text x="70" y="168" font-size="17" fill="#475569">${xml(doc.subtitle)}</text>
<line x1="70" y1="182" x2="724" y2="182" stroke="#cbd5e1" stroke-width="2"/>
${body}
<text x="70" y="1085" font-size="12" fill="#94a3b8">Ukázkový dokument ELDOCK – vygenerováno pro demo knihovny návodů a datasheetů (fáze 46)</text>
</svg>
`;
}

interface DemoDocument {
  category: AttachmentCategory;
  title: string;
  componentTag?: string;
  manufacturer?: string;
  modelNumber?: string;
  version?: string;
  file: string;
  badge: string;
  subtitle: string;
  sections: { heading: string; lines: string[] }[];
}

interface DemoBackup {
  targetUnit: string;
  platform: string;
  major: number;
  minor: number;
  active: boolean;
  firmwareVersion?: string;
  safetyChecksum?: string;
  changeSummary: string;
  file: string;
  /** Číslo změnového řízení (ticket Červenky), ze kterého záloha vzešla. */
  changeNumber?: string;
  createdAt: string;
}

const DEMO: Record<string, { documents: DemoDocument[]; backups: DemoBackup[] }> = {
  "R-CNC-04": {
    documents: [
      {
        category: "DATASHEET",
        title: "Datasheet stykače ABB AF09-30-10",
        componentTag: "-K1",
        manufacturer: "ABB",
        modelNumber: "AF09-30-10-13",
        file: "r-cnc-04-abb-af09.svg",
        badge: "DATASHEET",
        subtitle: "Stykač AF09-30-10-13, 3P, 9 A AC-3, cívka 100–250 V AC/DC",
        sections: [
          { heading: "Technické parametry", lines: ["Jmenovitý proud AC-3: 9 A (400 V) / 4 kW", "Pomocné kontakty: 1 NO", "Cívka AF: 100–250 V 50/60 Hz / DC, nízký příkon", "Mechanická životnost: 10 milionů cyklů"] },
          { heading: "Montáž a připojení", lines: ["DIN lišta 35 mm, šířka 45 mm", "Utahovací moment svorek: 0,8–1,2 Nm", "Průřez vodičů: 1–4 mm²"] },
        ],
      },
      {
        category: "DRIVE_PARAMS",
        title: "Manuál frekvenčního měniče vřetene – chybové kódy",
        componentTag: "-U1",
        manufacturer: "Siemens",
        modelNumber: "SINAMICS G120 PM240-2",
        file: "r-cnc-04-sinamics-g120.svg",
        badge: "MĚNIČ / CHYBOVÉ KÓDY",
        subtitle: "SINAMICS G120 – nejčastější poruchy a parametry vřetene",
        sections: [
          { heading: "Chybové kódy", lines: ["F07801 – nadproud motoru: zkontrolujte kabel a parametr p0640", "F30002 – přepětí meziobvodu: prodlužte rampu p1121", "F07900 – zablokovaný motor: uvolněte vřeteno, ověřte brzdu"] },
          { heading: "Klíčové parametry", lines: ["p0304 jmenovité napětí motoru 400 V", "p1082 max. otáčky 12 000 min⁻¹", "p1120 / p1121 rampa rozběhu / doběhu 2,5 s"] },
        ],
      },
      {
        category: "MANUAL",
        title: "Návod k údržbě rozváděče R-CNC-04",
        manufacturer: "Rittal",
        modelNumber: "TS 8",
        file: "r-cnc-04-udrzba.svg",
        badge: "NÁVOD K ÚDRŽBĚ",
        subtitle: "Rozváděč CNC centra 04 – kontrolní intervaly",
        sections: [
          { heading: "Každý měsíc", lines: ["Kontrola filtrů ventilátorů a teploty v rozváděči (max. 35 °C)", "Vizuální kontrola stykačů a svorek"] },
          { heading: "Každý rok", lines: ["Dotažení svorek dle momentů výrobce", "Záloha programu PLC -A1 a parametrů měniče -U1 do Eldocku"] },
        ],
      },
    ],
    backups: [
      { targetUnit: "PLC -A1 (Siemens S7-1500)", platform: "TIA Portal V19", major: 1, minor: 0, active: false, firmwareVersion: "V3.0", safetyChecksum: "CRC: 0x3B17-90E4", changeSummary: "Výchozí program po uvedení do provozu (F-CPU 1516F, bezpečnostní okruh dveří).", file: "r-cnc-04-plc-a1-v1-0.xml", createdAt: "2024-03-12" },
      { targetUnit: "PLC -A1 (Siemens S7-1500)", platform: "TIA Portal V19", major: 1, minor: 1, active: true, firmwareVersion: "V3.1", safetyChecksum: "CRC: 0x8F4A-2C91", changeSummary: "Nový vřeteník: úprava rozběhové rampy a hlídání proudu vřetene, bezpečnostní program beze změny funkce (nové F-Signature).", file: "r-cnc-04-plc-a1-v1-1.xml", changeNumber: "ZM-2025-0007", createdAt: "2025-02-24" },
      { targetUnit: "Frekvenční měnič vřetene -U1", platform: "Parametry měniče VFD", major: 1, minor: 0, active: true, firmwareVersion: "V4.7 SP14", changeSummary: "Parametrová sada měniče SINAMICS G120 pro vřeteno 12 000 min⁻¹.", file: "r-cnc-04-vfd-u1-v1-0.json", createdAt: "2025-02-24" },
    ],
  },
  "CNC-04": {
    documents: [
      {
        category: "MANUAL",
        title: "Návod k obsluze CNC centra DMU 65 monoBLOCK (Nařízení EU 2023/1230)",
        manufacturer: "DMG MORI",
        modelNumber: "DMU 65 monoBLOCK",
        version: "3.2",
        file: "cnc-04-navod.svg",
        badge: "NÁVOD K OBSLUZE",
        subtitle: "Digitální návod dle čl. 10 Nařízení (EU) 2023/1230",
        sections: [
          { heading: "Bezpečnost obsluhy", lines: ["Práce jen se zavřenými dveřmi pracovního prostoru", "Režim seřizování: max. 2 m/min, klíč režimu u mistra", "Nouzové zastavení: tlačítko na panelu a v zadní části stroje"] },
          { heading: "Denní kontrola", lines: ["Hladina chladicí kapaliny a mazání vřetene", "Funkce dveřního spínače (bezpečnostní okruh)"] },
        ],
      },
      {
        category: "CERTIFICATE",
        title: "EU prohlášení o shodě stroje DMU 65",
        manufacturer: "DMG MORI",
        file: "cnc-04-shoda.svg",
        badge: "EU PROHLÁŠENÍ O SHODĚ",
        subtitle: "Nařízení (EU) 2023/1230, EMC 2014/30/EU",
        sections: [{ heading: "Použité normy", lines: ["ČSN EN ISO 16090-1 – Bezpečnost obráběcích center", "ČSN EN 60204-1 ed. 3 – Elektrická zařízení strojů"] }],
      },
    ],
    backups: [{ targetUnit: "CNC řízení Heidenhain TNC 640", platform: "Heidenhain TNCremo", major: 1, minor: 0, active: true, firmwareVersion: "NC SW 34059x-17", changeSummary: "Záloha strojních parametrů a cyklů po servisní prohlídce.", file: "cnc-04-tnc640-v1-0.zip.json", createdAt: "2025-09-15" }],
  },
  "LIS-01": {
    documents: [
      {
        category: "MANUAL",
        title: "Návod k obsluze hydraulického lisu HPH 400",
        manufacturer: "Schuler",
        modelNumber: "HPH 400",
        file: "lis-01-navod.svg",
        badge: "NÁVOD K OBSLUZE",
        subtitle: "Lis 400 t – obsluha, seřízení nástroje, bezpečnostní světelná závora",
        sections: [{ heading: "Bezpečnost", lines: ["Světelná závora -B1 a dvouruční ovládání", "Zkouška doběhu beranu 1× týdně", "Zásah do Safety PLC jen se změnovým řízením (Červenka)"] }],
      },
      {
        category: "FLUID_SCHEMA",
        title: "Schéma hydrauliky lisu HPH 400",
        manufacturer: "Schuler",
        file: "lis-01-hydraulika.svg",
        badge: "HYDRAULIKA",
        subtitle: "Hydraulický agregát 2× 55 kW, bezpečnostní ventil -Y3",
        sections: [{ heading: "Prvky", lines: ["-M1, -M2 čerpadla 55 kW", "-Y3 dvojitý bezpečnostní ventil (kategorie 4)", "-B5 tlakový snímač 0–400 bar"] }],
      },
    ],
    backups: [
      { targetUnit: "Safety PLC -A1 (Pilz PNOZmulti 2)", platform: "PNOZmulti Configurator", major: 1, minor: 3, active: false, firmwareVersion: "V1.4", safetyChecksum: "CRC: 0x7D20-11AF", changeSummary: "Doplnění muting funkce pro zakládání plechů.", file: "lis-01-pnoz-v1-3.xml", createdAt: "2024-06-03" },
      { targetUnit: "Safety PLC -A1 (Pilz PNOZmulti 2)", platform: "PNOZmulti Configurator", major: 2, minor: 0, active: true, firmwareVersion: "V1.6", safetyChecksum: "CRC: 0x51C3-9A07", changeSummary: "Nová revize bezpečnostního programu: dvouruční ovládání typu IIIC a hlídání doběhu beranu.", file: "lis-01-pnoz-v2-0.xml", createdAt: "2025-11-20" },
    ],
  },
  "ROB-03": {
    documents: [
      {
        category: "MANUAL",
        title: "Návod k obsluze robotické buňky KUKA KR 210",
        manufacturer: "KUKA",
        modelNumber: "KR 210 R2700",
        file: "rob-03-navod.svg",
        badge: "NÁVOD K OBSLUZE",
        subtitle: "Robotická buňka odebírání výlisků – provoz a bezpečnost",
        sections: [{ heading: "Provozní režimy", lines: ["T1 ruční redukovaná rychlost 250 mm/s", "AUT automatický provoz jen se zavřeným oplocením", "Restart po otevření dveří přes potvrzovací tlačítko"] }],
      },
      {
        category: "DATASHEET",
        title: "Datasheet bezpečnostního laserového skeneru",
        componentTag: "-B1",
        manufacturer: "SICK",
        modelNumber: "microScan3 Core",
        file: "rob-03-sick-microscan3.svg",
        badge: "DATASHEET",
        subtitle: "Bezpečnostní laserový skener, PL d, ochranné pole 5,5 m",
        sections: [{ heading: "Parametry", lines: ["Ochranné pole až 5,5 m, varovné 40 m", "Kategorie 3, PL d dle ČSN EN ISO 13849-1", "Výstupy OSSD 2× PNP"] }],
      },
    ],
    backups: [
      { targetUnit: "Robot KUKA KRC4", platform: "KUKA KRC4", major: 1, minor: 1, active: false, firmwareVersion: "KSS 8.6.9", changeSummary: "Úprava trajektorie odebírání pro nový nástroj LIS-02.", file: "rob-03-krc4-v1-1.zip.json", createdAt: "2025-04-10" },
      { targetUnit: "Robot KUKA KRC4", platform: "KUKA KRC4", major: 1, minor: 2, active: true, firmwareVersion: "KSS 8.6.10", safetyChecksum: "CRC: 0xA4E1-0C55", changeSummary: "SafeOperation: zmenšení pracovního prostoru u dveří obsluhy (nový checksum bezpečnostní konfigurace).", file: "rob-03-krc4-v1-2.zip.json", createdAt: "2025-10-02" },
      { targetUnit: "HMI Panel", platform: "WinCC Unified", major: 1, minor: 0, active: true, firmwareVersion: "V19", changeSummary: "Obrazovky buňky a hlášení poruch v češtině.", file: "rob-03-hmi-v1-0.xml", createdAt: "2025-04-10" },
    ],
  },
  "PV-M1": {
    documents: [
      {
        category: "DATASHEET",
        title: "Datasheet stykače vrat -Q1",
        componentTag: "-Q1",
        manufacturer: "Schneider Electric",
        modelNumber: "LC1D09P7",
        file: "pv-m1-lc1d09.svg",
        badge: "DATASHEET",
        subtitle: "TeSys D LC1D09P7 – reverzační kombinace vrat",
        sections: [{ heading: "Parametry", lines: ["9 A AC-3, cívka 230 V AC", "Mechanické blokování s -Q2 (LAD9R1)"] }],
      },
      {
        category: "MANUAL",
        title: "Návod řídicí jednotky vrat -UC2",
        componentTag: "-UC2",
        manufacturer: "Siemens",
        modelNumber: "LOGO! 8.4",
        file: "pv-m1-logo.svg",
        badge: "NÁVOD",
        subtitle: "Řídicí jednotka sekčních vrat – vstupy, výstupy a poruchy",
        sections: [{ heading: "Vstupy", lines: ["I1 STOP, I2 nahoru, I3 dolů", "I4/I5 koncové spínače"] }],
      },
    ],
    backups: [],
  },
};

/** Digitální pas baterie UPS v rozváděči RZ1 (Nařízení (EU) 2023/1542). */
export const RZ1_BATTERY_PASSPORT = {
  capacityKwh: 48,
  chemistry: "LiFePO4",
  stateOfHealthPct: 97,
  nominalVoltageV: 512,
  cellManufacturer: "CATL",
  cellStatus: "16 modulů v normě, max. odchylka napětí článků 12 mV",
  manufacturedYear: 2023,
  passportId: "EU-BP-EATON-93PM-2023-0481",
};

function backupFile(tag: string, backup: DemoBackup): string {
  if (backup.file.endsWith(".xml")) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<EldockBackup equipment="${tag}" unit="${xml(backup.targetUnit)}" platform="${xml(backup.platform)}" version="v${backup.major}.${backup.minor}">\n  <Firmware>${xml(backup.firmwareVersion ?? "")}</Firmware>\n  <SafetyChecksum>${xml(backup.safetyChecksum ?? "")}</SafetyChecksum>\n  <Summary>${xml(backup.changeSummary)}</Summary>\n</EldockBackup>\n`;
  }
  return `${JSON.stringify({ equipment: tag, unit: backup.targetUnit, platform: backup.platform, version: `v${backup.major}.${backup.minor}`, firmware: backup.firmwareVersion ?? null, parameters: { demo: true } }, null, 2)}\n`;
}

/**
 * Doplní návody, datasheety a zálohy SW u ukázkových strojů (jen zařízení bez vlastních dokumentů /
 * záloh) a pas baterie RZ1 (jen když chybí). Jednorázově podle značky; nic nemaže.
 */
export async function seedLegislation2027(prisma: PrismaClient, options: { force?: boolean } = {}) {
  const result = { skipped: false, documents: 0, backups: 0, battery: false };
  const marker = await prisma.tenantSetting.findUnique({ where: { key: LEGISLATION_MARKER }, select: { value: true } });
  if (!options.force && Number(marker?.value ?? 0) >= LEGISLATION_VERSION) return { ...result, skipped: true };

  const [maintenance, cae] = await Promise.all([
    prisma.user.findFirst({ where: { role: "MAINTENANCE" }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: "CAE_ENGINEER" }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);
  const attachments = path.join(UPLOADS, "attachments", "seed");
  const software = path.join(UPLOADS, "software", "seed");
  await mkdir(attachments, { recursive: true });
  await mkdir(software, { recursive: true });

  for (const [tag, demo] of Object.entries(DEMO)) {
    const equipment = await prisma.equipment.findFirst({ where: { tag, floor: { building: { plantId: PLANT } } }, select: { id: true, _count: { select: { documents: true, softwareBackups: true } } } });
    if (!equipment) continue;
    if (!equipment._count.documents) {
      for (const document of demo.documents) {
        const svg = renderDocumentSvg({ title: document.title, subtitle: document.subtitle, badge: document.badge, sections: document.sections });
        await writeFile(path.join(attachments, document.file), svg);
        await prisma.equipmentDocument.create({
          data: {
            equipmentId: equipment.id,
            category: document.category,
            title: document.title,
            componentTag: document.componentTag ?? null,
            manufacturer: document.manufacturer ?? null,
            modelNumber: document.modelNumber ?? null,
            version: document.version ?? "1.0",
            fileUrl: `/api/files/attachments/seed/${document.file}`,
            fileName: document.file,
            fileSizeBytes: Buffer.byteLength(svg),
            uploadedById: maintenance?.id ?? null,
          },
        });
        result.documents++;
      }
    }
    if (!equipment._count.softwareBackups) {
      for (const backup of demo.backups) {
        const content = backupFile(tag, backup);
        const fileName = backup.file.replace(/\.zip\.json$/, ".json");
        await writeFile(path.join(software, fileName), content);
        const change = backup.changeNumber ? await prisma.changeRequest.findUnique({ where: { number: backup.changeNumber }, select: { id: true, equipmentId: true } }) : null;
        await prisma.softwareBackup.create({
          data: {
            equipmentId: equipment.id,
            targetUnit: backup.targetUnit,
            platform: backup.platform,
            major: backup.major,
            minor: backup.minor,
            status: backup.active ? "ACTIVE" : "ARCHIVED",
            firmwareVersion: backup.firmwareVersion ?? null,
            isSafetyRelated: !!backup.safetyChecksum,
            safetyChecksum: backup.safetyChecksum ?? null,
            changeSummary: backup.changeSummary,
            fileUrl: `/api/files/software/seed/${fileName}`,
            fileName,
            fileSizeBytes: Buffer.byteLength(content),
            changeRequestId: change && change.equipmentId === equipment.id ? change.id : null,
            authorId: cae?.id ?? null,
            createdAt: new Date(`${backup.createdAt}T09:00:00Z`),
          },
        });
        result.backups++;
      }
    }
  }

  const rz1 = await prisma.equipment.findFirst({ where: { tag: "RZ1", floor: { building: { plantId: PLANT } } }, select: { id: true, batteryPassportJson: true } });
  if (rz1 && !rz1.batteryPassportJson) {
    await prisma.equipment.update({ where: { id: rz1.id }, data: { batteryPassportJson: JSON.stringify(RZ1_BATTERY_PASSPORT) } });
    result.battery = true;
  }
  await prisma.tenantSetting.upsert({ where: { key: LEGISLATION_MARKER }, create: { key: LEGISLATION_MARKER, value: String(LEGISLATION_VERSION) }, update: { value: String(LEGISLATION_VERSION) } });
  return result;
}
