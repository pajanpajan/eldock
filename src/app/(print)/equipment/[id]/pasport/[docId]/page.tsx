import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/common/PrintToolbar";
import { BRAND } from "@/lib/brand";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/format";
import {
  ENCLOSURE_INSTALLATIONS,
  ENCLOSURE_MATERIALS,
  INFLUENCE_CLASSES,
  PASSPORT_DOC_TITLES,
  ROUTINE_RESULT_LABELS,
  SPACE_CONCLUSIONS,
  influenceLabel,
  parsePassportPayload,
  routinePassed,
} from "@/lib/passport-docs";
import { prisma } from "@/lib/prisma";
import { assertTenantAccess } from "@/server/tenant";

export const metadata: Metadata = { title: "Dokument pasportu rozváděče" };

const czDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
const cz = (value: number, digits = 1) => value.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Fáze 116: tisková podoba (náhled / PDF) protokolu pasportu vygenerovaného v ELDOCKu z potvrzených parametrů –
 * EU prohlášení o shodě, kusová zkouška, výpočet oteplení a vnější vlivy. `?tisk=1` otevře dialog tisku (Uložit jako PDF),
 * `?nahled=1` je náhled bez lišty v dialogu karty.
 */
export default async function PassportDocumentPage({ params, searchParams }: PageProps<"/equipment/[id]/pasport/[docId]">) {
  const [{ id, docId }, query] = await Promise.all([params, searchParams]);
  try {
    await assertTenantAccess({ equipmentId: id });
  } catch {
    notFound();
  }
  const document = await prisma.complianceDocument.findFirst({
    where: { id: docId, equipmentId: id },
    include: { equipment: { select: { tag: true, name: true, type: true, manufacturer: true, model: true, serialNumber: true, ratedVoltage: true, ratedCurrent: true, ipRating: true, floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true, customerName: true } } } } } } } } },
  });
  const payload = parsePassportPayload(document?.generatedJson);
  if (!document || !payload || payload.kind === "SINGLE_LINE_DIAGRAM") notFound();
  const { equipment } = document;
  const preview = query.nahled === "1";
  const location = `${equipment.floor.building.plant.name} › ${equipment.floor.building.name} › ${equipment.floor.name}`;

  return (
    <div className="protocol-print flex flex-1 flex-col items-center gap-4 p-4 sm:p-6">
      <style>{`
        @page { size: A4 portrait; margin: 14mm 14mm; }
        @media print {
          html, body { background: #fff !important; height: auto !important; min-height: 0 !important; display: block !important; }
          main { display: block !important; }
          .protocol-print { display: block !important; padding: 0 !important; }
          .protocol-print .no-print { display: none !important; }
          .protocol-print .sheet { width: auto !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; border: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      {preview ? null : <PrintToolbar className="max-w-[210mm]" autoPrint={query.tisk === "1"} hint={`${document.title} · ${document.documentNumber} · A4. Pro PDF zvolte v dialogu tisku „Uložit jako PDF“.`} />}
      <article className="sheet flex w-full max-w-[210mm] flex-col gap-4 bg-white p-[14mm] text-[10pt] leading-snug text-black shadow-2xl shadow-black/50" data-testid="passport-print" data-category={payload.kind}>
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-2">
          <div>
            <p className="text-[8pt] font-semibold tracking-[0.12em] text-zinc-600 uppercase">Pasport rozváděče · ČSN EN IEC 61439</p>
            <h1 className="text-[15pt] font-bold">{PASSPORT_DOC_TITLES[payload.kind]}</h1>
            <p>
              {equipment.tag} – {equipment.name} · {EQUIPMENT_TYPE_LABELS[equipment.type]}
            </p>
            <p className="text-zinc-600">{location}</p>
          </div>
          <p className="text-right text-[8pt] text-zinc-600">
            Číslo dokumentu
            <br />
            <b className="font-mono text-[10pt] text-black">{document.documentNumber}</b>
            <br />
            {BRAND.name} ({BRAND.domain})
          </p>
        </header>

        {payload.kind === "CONFORMITY_DECLARATION" ? (
          <section className="flex flex-col gap-3">
            <p className="text-[12pt] font-bold">EU PROHLÁŠENÍ O SHODĚ</p>
            <dl className="grid grid-cols-[48mm_1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-600">Výrobce</dt>
              <dd className="font-semibold">{payload.manufacturer}</dd>
              <dt className="text-zinc-600">Adresa</dt>
              <dd>{payload.manufacturerAddress || "–"}</dd>
              <dt className="text-zinc-600">Výrobek</dt>
              <dd>{payload.product}</dd>
              <dt className="text-zinc-600">Typové označení</dt>
              <dd>{payload.typeDesignation || "–"}</dd>
              <dt className="text-zinc-600">Výrobní číslo</dt>
              <dd>{payload.serialNumber || "–"}</dd>
              <dt className="text-zinc-600">Jmenovité údaje</dt>
              <dd>{[equipment.ratedVoltage, equipment.ratedCurrent, equipment.ipRating].filter(Boolean).join(" · ") || "–"}</dd>
            </dl>
            <p>Toto prohlášení o shodě se vydává na výhradní odpovědnost výrobce. Výše popsaný předmět prohlášení je ve shodě s příslušnými harmonizačními právními předpisy Unie:</p>
            <ul className="list-disc pl-6">
              {payload.directives.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>Použité harmonizované normy:</p>
            <ul className="list-disc pl-6">
              {payload.standards.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <p>
                {payload.place || "–"}, {czDate(payload.date)}
              </p>
              <p className="border-t border-black pt-1 text-center">
                {payload.signatory}
                <br />
                <span className="text-zinc-600">{payload.signatoryRole}</span>
              </p>
            </div>
          </section>
        ) : null}

        {payload.kind === "ROUTINE_VERIFICATION" ? (
          <section className="flex flex-col gap-3">
            <p>Kusové ověření rozváděče podle ČSN EN IEC 61439-1, čl. 11 (každý vyrobený rozváděč).</p>
            <table className="w-full border-collapse text-[9pt]">
              <thead>
                <tr>
                  <th className="border border-zinc-400 px-2 py-1 text-left">Článek</th>
                  <th className="border border-zinc-400 px-2 py-1 text-left">Ověřovaná vlastnost</th>
                  <th className="border border-zinc-400 px-2 py-1 text-left">Výsledek</th>
                </tr>
              </thead>
              <tbody>
                {payload.items.map((item) => (
                  <tr key={item.clause}>
                    <td className="border border-zinc-400 px-2 py-1 font-mono">{item.clause}</td>
                    <td className="border border-zinc-400 px-2 py-1">{item.label}</td>
                    <td className="border border-zinc-400 px-2 py-1 font-semibold">{ROUTINE_RESULT_LABELS[item.result]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Zkušební napětí: {payload.testVoltageV ? `${cz(payload.testVoltageV, 0)} V` : "–"} · Izolační odpor: {payload.insulationMOhm !== null ? `${cz(payload.insulationMOhm, 1)} MΩ` : "–"} · Přístroj: {payload.instrument || "–"}
            </p>
            <p className="text-[11pt] font-bold">Závěr: {routinePassed(payload) ? "ROZVÁDĚČ KUSOVÉMU OVĚŘENÍ VYHOVĚL" : "ROZVÁDĚČ KUSOVÉMU OVĚŘENÍ NEVYHOVĚL"}</p>
            <p>
              Provedl: {payload.performedBy} · {czDate(payload.date)}
            </p>
          </section>
        ) : null}

        {payload.kind === "THERMAL_CALCULATION" ? (
          <section className="flex flex-col gap-3">
            <p>Ověření oteplení výpočtem podle ČSN EN IEC 61439-1, čl. 10.10.4 a IEC TR 60890 (skříň bez větracích otvorů).</p>
            <dl className="grid grid-cols-[52mm_1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-600">Skříň (V × Š × H)</dt>
              <dd>
                {payload.enclosure.heightMm} × {payload.enclosure.widthMm} × {payload.enclosure.depthMm} mm · {ENCLOSURE_INSTALLATIONS.find((item) => item.id === payload.enclosure.installation)?.label} · {ENCLOSURE_MATERIALS.find((item) => item.id === payload.enclosure.material)?.label}
              </dd>
              <dt className="text-zinc-600">Teplota okolí</dt>
              <dd>{cz(payload.ambientTempC)} °C</dd>
              <dt className="text-zinc-600">Dovolené oteplení pod stropem</dt>
              <dd>ΔT ≤ {cz(payload.maxRiseK)} K</dd>
            </dl>
            <table className="w-full border-collapse text-[8.5pt]">
              <thead>
                <tr>
                  <th className="border border-zinc-400 px-2 py-1 text-left">Pozice</th>
                  <th className="border border-zinc-400 px-2 py-1 text-left">Přístroj</th>
                  <th className="border border-zinc-400 px-2 py-1 text-right">Ks</th>
                  <th className="border border-zinc-400 px-2 py-1 text-right">Pv [W/ks]</th>
                  <th className="border border-zinc-400 px-2 py-1 text-left">Zdroj údaje</th>
                </tr>
              </thead>
              <tbody>
                {payload.losses.map((line, index) => (
                  <tr key={`${line.designation}-${index}`}>
                    <td className="border border-zinc-400 px-2 py-1 font-mono">{line.designation}</td>
                    <td className="border border-zinc-400 px-2 py-1">{line.description}</td>
                    <td className="border border-zinc-400 px-2 py-1 text-right">{line.quantity}</td>
                    <td className="border border-zinc-400 px-2 py-1 text-right font-mono">{cz(line.lossW ?? 0, 2)}</td>
                    <td className="border border-zinc-400 px-2 py-1">{line.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Ztráty přístrojů {cz(payload.result.deviceLossW, 2)} W + vnitřní propojení {cz(payload.wiringLossW, 2)} W = <b>{cz(payload.result.totalLossW, 2)} W</b> · účinná chladicí plocha A<sub>e</sub> = {cz(payload.result.effectiveAreaM2, 3)} m² · Δt<sub>0,5</sub> = {cz(payload.result.deltaT05)} K · Δt<sub>1,0</sub> = {cz(payload.result.deltaT10)} K
            </p>
            <p className="text-[11pt] font-bold">{payload.result.verdict}</p>
            <p>
              Vypočetl: {payload.author} · {czDate(payload.date)}
            </p>
          </section>
        ) : null}

        {payload.kind === "EXTERNAL_INFLUENCES" ? (
          <section className="flex flex-col gap-3">
            <p>
              Protokol o určení vnějších vlivů podle {payload.basis}. Prostor: <b>{payload.space}</b>.
            </p>
            <table className="w-full border-collapse text-[9pt]">
              <tbody>
                {payload.codes.map((code) => (
                  <tr key={code}>
                    <td className="border border-zinc-400 px-2 py-1 font-mono font-semibold">{code}</td>
                    <td className="border border-zinc-400 px-2 py-1">{influenceLabel(code).replace(`${code} – `, "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11pt] font-bold">Závěr komise: {SPACE_CONCLUSIONS[payload.conclusion]} z hlediska nebezpečí úrazu elektrickým proudem.</p>
            <p>
              Komise: předseda {payload.chair}
              {payload.members.length ? ` · členové ${payload.members.join(", ")}` : ""} · {czDate(payload.date)}
            </p>
            <p className="text-[8pt] text-zinc-600">Třídy vlivů: {INFLUENCE_CLASSES.map((entry) => entry.id).join(", ")} (ČSN 33 2000-5-51 ed. 3).</p>
          </section>
        ) : null}

        <footer className="mt-auto border-t border-zinc-400 pt-2 text-[8pt] text-zinc-600">
          Vystavil: {document.issuer} · {document.issuedAt.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" })} · Vygenerováno v {BRAND.name} z parametrů potvrzených uživatelem.
        </footer>
      </article>
    </div>
  );
}
