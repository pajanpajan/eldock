import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { panelBuilderGuard } from "@/components/panel-builder/access";
import { BankDetails } from "@/components/panel-builder/credits/BankDetails";
import { PaymentQr } from "@/components/panel-builder/credits/PaymentQr";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS, creditPackage, formatCzk, spdPayload } from "@/lib/credits";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCreditOrder } from "@/server/queries/panel-builder";
import { labelCountOf, labelOrderTitle } from "@/lib/operator";
import { getLabelSets, paymentAccount } from "@/server/operator";

export const metadata: Metadata = { title: "Platba kreditů" };

// Fáze 50: objednávka kreditů – QR platba (SPD 1.0), platební údaje a zálohová faktura k tisku.
export default async function CreditOrderPage({ params }: PageProps<"/panel-builder/credits/[orderId]">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const order = await getCreditOrder((await params).orderId);
  if (!order) notFound();
  // Fáze 112: účet z velínu; sada QR štítků bez kreditů
  const bank = await paymentAccount();
  const labels = labelCountOf(order.packageCode);
  const payload = spdPayload({ iban: bank.iban, bic: bank.bic, amountCzk: order.priceCzkInclVat, variableSymbol: order.variableSymbol, message: `ELDOCK ${labels ? "QR stitky" : "Kredity"} ${order.company.companyName}` });
  const pkg = creditPackage(order.packageCode);
  const status = ORDER_STATUS[order.status];
  return (
    <PageTransition>
      <PageHeader
        breadcrumb={
          <Link href="/panel-builder/credits" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Dobít kredity
          </Link>
        }
        title={`Objednávka VS ${order.variableSymbol}`}
        badges={<span className={cn("rounded-full border px-2 py-0.5 text-xs", status.badge)}>{status.label}</span>}
        description={`${labels ? (labelOrderTitle(order.packageCode, await getLabelSets()) ?? `Sada ${labels} ks QR štítků ELDOCK`) : `${pkg?.title ?? order.packageCode} · ${order.creditsCount} kreditů`} · objednáno ${formatDate(order.createdAt)}`}
      />
      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2">
          <PaymentQr payload={payload} size={220} />
          <p className="max-w-56 text-center text-xs text-muted-foreground">Naskenujte v mobilním bankovnictví – částka, účet i variabilní symbol se vyplní samy.</p>
        </div>
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-label="Platební údaje">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm" data-testid="payment-details">
            <dt className="text-muted-foreground">Částka k úhradě</dt>
            <dd className="text-xl font-black tabular-nums">{formatCzk(order.priceCzkInclVat)}</dd>
            <dt className="text-muted-foreground">{order.priceCzkInclVat > order.priceCzkExclVat ? "Z toho bez DPH / DPH 21 %" : "DPH"}</dt>
            <dd className="tabular-nums">
              {order.priceCzkInclVat > order.priceCzkExclVat ? `${formatCzk(order.priceCzkExclVat)} / ${formatCzk(order.priceCzkInclVat - order.priceCzkExclVat)}` : "dodavatel není plátcem DPH"}
            </dd>
            {/* Fáze 84: banka, číslo účtu, IBAN, SWIFT / BIC a VS */}
            <BankDetails bank={bank} variableSymbol={order.variableSymbol} labelClass="text-muted-foreground" />
            <dt className="text-muted-foreground">{labels ? "Po úhradě" : "Kredity po úhradě"}</dt>
            <dd>{labels ? `${labels} ks QR štítků poštou` : `+${order.creditsCount}`}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            {order.status === "PAID" ? `Uhrazeno ${order.paidAt ? formatDate(order.paidAt) : ""} – kredity jsou připsané.` : "Kredity připíšeme po připsání platby na náš účet (obvykle do 1 pracovního dne)."}
          </p>
          <Button asChild className="touch-target w-fit gap-2">
            <Link href={`/panel-builder/credits/${order.id}/invoice`} target="_blank" data-testid="invoice-link">
              <Printer className="size-4" aria-hidden /> [ 🖨️ Vytisknout / Stáhnout zálohovou fakturu (PDF) ]
            </Link>
          </Button>
        </section>
      </div>
    </PageTransition>
  );
}
