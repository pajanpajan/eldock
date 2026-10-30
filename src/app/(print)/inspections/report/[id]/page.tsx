import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/common/PrintToolbar";
import { LogoMark } from "@/components/layout/Logo";
import { BRAND } from "@/lib/brand";
import { EQUIPMENT_TYPE_LABELS, INSPECTION_TYPE_LABELS, formatDate } from "@/lib/format";
import { PROTOCOL_TITLES, VERDICTS, protocolMeasurements, protocolScope, protocolVariant } from "@/lib/inspection-protocol";
import { USAGE_GROUP_LABELS, type UsageGroup } from "@/lib/inspection-rules";
import { getFeatures } from "@/server/modules";
import { getInspectionProtocol } from "@/server/queries/inspections";
import { getCurrentAccount } from "@/server/session";

type Props = PageProps<"/inspections/report/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const record = await getInspectionProtocol(id);
  return { title: record ? `Revizní zpráva ${record.reportNumber}` : "Revizní zpráva" };
}

const SEVERITY: Record<string, string> = { CRITICAL: "kritická", MAJOR: "závažná", MINOR: "drobná" };

// Revizní protokol A4 k tisku / uložení do PDF – varianta VTZ nebo spotřebiče podle typu zařízení.
export default async function InspectionReportPage({ params }: Props) {
  const { id } = await params;
  const [record, account, modules] = await Promise.all([getInspectionProtocol(id), getCurrentAccount(), getFeatures()]);
  if (!record || !modules.on("inspections.pdf_reports") || !account.can("inspections") || !account.canSee(record.equipment.type)) notFound();

  const { equipment } = record;
  const { building } = equipment.floor;
  const { plant } = building;
  const variant = protocolVariant(equipment.type);
  const heading = PROTOCOL_TITLES[variant];
  const scope = protocolScope(equipment);
  const measurements = protocolMeasurements({ record, equipment });
  const appliance = variant === "APPLIANCE";

  const facts: [string, React.ReactNode][] = [
    ["Zařízení", equipment.name],
    [appliance ? "Evidenční číslo" : "Označení", <span key="tag" className="font-mono">{equipment.inventoryNumber ? `${equipment.inventoryNumber} · ${equipment.tag}` : equipment.tag}</span>],
    ["Druh zařízení", EQUIPMENT_TYPE_LABELS[equipment.type]],
    ["Výrobce / typ", [equipment.manufacturer, equipment.model].filter(Boolean).join(" ") || "–"],
    ["Výrobní číslo", equipment.serialNumber ?? "–"],
    ["Umístění", [`${building.name} › ${equipment.floor.name}`, equipment.assignedZone].filter(Boolean).join(" · ")],
    ["Jmenovité hodnoty", [equipment.ratedVoltage, equipment.ratedCurrent, equipment.ipRating].filter(Boolean).join(" · ") || "–"],
    appliance
      ? ["Třída ochrany / skupina", `${equipment.protectionClass ?? "I"} · ${equipment.usageGroup ? (USAGE_GROUP_LABELS[equipment.usageGroup as UsageGroup] ?? equipment.usageGroup) : "–"}`]
      : ["Vnější vlivy", equipment.externalInfluences ?? "normální prostory (ČSN 33 2000-5-51)"],
  ];
  const inspection: [string, React.ReactNode][] = [
    ["Druh revize", INSPECTION_TYPE_LABELS[record.type]],
    ["Datum provedení", formatDate(record.inspectionDate)],
    ["Příští pravidelná revize", formatDate(record.validUntil)],
    ["Norma / lhůta", `${scope.standard} · ${scope.months} měsíců`],
    ["Revizní technik", record.inspectorName],
    [appliance ? "Osvědčení / oprávnění" : "Ev. č. osvědčení TIČR", record.inspectorLicense],
    ["Měřicí přístroj", record.measuringInstrument ?? "–"],
  ];

  return (
    <div className="protocol-print flex flex-1 flex-col items-center gap-4 p-4 sm:p-6">
      <style>{`
        @page { size: A4 portrait; margin: 10mm 12mm; }
        @media print {
          html, body { background: #fff !important; height: auto !important; min-height: 0 !important; display: block !important; }
          main { display: block !important; }
          .protocol-print { display: block !important; padding: 0 !important; }
          .protocol-print .no-print { display: none !important; }
          .protocol-print .sheet { width: auto !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; border: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <PrintToolbar className="max-w-[210mm]" hint={`Revizní zpráva ${record.reportNumber} · A4. Pro PDF zvolte v dialogu tisku „Uložit jako PDF“.`} />

      <article className="sheet flex w-full max-w-[210mm] flex-col gap-4 bg-white p-[12mm] text-[10pt] leading-snug text-black shadow-2xl shadow-black/50 sm:min-h-[297mm]" data-testid="inspection-protocol" data-variant={variant}>
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
          <div className="space-y-1">
            <p className="text-[8pt] font-semibold tracking-[0.12em] text-zinc-600 uppercase">{heading.basis}</p>
            <h1 className="text-[17pt] leading-tight font-bold">{heading.title}</h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[8pt] text-zinc-600">Evidenční číslo zprávy</p>
            <p className="font-mono text-[12pt] font-bold">{record.reportNumber}</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[7.5pt] font-semibold text-zinc-600">
              <LogoMark className="size-3.5" /> {BRAND.mark} · {BRAND.domain}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-zinc-400 p-3">
          <p className="col-span-2 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Provozovatel</p>
          <p className="font-semibold">{plant.customerName}</p>
          <p>
            {plant.name} ({plant.code})
          </p>
          <p className="col-span-2 text-zinc-700">{[plant.address, plant.city].filter(Boolean).join(", ") || "–"}</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <FactTable title="Revidované zařízení" rows={facts} />
          <FactTable title="Revize" rows={inspection} />
        </div>

        <section>
          <h2 className="mb-1.5 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Naměřené hodnoty a zkoušky</h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-zinc-100">
                {["Zkouška / měření", "Veličina", "Naměřeno", "Mezní hodnota", "Vyhodnocení"].map((head) => (
                  <th key={head} className="border border-zinc-400 px-2 py-1 text-[8.5pt] font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {measurements.map((row) => (
                <tr key={row.symbol + row.label}>
                  <td className="border border-zinc-400 px-2 py-1">{row.label}</td>
                  <td className="border border-zinc-400 px-2 py-1 font-mono">{row.symbol}</td>
                  <td className="border border-zinc-400 px-2 py-1 font-mono font-semibold">{row.value}</td>
                  <td className="border border-zinc-400 px-2 py-1 font-mono">{row.limit}</td>
                  <td className="border border-zinc-400 px-2 py-1 font-semibold">{row.ok === null ? "–" : row.ok ? "vyhovuje" : "NEVYHOVUJE"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!appliance ? <p className="mt-1 text-[8pt] text-zinc-600">Prohlídka, zkoušení a měření dle ČSN 33 2000-6 ed. 2; spojitost ochranných a pospojovacích vodičů, izolační odpor zkušebním napětím 500 V DC.</p> : null}
        </section>

        <section>
          <h2 className="mb-1.5 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Zjištěné závady</h2>
          {record.defects.length ? (
            <ol className="list-decimal space-y-0.5 pl-5">
              {record.defects.map((defect) => (
                <li key={defect.id}>
                  {defect.description} <span className="text-zinc-600">({SEVERITY[defect.severity] ?? defect.severity}, odstranit do {formatDate(defect.deadline)})</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>{record.defectsSummary ?? "Bez závad."}</p>
          )}
        </section>

        <section className="break-inside-avoid rounded border-2 border-black p-3" data-testid="protocol-verdict">
          <p className="text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Celkový posudek</p>
          <p className="text-[13pt] font-bold">{VERDICTS[record.result]}</p>
        </section>

        <section className="mt-auto grid break-inside-avoid grid-cols-2 gap-6 pt-2">
          <SignatureBox title="Revizní technik" lines={[record.inspectorName, record.inspectorLicense, `Datum: ${formatDate(record.inspectionDate)}`]} stamp />
          <SignatureBox title="Převzal za provozovatele" lines={["Jméno:", "Funkce:", "Datum:"]} />
        </section>

        <footer className="border-t border-zinc-400 pt-1.5 text-[7.5pt] text-zinc-600">
          Vystaveno v systému {BRAND.name} ({BRAND.domain}) · zařízení {equipment.tag} · zpráva {record.reportNumber}. Originál revizní zprávy uchovává provozovatel po dobu životnosti zařízení.
        </footer>
      </article>
    </div>
  );
}

function FactTable({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">{title}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-zinc-600">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SignatureBox({ title, lines, stamp = false }: { title: string; lines: string[]; stamp?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">{title}</p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <div className="mt-1 flex h-20 items-end justify-between gap-3 border-b border-dashed border-zinc-500 pb-1 text-[8pt] text-zinc-500">
        <span>Podpis</span>
        {stamp ? <span className="flex size-16 items-center justify-center rounded-full border border-dashed border-zinc-400 text-center">Razítko</span> : null}
      </div>
    </div>
  );
}
