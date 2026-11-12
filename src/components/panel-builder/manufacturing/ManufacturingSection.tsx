"use client";

import { useState } from "react";

import type { CncInput } from "@/lib/panel-builder/cnc-manufacturing-engine";
import { ORDER_STATUS_LABEL, type OrderStatus, type TurnkeyConfig, type TurnkeyEstimate } from "@/lib/panel-builder/turnkey-manufacturing";

import { CncManufacturingPanel } from "./CncManufacturingPanel";
import { TurnkeyOrderModal, type ManufacturerOption } from "./TurnkeyOrderModal";

export interface OrderSummary {
  id: string;
  number: string;
  status: string;
  qrSerial: string;
  version: string | null;
  manufacturer: string | null;
  region: string;
  acceptedPriceCzk: number | null;
  acceptedDays: number | null;
}

/** Stav zakázek výroby na klíč u rozváděče (poptávka, přijetí, zkouška, uzamčená Verze 1.0 pod štítkem). */
function OrderStatusList({ orders }: { orders: readonly OrderSummary[] }) {
  if (!orders.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs" data-testid="turnkey-orders">
      {orders.map((order) => (
        <li key={order.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-2 py-1" data-testid="turnkey-order" data-status={order.status}>
          <b className="font-mono">{order.number}</b>
          <span>{ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status}</span>
          <span className="text-muted-foreground">{order.manufacturer ?? `všem výrobcům v kraji ${order.region}`}</span>
          {order.acceptedPriceCzk ? <span>{order.acceptedPriceCzk.toLocaleString("cs-CZ")} Kč · {order.acceptedDays} prac. dnů</span> : null}
          <a href={`/q/${order.qrSerial}`} className="font-mono underline">
            {order.qrSerial}
          </a>
          {order.version ? <span className="text-emerald-300">Verze {order.version} uzamčena</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Fáze 106: tlačítko poptávky výroby na klíč (krok 1b) nebo celý panel CNC & výroba (krok 4) se sdíleným nastavením. */
export function ManufacturingSection({ variant, projectId, projectLabel, base, initial, estimate, manufacturers, contact, blockers, orders }: { variant: "button" | "full"; projectId: string; projectLabel: string; base: Omit<CncInput, "entry" | "mounting" | "door">; initial: TurnkeyConfig; estimate: TurnkeyEstimate; manufacturers: readonly ManufacturerOption[]; contact: { name: string; email: string; phone: string }; blockers: readonly string[]; orders: readonly OrderSummary[] }) {
  const [config, setConfig] = useState(initial);
  const modal = (label?: string) => <TurnkeyOrderModal projectId={projectId} projectLabel={projectLabel} estimate={estimate} config={config} manufacturers={manufacturers} contact={contact} blockers={blockers} label={label} />;
  if (variant === "button") {
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" aria-label="Výroba rozváděče na klíč" data-testid="turnkey-entry">
        <div className="flex flex-wrap items-center gap-3">
          {modal()}
          <span className="text-xs text-muted-foreground">Certifikovaný výrobce ELDOCK rozváděč podle návrhu vyrobí, osadí, prodrátuje, odzkouší a nalepí QR štítek s uzamčenou dokumentací.</span>
        </div>
        <OrderStatusList orders={orders} />
      </section>
    );
  }
  return (
    <div id="vyroba" className="flex flex-col gap-2">
      <CncManufacturingPanel base={base} initial={config} onConfig={setConfig}>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {modal("🏭 Objednat výrobu tohoto rozváděče na klíč")}
          <OrderStatusList orders={orders} />
        </div>
      </CncManufacturingPanel>
    </div>
  );
}
