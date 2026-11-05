import Link from "next/link";

import { LIFESPAN_STATUS } from "@/lib/component-lifespan";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PredictiveSummary } from "@/server/queries/health";

const n = (value: number) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

/**
 * Fáze 53: souhrnné odznaky prediktivní údržby – „⏳ Součástky před koncem životnosti (N)“ a
 * „🔌 Přetížené / nejištěné kabely (N)“; `detailed` = i seznam s odkazy na kartu zařízení.
 */
export function PredictiveWatch({
  summary,
  detailed = false,
}: {
  summary: PredictiveSummary;
  detailed?: boolean;
}) {
  const critical = summary.components.some(
    (item) => item.status === "CRITICAL_EXPIRED",
  );
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Prediktivní údržba"
      data-testid="predictive-watch"
    >
      <div className="flex flex-wrap gap-2">
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-semibold",
            summary.components.length
              ? critical
                ? "border-red-500/60 text-red-300"
                : "border-amber-400/60 text-amber-300"
              : "border-border text-muted-foreground",
          )}
          data-testid="badge-components"
        >
          ⏳ Součástky před koncem životnosti ({summary.components.length})
        </span>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-semibold",
            summary.cables.length
              ? "border-red-500/60 text-red-300"
              : "border-border text-muted-foreground",
          )}
          data-testid="badge-cables"
        >
          🔌 Přetížené / nejištěné kabely ({summary.cables.length})
        </span>
      </div>
      {detailed && (summary.components.length || summary.cables.length) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ul className="flex flex-col gap-1 text-sm">
            {summary.components.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${equipmentHref(item.equipmentId)}?tab=diagnostics`}
                  className="flex justify-between gap-2 rounded-md border border-border px-2 py-1 hover:border-primary/60"
                >
                  <span>
                    <span className="font-mono">{item.tag}</span>{" "}
                    {item.designation} {item.name}
                    {item.missingStock ? (
                      <span className="ml-1 text-red-300">
                        · chybí na skladě
                      </span>
                    ) : null}
                  </span>
                  <b className={LIFESPAN_STATUS[item.status].text}>
                    {LIFESPAN_STATUS[item.status].emoji} {n(item.wearPercent)} %
                  </b>
                </Link>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.cables.map((item) => (
              <li key={item.equipmentId}>
                <Link
                  href={`${equipmentHref(item.equipmentId)}?tab=diagnostics`}
                  className="flex justify-between gap-2 rounded-md border border-border px-2 py-1 hover:border-primary/60"
                >
                  <span>
                    Přívod <span className="font-mono">{item.tag}</span>
                    {item.protectedOk ? "" : " · nejištěný (In > Iz)"}
                  </span>
                  <b className="text-red-300">🔴 {n(item.loadPercent)} % Iz</b>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
