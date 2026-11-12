import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { ManufacturerLoginForm, ManufacturerLogoutButton } from "@/components/panel-builder/manufacturing/ManufacturerPortalControls";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/panel-builder/turnkey-manufacturing";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { getManufacturer } from "@/server/manufacturer-session";
import { manufacturerOrders } from "@/server/services/manufacturing";

export const metadata: Metadata = {
  title: "Portál výrobců rozváděčů ELDOCK",
  description: "Zakázky výroby rozváděčů na klíč pro zasmluvněné výrobce ELDOCK – CNC a dílenské podklady, kusová zkouška a uzamčení dokumentace pod QR štítkem.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const czk = (value: number | null | undefined) => (value ? `${value.toLocaleString("cs-CZ")} Kč` : "–");

/**
 * Fáze 106: portál zasmluvněných výrobců rozváděčů – přijaté poptávky (vlastní i „všem v kraji“), přijetí do výroby,
 * výrobní balíček (CNC, drátovací list, kusovník, elaborát, štítky), výstupní kusová zkouška a dokončení s uzamčením
 * Verze 1.0 pod QR štítkem ELDOCK.
 */
export default async function ManufacturerPortalPage() {
  const manufacturer = await getManufacturer();
  const orders = manufacturer ? await manufacturerOrders(prisma, manufacturer.id) : [];
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/" aria-label="Eldock – úvodní stránka" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo />
          </Link>
          <span className="text-sm font-semibold">🏭 Portál výrobců rozváděčů ELDOCK</span>
          {manufacturer ? (
            <span className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted-foreground" data-testid="manufacturer-name">
                🏭 {manufacturer.name} · {manufacturer.region}
              </span>
              <ManufacturerLogoutButton>
                <LogOut className="size-4" aria-hidden /> Odhlásit
              </ManufacturerLogoutButton>
            </span>
          ) : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6" data-testid="manufacturer-portal">
        <div>
          <h1 className="text-2xl font-semibold">Zakázky výroby rozváděčů na klíč</h1>
          <p className="text-sm text-muted-foreground">Zákazníci AI Panel Builderu sem posílají hotové návrhy rozváděčů. Přijměte zakázku, stáhněte CNC a dílenské podklady, vyrobte a odzkoušejte rozváděč a dokončením uzamkněte dokumentaci jako Verzi 1.0 pod QR štítkem ELDOCK.</p>
        </div>
        {manufacturer ? (
          orders.length ? (
            <ul className="flex flex-col gap-2" data-testid="manufacturer-orders">
              {orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm" data-testid="manufacturer-order" data-status={order.status}>
                  <span className="min-w-0">
                    <b className="font-mono">{order.number}</b> · {order.project.code}
                    {order.project.name ? ` ${order.project.name}` : ""} · {order.company.companyName}
                    <span className="block text-xs text-muted-foreground">
                      {order.region}
                      {order.broadcast && !order.manufacturerId ? " · poptávka všem výrobcům v kraji (přijme první)" : ""} · štítek <span className="font-mono">{order.qrSerial}</span> · {czk(order.acceptedPriceCzk)}
                    </span>
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", order.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-200" : "bg-muted")}>{ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status}</span>
                  <Link href={`/vyroba-rozvadecu/zakazka/${order.id}`} className="rounded-lg border border-primary/60 bg-primary/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary/20" data-testid="manufacturer-order-open">
                    Otevřít zakázku
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="manufacturer-empty">
              Zatím žádná poptávka – nové vám pošleme i e-mailem.
            </p>
          )
        ) : (
          <ManufacturerLoginForm />
        )}
      </main>
    </div>
  );
}
