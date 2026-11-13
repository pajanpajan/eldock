import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/common/PrintToolbar";
import { InspectorStamp } from "@/components/inspections/InspectorStamp";
import { PadesUpload } from "@/components/inspections/PadesUpload";
import { prisma } from "@/lib/prisma";
import { MISUSE_BANNER, sealTimestamp } from "@/lib/revision-signature";
import { verifySeal } from "@/server/services/revision-signing";
import { LogoMark } from "@/components/layout/Logo";
import { BRAND } from "@/lib/brand";
import { BUILDING_TYPE_LABELS, EQUIPMENT_TYPE_LABELS, INSPECTION_TYPE_LABELS, formatDate } from "@/lib/format";
import { PROTOCOL_TITLES, VERDICTS, monthsBetween, protocolBatteryPassport, protocolMeasurements, protocolScope, protocolVariant } from "@/lib/inspection-protocol";
import { defaultActs, defaultScopeNote, isReportType } from "@/lib/inspection-report";
import { INSTALLATION_KIND_LABELS, USAGE_GROUP_LABELS, legalDeadline, ruleInputFrom, type UsageGroup } from "@/lib/inspection-rules";
import { getFeatures } from "@/server/modules";
import { getInspectionProtocol } from "@/server/queries/inspections";
import { getCurrentAccount } from "@/server/session";
import { IP_NOTICE } from "@/lib/legal";

type Props = PageProps<"/inspections/report/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const record = await getInspectionProtocol(id);
  return { title: record ? `Revizní zpráva ${record.reportNumber}` : "Revizní zpráva" };
}

const SEVERITY: Record<string, string> = { CRITICAL: "kritická", MAJOR: "závažná", MINOR: "drobná" };
const NOT_RECORDED = "Neuvedeno v záznamu (zapsáno před fází 66).";

// Revizní protokol A4 k tisku / uložení do PDF – varianta VTZ nebo spotřebiče podle typu zařízení. U zprávy o revizi
// VTZ obsahuje náležitosti podle NV 190/2022 Sb., § 10 odst. 1 písm. a–o (fáze 66).
export default async function InspectionReportPage({ params }: Props) {
  const { id } = await params;
  const [record, account, modules] = await Promise.all([getInspectionProtocol(id), getCurrentAccount(), getFeatures()]);
  if (!record || !modules.on("inspections.pdf_reports") || !account.can("inspections") || !account.canSee(record.equipment.type)) notFound();

  const { equipment } = record;
  // Fáze 108: podepsaná revize – přepočet pečeti SHA-256 z uložených údajů protokolu
  const seal = record.sealHash ? await verifySeal(prisma, record.id) : null;
  const signedTime = record.signedAt ? sealTimestamp(record.signedAt) : null;
  const { building } = equipment.floor;
  const { plant } = building;
  const variant = protocolVariant(equipment.type);
  const heading = PROTOCOL_TITLES[variant];
  const scope = protocolScope(ruleInputFrom(equipment, building));
  const measurements = protocolMeasurements({ record, equipment });
  const appliance = variant === "APPLIANCE";
  const report = isReportType(record.type);
  const location = `${building.name} › ${equipment.floor.name}`;
  // a) provozovatel – název a sídlo (registrovaná firma závodu, jinak údaje závodu)
  const company = plant.registeredCompanies[0] ?? null;
  const operatorName = company?.companyName ?? plant.customerName;
  const operatorSeat = company ? `${company.street}, ${company.zip} ${company.city}` : [plant.address, plant.city].filter(Boolean).join(", ") || "–";
  const deadline = record.result === "INCAPABLE" ? null : legalDeadline(record.inspectionDate, record.validUntil, scope);
  const legal = deadline && deadline.getTime() !== record.validUntil.getTime() ? { date: deadline, shorter: deadline.getTime() < record.validUntil.getTime() } : null;
  const recommended = monthsBetween(record.inspectionDate, record.validUntil);
  const certificate = [
    record.inspectorLicense,
    record.inspectorScope && !record.inspectorLicense.includes(record.inspectorScope) ? `rozsah ${record.inspectorScope}` : null,
    record.inspectorValidUntil ? `platné do ${formatDate(record.inspectorValidUntil)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const scopeNote = record.scopeNote ?? (report ? defaultScopeNote({ equipment, location, kind: scope.kind }) : null);
  const acts = record.actsPerformed ?? (report ? defaultActs(scope.kind) : null);
  const vtz = scope.kind === "VTZ" || scope.kind === "LPS";

  const facts: [string, React.ReactNode][] = [
    ["Zařízení", equipment.name],
    [appliance ? "Evidenční číslo" : "Označení", <span key="tag" className="font-mono">{equipment.inventoryNumber ? `${equipment.inventoryNumber} · ${equipment.tag}` : equipment.tag}</span>],
    ["Druh zařízení", EQUIPMENT_TYPE_LABELS[equipment.type]],
    ["Výrobce / typ", [equipment.manufacturer, equipment.model].filter(Boolean).join(" ") || "–"],
    ["Výrobní číslo", equipment.serialNumber ?? "–"],
    ["Umístění", [location, equipment.assignedZone].filter(Boolean).join(" · ")],
    ["Jmenovité hodnoty", [equipment.ratedVoltage, equipment.ratedCurrent, equipment.ipRating].filter(Boolean).join(" · ") || "–"],
    appliance
      ? ["Třída ochrany / skupina", `${equipment.protectionClass ?? "I"} · ${equipment.usageGroup ? (USAGE_GROUP_LABELS[equipment.usageGroup as UsageGroup] ?? equipment.usageGroup) : "–"}`]
      : ["Vnější vlivy", equipment.externalInfluences ?? "neurčeny"],
    ...(vtz
      ? ([
          ["Účel objektu", `${BUILDING_TYPE_LABELS[building.type]}${building.crowdOver200 ? " · více než 200 osob (PBŘ)" : ""}`],
          ...(equipment.installationKind !== "STANDARD" ? [["Provedení", INSTALLATION_KIND_LABELS[equipment.installationKind]]] : []),
        ] as [string, React.ReactNode][])
      : []),
  ];
  const inspection: [string, React.ReactNode][] = [
    ["Druh revize", record.type === "EXTRAORDINARY" && record.extraordinaryReason ? `${INSPECTION_TYPE_LABELS[record.type]} – ${record.extraordinaryReason}` : INSPECTION_TYPE_LABELS[record.type]],
    ...(report
      ? ([
          ["Zahájení / ukončení", `${record.startedAt ? formatDate(record.startedAt) : "–"} / ${formatDate(record.inspectionDate)}`],
          ["Vypracování / předání", `${record.reportedAt ? formatDate(record.reportedAt) : "–"} / ${record.handedOverAt ? formatDate(record.handedOverAt) : "při převzetí (podpis)"}`],
        ] as [string, React.ReactNode][])
      : ([["Datum provedení", formatDate(record.inspectionDate)]] as [string, React.ReactNode][])),
    ["Předpis / nejdelší lhůta", `${scope.standard} · ${scope.maxMonths} měsíců`],
    [record.type === "THERMOVISION" ? "Termodiagnostik" : "Revizní technik", record.inspectorName],
    [appliance ? "Osvědčení / oprávnění" : "Ev. č. osvědčení", certificate],
    ["Měřicí přístroje", record.measuringInstrument ?? "–"],
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
      {record.sealHash && account.can("recordInspection") && !record.misuseFlaggedAt ? (
        <div className="no-print w-full max-w-[210mm]">
          <PadesUpload inspectionId={record.id} padesUrl={record.padesUrl} padesInfo={record.padesInfo} />
        </div>
      ) : null}

      <article className="sheet flex w-full max-w-[210mm] flex-col gap-4 bg-white p-[12mm] text-[10pt] leading-snug text-black shadow-2xl shadow-black/50 sm:min-h-[297mm]" data-testid="inspection-protocol" data-variant={variant}>
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
          <div className="space-y-1">
            <p className="text-[8pt] font-semibold tracking-[0.12em] text-zinc-600 uppercase">{scope.kind === "LPS" ? `${heading.basis.replace(" · ČSN 33 2000-6 ed. 2", "")} · ČSN EN 62305-3` : heading.basis}</p>
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

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-zinc-400 p-3" data-testid="protocol-operator">
          <p className="col-span-2 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Provozovatel</p>
          <p className="font-semibold">{operatorName}</p>
          <p>{company ? `IČO ${company.ico}` : ""}</p>
          <p className="text-zinc-700">Sídlo: {operatorSeat}</p>
          <p className="text-zinc-700">
            Provozovna: {plant.name} ({plant.code}){company ? "" : ` · ${[plant.address, plant.city].filter(Boolean).join(", ") || "–"}`}
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <FactTable title="Revidované zařízení" rows={facts} />
          <FactTable title="Revize" rows={inspection} />
        </div>

        {scopeNote ? <TextSection title="Rozsah revize" text={scopeNote} testId="protocol-scope" /> : null}
        {report ? <TextSection title="Podklady a jejich vyhodnocení" text={record.documentsUsed ?? NOT_RECORDED} testId="protocol-documents" /> : null}
        {acts ? <TextSection title="Provedené úkony" text={acts} testId="protocol-acts" /> : null}

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
        </section>

        {protocolBatteryPassport(equipment) ? (
          <section className="break-inside-avoid" data-testid="protocol-battery-passport">
            <h2 className="mb-1.5 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Digitální pas baterie dle Nařízení (EU) 2023/1542</h2>
            <table className="w-full border-collapse text-[8pt]">
              <tbody>
                {protocolBatteryPassport(equipment)!.map(([label, value]) => (
                  <tr key={label}>
                    <td className="w-1/3 border border-zinc-400 px-1.5 py-0.5 text-zinc-600">{label}</td>
                    <td className="border border-zinc-400 px-1.5 py-0.5 font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section data-testid="protocol-defects">
          <h2 className="mb-1.5 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">{vtz ? "Zjištěné závady a porušená ustanovení" : "Zjištěné závady"}</h2>
          {record.defects.length ? (
            <ol className="list-decimal space-y-0.5 pl-5">
              {record.defects.map((defect) => (
                <li key={defect.id}>
                  {defect.description}
                  {defect.provision ? <span className="font-semibold"> – porušeno: {defect.provision}</span> : null}{" "}
                  <span className="text-zinc-600">({SEVERITY[defect.severity] ?? defect.severity}, odstranit do {formatDate(defect.deadline)})</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>{record.defectsSummary ?? "Bez závad."}</p>
          )}
        </section>

        {report ? <TextSection title="Vyhodnocení předchozí revize, provozu a údržby" text={record.previousEvaluation ?? NOT_RECORDED} testId="protocol-previous" /> : null}

        <section className="break-inside-avoid rounded border-2 border-black p-3" data-testid="protocol-verdict">
          <p className="text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Celkový posudek</p>
          <p className="text-[13pt] font-bold">{VERDICTS[record.result]}</p>
        </section>

        <section className="break-inside-avoid" data-testid="protocol-next">
          <h2 className="mb-1 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">Doporučená lhůta příští revize</h2>
          {record.result === "INCAPABLE" ? (
            <p>Po odstranění závad – před uvedením do provozu provést mimořádnou revizi.</p>
          ) : (
            <p>
              <span className="font-semibold">
                {recommended} měsíců – nejpozději do {formatDate(record.validUntil)}
              </span>
              {legal && !legal.shorter ? ` (zákonná lhůta umožňuje provést revizi do ${formatDate(legal.date)}, NV 190/2022 Sb., příloha č. 4, pozn. b)` : ""}.
              {legal?.shorter ? ` Nejzazší termín podle NV 190/2022 Sb., příloha č. 4: ${formatDate(legal.date)}.` : ""}
              {record.validUntilOriginal ? ` Platnost zkrácena na nejdelší zákonnou lhůtu, ve zprávě bylo uvedeno ${formatDate(record.validUntilOriginal)}.` : ""}
            </p>
          )}
        </section>

        {/* Fáze 108: revize zneplatněná technikem – červené varování i v tisku */}
        {record.misuseFlaggedAt ? (
          <p className="rounded border-2 border-red-600 bg-red-50 px-3 py-2 text-[10pt] font-bold text-red-700" data-testid="protocol-misuse">
            {MISUSE_BANNER} ({formatDate(record.misuseFlaggedAt)}){record.misuseNote ? ` – ${record.misuseNote}` : ""}
          </p>
        ) : null}

        <section className="mt-auto grid break-inside-avoid grid-cols-2 gap-6 pt-2">
          <SignatureBox
            title="Revizní technik"
            lines={[
              record.inspectorName,
              `Osvědčení ${certificate}`,
              ...(record.inspectorAuthorization ? [`Oprávnění TIČR ${record.inspectorAuthorization}`] : []),
              ...(record.inspectorCompany ? [[record.inspectorCompany, record.inspectorIco ? `IČO ${record.inspectorIco}` : null].filter(Boolean).join(" · ")] : []),
              `Zprávu vypracoval dne: ${formatDate(record.reportedAt ?? record.inspectionDate)}`,
            ]}
            stamp
            signed={
              record.sealHash
                ? {
                    signatureUrl: record.signatureUrl,
                    stamp: { name: record.inspectorName, certificateNo: record.inspectorLicense, certificateScope: record.inspectorScope, authorizationNo: record.inspectorAuthorization, company: record.inspectorCompany },
                  }
                : null
            }
          />
          <SignatureBox title="Převzal za provozovatele" lines={["Jméno:", "Funkce:", `Datum převzetí: ${record.handedOverAt ? formatDate(record.handedOverAt) : ""}`]} />
        </section>

        {/* Fáze 108: patička uzamčeného protokolu – pečeť SHA-256, časové razítko UTC / SEČ, IP a zařízení, PAdES */}
        {record.sealHash && seal ? (
          <section className="break-inside-avoid rounded border border-zinc-400 bg-zinc-50 px-3 py-2 text-[7.5pt] leading-relaxed text-zinc-700" data-testid="protocol-seal" data-seal={seal.status}>
            <p className="font-mono text-[7.5pt] break-all">Pečeť SHA-256: {record.sealHash}</p>
            <p>
              Ověření pečeti: {seal.status === "VALID" ? "✅ shoda – obsah protokolu od podpisu nezměněn" : "⛔ NESHODA – údaje protokolu byly po podpisu změněny"} ({seal.count} {seal.count === 1 ? "záznam" : "záznamů"} protokolu).
            </p>
            <p>
              Elektronicky podepsal(a): {record.inspectorName} · osvědčení TIČR č. {record.inspectorLicense}
              {record.pinVerified ? " · vydání potvrzeno osobním PINem" : ""}
            </p>
            {signedTime ? (
              <p>
                Časové razítko: {signedTime.utc} · {signedTime.local} · IP {record.signedIp ?? "neuvedena"}
                {record.signedDevice ? ` · ${record.signedDevice}` : ""}
              </p>
            ) : null}
            <p>
              {record.padesUrl ? `Kvalifikovaný elektronický podpis PAdES připojen ${record.padesUploadedAt ? formatDate(record.padesUploadedAt) : ""} (${record.padesInfo?.split(" · SHA-256")[0] ?? "PDF"}). ` : ""}
              Prostý elektronický podpis s pečetí obsahu (eIDAS čl. 25 odst. 1){record.padesUrl ? "; kvalifikovaný podpis PAdES (eIDAS čl. 25 odst. 2, zákon č. 297/2016 Sb.)." : "; kvalifikovaný podpis PAdES lze připojit."}
            </p>
          </section>
        ) : null}

        <footer className="border-t border-zinc-400 pt-1.5 text-[7.5pt] text-zinc-600">
          Vystaveno v systému {BRAND.name} ({BRAND.domain}) · zařízení {equipment.tag} · zpráva {record.reportNumber}. Originál revizní zprávy uchovává provozovatel po dobu životnosti zařízení. Elektronicky předaná zpráva musí být podepsána uznávaným elektronickým podpisem (NV 190/2022 Sb., § 10 odst. 1 písm. d).
          {/* Fáze 104: ochrana databáze a autorských práv */}
          <span className="mt-1 block text-[6.5pt] text-zinc-500" data-testid="doc-ip-notice">
            {IP_NOTICE}
          </span>
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

function TextSection({ title, text, testId }: { title: string; text: string; testId: string }) {
  return (
    <section className="break-inside-avoid" data-testid={testId}>
      <h2 className="mb-1 text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">{title}</h2>
      <p className="whitespace-pre-line">{text}</p>
    </section>
  );
}

function SignatureBox({
  title,
  lines,
  stamp = false,
  signed = null,
}: {
  title: string;
  lines: string[];
  stamp?: boolean;
  /** Fáze 108: podepsaná revize – vlastnoruční podpis z plátna a razítko TIČR místo prázdných polí. */
  signed?: { signatureUrl: string | null; stamp: { name: string; certificateNo: string; certificateScope: string | null; authorizationNo: string | null; company: string | null } } | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[8pt] font-semibold tracking-wide text-zinc-600 uppercase">{title}</p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {signed ? (
        <div className="mt-1 flex h-24 items-end justify-between gap-3 border-b border-zinc-500 pb-1" data-testid="protocol-signature">
          {signed.signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- podpis technika z úložiště souborů
            <img src={signed.signatureUrl} alt={`Podpis – ${signed.stamp.name}`} className="h-20 max-w-[60%] object-contain" />
          ) : (
            <span className="text-[8pt] text-zinc-500">Podpis</span>
          )}
          <InspectorStamp profile={signed.stamp} size={88} />
        </div>
      ) : (
        <div className="mt-1 flex h-20 items-end justify-between gap-3 border-b border-dashed border-zinc-500 pb-1 text-[8pt] text-zinc-500">
          <span>Podpis</span>
          {stamp ? <span className="flex size-16 items-center justify-center rounded-full border border-dashed border-zinc-400 text-center">Razítko</span> : null}
        </div>
      )}
    </div>
  );
}
