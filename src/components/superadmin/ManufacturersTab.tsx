import Link from "next/link";

import { formatDate } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/panel-builder/turnkey-manufacturing";
import { prisma } from "@/lib/prisma";

import { ManufacturerForm, ManufacturerToggle } from "./ManufacturerControls";

const th = "px-2 py-1.5 text-left font-medium";
const td = "px-2 py-1.5 align-top";

/**
 * Fáze 106: velín „🏭 Výrobci rozváděčů“ – zasmluvnění výrobci (přístupový kód do /vyroba-rozvadecu, kraj, termín
 * výroby) a přehled zakázek výroby rozváděčů na klíč se stavem a QR štítkem.
 */
export async function ManufacturersTab() {
  const [manufacturers, orders] = await Promise.all([
    prisma.panelManufacturer.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, email: true, region: true, leadDays: true, active: true, createdAt: true, _count: { select: { orders: true } } } }),
    prisma.manufacturingOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { manufacturer: { select: { name: true } }, company: { select: { companyName: true } }, project: { select: { code: true } } } }),
  ]);
  return (
    <section className="flex flex-col gap-4" data-testid="manufacturers-tab">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">🏭 Zasmluvnění výrobci rozváděčů</h2>
        <Link href="/vyroba-rozvadecu" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted" data-testid="manufacturer-portal-link">
          Otevřít portál výrobců →
        </Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 font-semibold">Nový výrobce</h3>
        <ManufacturerForm />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" data-testid="manufacturers-table">
          <thead className="bg-muted/40">
            <tr>
              <th className={th}>Výrobce</th>
              <th className={th}>Kraj</th>
              <th className={th}>Termín</th>
              <th className={th}>Zakázek</th>
              <th className={th}>Od</th>
              <th className={th}>Stav</th>
            </tr>
          </thead>
          <tbody>
            {manufacturers.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className={td}>
                  <b>{row.name}</b>
                  <span className="block text-xs text-muted-foreground">{row.email}</span>
                </td>
                <td className={td}>{row.region}</td>
                <td className={td}>{row.leadDays} prac. dnů</td>
                <td className={td}>{row._count.orders}</td>
                <td className={td}>{formatDate(row.createdAt)}</td>
                <td className={td}>
                  <ManufacturerToggle id={row.id} active={row.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" data-testid="manufacturing-orders-table">
          <thead className="bg-muted/40">
            <tr>
              <th className={th}>Zakázka</th>
              <th className={th}>Firma / rozváděč</th>
              <th className={th}>Výrobce</th>
              <th className={th}>QR štítek</th>
              <th className={th}>Stav</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-border" data-testid="manufacturing-order-row">
                <td className={`${td} font-mono`}>{order.number}</td>
                <td className={td}>
                  {order.company.companyName} · {order.project.code}
                </td>
                <td className={td}>{order.manufacturer?.name ?? `všem v kraji ${order.region}`}</td>
                <td className={`${td} font-mono`}>{order.qrSerial}</td>
                <td className={td}>{ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
