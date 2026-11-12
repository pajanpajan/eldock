import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";

import { AcceptOrderForm, CompleteOrderButton, FactoryTestForm } from "@/components/panel-builder/manufacturing/ManufacturerPortalControls";
import { ORDER_STATUS, ORDER_STATUS_LABEL, czk, factoryTestIssues, factoryTestSchema, materialText, type OrderStatus, type TurnkeyEstimate } from "@/lib/panel-builder/turnkey-manufacturing";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { getManufacturer } from "@/server/manufacturer-session";
import { orderForManufacturer } from "@/server/services/manufacturing";

export const metadata: Metadata = { title: "Zakázka výroby rozváděče – portál výrobců ELDOCK", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";


function Step({ index, title, done, active, children }: { index: number; title: string; done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-2 rounded-xl border p-4", done ? "border-emerald-500/50 bg-emerald-500/5" : active ? "border-primary bg-primary/5" : "border-border bg-card opacity-70")} data-testid={`order-step-${index}`} data-done={done}>
      <h2 className="font-semibold">
        {done ? "✅" : `${index}.`} {title}
      </h2>
      {children}
    </section>
  );
}

/** Fáze 106: detail zakázky výrobce – 3 kroky (přijetí a podklady, výroba a kusová zkouška, uzamčení a expedice). */
export default async function ManufacturerOrderPage({ params }: PageProps<"/vyroba-rozvadecu/zakazka/[orderId]">) {
  const manufacturer = await getManufacturer();
  if (!manufacturer) redirect("/vyroba-rozvadecu");
  const { orderId } = await params;
  const { order } = await orderForManufacturer(prisma, orderId, manufacturer.id).catch(() => notFound());
  const project = await prisma.panelBoardProject.findUnique({ where: { id: order.projectId }, select: { code: true, name: true, items: { select: { id: true } }, enclosureModel: true, company: { select: { companyName: true } } } });
  if (!project) notFound();
  const estimate = JSON.parse(order.estimateJson) as TurnkeyEstimate;
  const mine = order.manufacturerId === manufacturer.id;
  const status = order.status as OrderStatus;
  const test = order.routineTestJson ? factoryTestSchema.safeParse(JSON.parse(order.routineTestJson)) : null;
  const issues = test?.success ? factoryTestIssues(test.data) : [];
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6" data-testid="manufacturer-order-detail" data-status={status}>
      <Link href="/vyroba-rozvadecu" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Zakázky
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">
          Zakázka <span className="font-mono">{order.number}</span> – rozváděč {project.code}
          {project.name ? ` ${project.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {project.company?.companyName ?? "Zákazník"} · {order.region} · {project.items.length} přístrojů · skříň {project.enclosureModel ?? "dle návrhu"} · QR štítek <b className="font-mono">{order.qrSerial}</b> · {ORDER_STATUS_LABEL[status]}
        </p>
        <p className="text-sm">
          Orientační kalkulace zákazníka: materiál {materialText(estimate)} + montáž, drátování a zkouška {czk(estimate.laborCzk)} + doprava {czk(estimate.transportCzk)} = <b>{czk(estimate.totalCzk)}</b> bez DPH
          {order.acceptedPriceCzk ? (
            <>
              {" "}
              · vaše cena <b>{czk(order.acceptedPriceCzk)}</b>, termín {order.acceptedDays} prac. dnů
            </>
          ) : null}
        </p>
        {mine ? (
          <p className="text-sm">
            Kontakt: {order.contactName} · <a href={`mailto:${order.contactEmail}`}>{order.contactEmail}</a>
            {order.contactPhone ? (
              <>
                {" "}
                · <a href={`tel:${order.contactPhone}`}>{order.contactPhone}</a>
              </>
            ) : null}
            {order.deliveryAddress ? ` · dodání: ${order.deliveryAddress}` : ""}
            {order.note ? ` · poznámka: ${order.note}` : ""}
          </p>
        ) : null}
      </div>
      <Step index={1} title="Přijetí zakázky a stažení CNC & dílenských podkladů" done={status !== ORDER_STATUS.SENT} active={status === ORDER_STATUS.SENT}>
        {status === ORDER_STATUS.SENT ? <AcceptOrderForm orderId={order.id} suggestedPrice={estimate.totalCzk} suggestedDays={manufacturer.leadDays} /> : null}
        {mine ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <a href={`/api/vyroba/package/${order.id}`} className="flex items-center gap-1.5 rounded-lg border border-primary/60 bg-primary/10 px-3 py-1.5 font-semibold hover:bg-primary/20" data-testid="order-package">
              <Download className="size-4" aria-hidden /> 📦 Stáhnout kompletní výrobní balíček (ZIP)
            </a>
            <Link href={`/vyroba-rozvadecu/zakazka/${order.id}/elaborat`} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 hover:bg-muted" data-testid="order-elaborate">
              <Printer className="size-4" aria-hidden /> 6listový elaborát a schéma (tisk / PDF)
            </Link>
            <Link href={`/vyroba-rozvadecu/zakazka/${order.id}/stitky`} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 hover:bg-muted" data-testid="order-labels">
              <Printer className="size-4" aria-hidden /> Štítky přístrojů a QR štítek {order.qrSerial} (tisk / PDF)
            </Link>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Podklady a kontakt zákazníka uvidíte po přijetí zakázky.</p>
        )}
      </Step>
      <Step index={2} title="Výroba, drátování a výstupní kusová zkouška výrobce (ČSN EN IEC 61439-1 ed. 3)" done={status === ORDER_STATUS.COMPLETED || (status === ORDER_STATUS.TESTED && !issues.length)} active={mine && (status === ORDER_STATUS.ACCEPTED || status === ORDER_STATUS.TESTED)}>
        {mine && (status === ORDER_STATUS.ACCEPTED || status === ORDER_STATUS.TESTED) ? <FactoryTestForm orderId={order.id} initial={test?.success ? test.data : null} /> : null}
        {issues.length ? <p className="text-sm text-red-300">Nevyhovuje: {issues.join(" ")}</p> : null}
      </Step>
      <Step index={3} title="Uzamčení dokumentace v cloudu, QR štítek ELDOCK a expedice" done={status === ORDER_STATUS.COMPLETED} active={mine && status === ORDER_STATUS.TESTED && !issues.length}>
        {status === ORDER_STATUS.COMPLETED ? (
          <p className="text-sm" data-testid="order-completed">
            Dokumentace je uzamčená jako <b>Verze {order.version}</b> na{" "}
            <a href={`/q/${order.qrSerial}`} className="underline">
              https://eldock.cz/q/{order.qrSerial}
            </a>
            . Nalepte na dveře skříně stříbrný QR štítek {order.qrSerial} a předejte rozváděč zákazníkovi.
          </p>
        ) : mine && status === ORDER_STATUS.TESTED && !issues.length ? (
          <CompleteOrderButton orderId={order.id} serial={order.qrSerial} />
        ) : (
          <p className="text-xs text-muted-foreground">Po vyhovující kusové zkoušce.</p>
        )}
      </Step>
    </main>
  );
}
