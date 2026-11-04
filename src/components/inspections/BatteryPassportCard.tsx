import { BatteryCharging } from "lucide-react";

import { batteryPassportRows, parseBatteryPassport, passportRequired, sohWarning } from "@/lib/battery-passport";

/** Digitální pas baterie dle Nařízení (EU) 2023/1542 (UPS, BESS > 2 kWh) – karta zařízení. */
export function BatteryPassportCard({ json }: { json: string | null }) {
  const passport = parseBatteryPassport(json);
  if (!passport) return null;
  const warning = sohWarning(passport);
  return (
    <section aria-labelledby="battery-passport" className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 sm:p-5" data-testid="battery-passport">
      <h2 id="battery-passport" className="flex items-center gap-2 text-lg font-semibold">
        <BatteryCharging className="size-5 text-emerald-400" aria-hidden /> Digitální pas baterie dle Nařízení (EU) 2023/1542
      </h2>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {batteryPassportRows(passport).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">{passportRequired(passport) ? "Baterie nad 2 kWh – digitální pas je povinný (čl. 77 Nařízení (EU) 2023/1542)." : "Baterie do 2 kWh – pas je dobrovolný."}</p>
      {warning ? <p className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-2 text-sm text-orange-200">{warning}</p> : null}
    </section>
  );
}
