import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LogoMark } from "@/components/layout/Logo";
import { PrintButton } from "@/components/landing/PrintButton";
import { BankDetails } from "@/components/panel-builder/credits/BankDetails";
import { PaymentQr } from "@/components/panel-builder/credits/PaymentQr";
import { ProvisionalPayButton } from "@/components/panel-builder/credits/ProvisionalPayButton";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { labelCountOf, labelOrderTitle, operatorAddress, registryLines } from "@/lib/operator";
import { getLabelSets, getOperatorProfile, paymentAccount } from "@/server/operator";
import { VAT_RATE, creditPackage, formatCzk, orderProduct, spdPayload } from "@/lib/credits";
import { formatDate } from "@/lib/format";
import { getCreditOrder } from "@/server/queries/panel-builder";
import { IP_NOTICE } from "@/lib/legal";

export const metadata: Metadata = { title: "Zálohová faktura" };

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    html, body { background: #fff !important; }
    .no-print, [data-testid="panel-builder-header"] { display: none !important; }
    main { padding: 0 !important; max-width: none !important; }
    .invoice { box-shadow: none !important; max-width: none !important; padding: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`;

const DUE_DAYS = 14;
const cell = "border border-zinc-400 px-2 py-1.5 text-left";

// Fáze 50: zálohová faktura (výzva k platbě) za balíček kreditů – A4 k tisku / uložení do PDF.
export default async function InvoicePage({ params }: PageProps<"/panel-builder/credits/[orderId]/invoice">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const order = await getCreditOrder((await params).orderId);
  if (!order) notFound();
  // Fáze 112: dodavatel a účet z velínu (IČO, DIČ, spisová značka, IBAN)
  const [bank, operator] = await Promise.all([paymentAccount(), getOperatorProfile()]);
  const customer = order.company;
  const pkg = creditPackage(order.packageCode);
  const due = new Date(order.createdAt.getTime() + DUE_DAYS * 24 * 3600 * 1000);
  const vat = order.priceCzkInclVat - order.priceCzkExclVat;
  // Fáze 112: sada QR štítků (bez kreditů) a faktura neplátce DPH (cena bez DPH je konečná)
  const labels = labelCountOf(order.packageCode);
  const withVat = vat > 0;
  const itemTitle = labels ? `${labelOrderTitle(order.packageCode, await getLabelSets())} – ${labels} ks QR štítků ELDOCK (EL-xxxxxx, odeslání poštou)` : `ELDOCK AI Panel Builder – ${pkg?.title ?? order.packageCode} (${pkg?.name ?? order.packageCode}), ${order.creditsCount} kreditů`;
  const payload = spdPayload({ iban: bank.iban, bic: bank.bic, amountCzk: order.priceCzkInclVat, variableSymbol: order.variableSymbol, message: `ELDOCK ${labels ? "QR stitky" : "Kredity"} ${customer.companyName}` });

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <style>{PRINT_CSS}</style>
      <div className="no-print flex flex-wrap items-center justify-center gap-3">
        <PrintButton />
        {/* Fáze 114: po QR platbě kredity hned (předběžně do kontroly výpisu z banky) – na tisku není */}
        {order.status === "PENDING" && !order.provisionalAt && !labels && orderProduct(order.packageCode)?.kind === "PACKAGE" ? <ProvisionalPayButton orderId={order.id} credits={order.creditsCount} /> : null}
        {order.status === "PENDING" && order.provisionalAt ? (
          <span className="rounded-lg border border-amber-400/60 bg-amber-400/10 px-3 py-2 text-sm text-amber-100" data-testid="provisional-active">
            ⏳ Kredity jsou aktivní předběžně – čekáme na připsání platby
          </span>
        ) : null}
      </div>
      <article className="invoice w-full max-w-[210mm] bg-white p-[14mm] text-[10pt] leading-snug text-black shadow-2xl shadow-black/50" data-testid="invoice">
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <LogoMark className="size-9" />
            <span className="text-[18pt] font-black tracking-tight">ELDOCK</span>
          </div>
          <div className="text-right">
            <h1 className="text-[16pt] font-bold">Zálohová faktura – výzva k platbě</h1>
            <p className="text-[9pt] text-zinc-600">výzva k platbě – není daňovým dokladem</p>
            <p className="mt-1 font-mono text-[12pt] font-bold">č. {order.variableSymbol}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <h2 className="mb-1 text-[9pt] font-bold tracking-wide text-zinc-600 uppercase">Dodavatel</h2>
            <div data-testid="invoice-supplier">
              <p className="font-semibold">{operator.name}</p>
              <p>{operatorAddress(operator)}</p>
              {registryLines(operator).map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                {operator.brand} · {operator.email}
              </p>
            </div>
          </div>
          <div data-testid="invoice-customer">
            <h2 className="mb-1 text-[9pt] font-bold tracking-wide text-zinc-600 uppercase">Odběratel</h2>
            <p className="font-semibold">{customer.companyName}</p>
            <p>{customer.street}</p>
            <p>
              {customer.zip} {customer.city}
            </p>
            <p>IČO: {customer.ico}</p>
            {customer.dic ? <p>DIČ: {customer.dic}</p> : null}
            <p>
              {customer.contactName} · {customer.email}
            </p>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-[1fr_auto] gap-6">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-6 gap-y-1" data-testid="invoice-payment">
            <dt className="text-zinc-600">Datum vystavení</dt>
            <dd>{formatDate(order.createdAt)}</dd>
            <dt className="text-zinc-600">Datum splatnosti</dt>
            <dd>{formatDate(due)}</dd>
            <dt className="text-zinc-600">Forma úhrady</dt>
            <dd>bankovní převod / QR platba</dd>
            {/* Fáze 84: banka, číslo účtu, IBAN, SWIFT / BIC a VS – stejné údaje jako v QR platbě */}
            <BankDetails bank={bank} variableSymbol={order.variableSymbol} labelClass="text-zinc-600" />
          </dl>
          <PaymentQr payload={payload} size={130} />
        </section>

        <table className="mt-5 w-full border-collapse" data-testid="invoice-items">
          <thead className="bg-zinc-100">
            <tr>
              <th className={cell}>Položka</th>
              <th className={`${cell} text-right`}>Množství</th>
              <th className={`${cell} text-right`}>Cena bez DPH</th>
              <th className={`${cell} text-right`}>{withVat ? `DPH ${Math.round(VAT_RATE * 100)} %` : "DPH"}</th>
              <th className={`${cell} text-right`}>{withVat ? "Celkem s DPH" : "Celkem"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cell} data-testid="invoice-item">
                {itemTitle}
              </td>
              <td className={`${cell} text-right`}>1</td>
              <td className={`${cell} text-right tabular-nums`}>{formatCzk(order.priceCzkExclVat)}</td>
              <td className={`${cell} text-right tabular-nums`}>{withVat ? formatCzk(vat) : "neplátce"}</td>
              <td className={`${cell} text-right tabular-nums`}>{formatCzk(order.priceCzkInclVat)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 ml-auto w-72 border-2 border-black p-2 text-right">
          <p className="text-[9pt] text-zinc-600">Celkem k úhradě</p>
          <p className="text-[16pt] font-black tabular-nums" data-testid="invoice-total">
            {formatCzk(order.priceCzkInclVat)}
          </p>
        </div>

        <footer className="mt-8 border-t border-zinc-300 pt-2 text-[8pt] text-zinc-600">
          Zálohová faktura slouží jako výzva k platbě. {withVat ? "Daňový doklad k přijaté platbě vystavíme po připsání úhrady na účet" : "Dodavatel není plátcem DPH; doklad o přijaté platbě vystavíme po připsání úhrady na účet"}
          {labels ? "; sada QR štítků se po potvrzení platby vytiskne a odešle poštou." : "; kredity se připíší automaticky po potvrzení platby."}
          {/* Fáze 104: ochrana databáze a autorských práv */}
          <span className="mt-1 block text-[6.5pt] text-zinc-500" data-testid="doc-ip-notice">
            {IP_NOTICE}
          </span>
        </footer>
      </article>
    </div>
  );
}
