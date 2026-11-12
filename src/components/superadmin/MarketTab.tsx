import Link from "next/link";
import { Download } from "lucide-react";

import { leadRoleLabel, LEAD_TRIGGER_LABEL, type LeadTrigger } from "@/lib/leads";
import { SOURCE_LABEL, TELEMETRY_LABEL, type TelemetryType, type TrafficSource } from "@/lib/telemetry";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMarketOverview } from "@/server/queries/market";

const th = "px-2 py-1.5 text-left font-medium";
const td = "px-2 py-1.5 align-top";
const n = (value: number) => value.toLocaleString("cs-CZ");
const share = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)} %` : "–");

/** Sloupec s pruhem podílu (bez knihovny grafů – čitelné i v tisku). */
function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className={cn("block h-full rounded-full bg-primary", className)} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </span>
  );
}

const PERIODS = [7, 30, 90, 365] as const;

/**
 * Fáze 102: „📈 Návštěvnost, Leady & Tržní data“ – trychtýř návštěvníků, zachycené kontakty s daty z ARES (export CSV),
 * oblíbenost designových řad a značek přístrojů, objem materiálu a poměr souhlasů s cookies (audit Consent Mode v2).
 */
export async function MarketTab({ days }: { days: number }) {
  const data = await getMarketOverview(days);
  const steps = [
    { label: "Návštěvy webu", value: data.funnel.visits, hint: data.funnel.bySource.filter((row) => row.count).map((row) => `${row.label} ${n(row.count)}`).join(" · ") || "zatím žádné" },
    { label: "Spuštěný trenažér / demo", value: data.funnel.sandboxes, hint: data.funnel.bySandbox.map((row) => `${row.sandbox} ${n(row.count)}`).join(" · ") || "zatím žádný" },
    { label: "Zachycené kontakty", value: data.funnel.leads, hint: "e-mail v okně trenažéru" },
    { label: "Registrované firmy", value: data.funnel.registered, hint: "nové registrace (bez ukázkové firmy)" },
  ];
  const top = Math.max(1, ...steps.map((step) => step.value));
  const maxSeries = Math.max(1, ...data.series.map((row) => row.elements));
  const maxBrand = Math.max(1, ...data.brands.map((row) => row.devices));
  return (
    <div className="flex flex-col gap-6" data-testid="superadmin-market">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">📈 Návštěvnost, Leady & Tržní data</h2>
        <nav className="flex gap-1 text-xs" aria-label="Období">
          {PERIODS.map((period) => (
            <Link key={period} href={`/superadmin?tab=market&dni=${period}`} aria-current={period === data.days ? "page" : undefined} className={cn("rounded-md border px-2 py-1", period === data.days ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:text-foreground")}>
              {period === 365 ? "rok" : `${period} dní`}
            </Link>
          ))}
        </nav>
      </div>

      <section className="flex flex-col gap-2" aria-label="Trychtýř návštěvníků" data-testid="market-funnel">
        <h3 className="text-sm font-semibold">Trychtýř návštěvníků (posledních {data.days} dní)</h3>
        <ol className="grid gap-2 md:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.label} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
              <span className="text-xs text-muted-foreground">
                {index + 1}. {step.label}
                {index > 0 ? ` · ${share(step.value, steps[index - 1].value)} z předchozího` : ""}
              </span>
              <span className="text-2xl font-bold tabular-nums">{n(step.value)}</span>
              <Bar value={step.value} max={top} />
              <span className="text-[11px] text-muted-foreground">{step.hint}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Návštěva = vstup na web (první stránka z jiného webu nebo přímý vstup), počítá se i bez souhlasu s cookies – bez identifikátoru a bez IP adresy. Zdroje:{" "}
          {data.funnel.bySource.map((row) => `${SOURCE_LABEL[row.source as TrafficSource]} ${n(row.count)}`).join(" · ")}.
        </p>
      </section>

      <section className="flex flex-col gap-2" aria-label="Zachycené kontakty a firmy" data-testid="market-leads">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Zachycené kontakty a firmy ({n(data.leads.length)})</h3>
          <a href="/superadmin/leads-export" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:border-primary/60" data-testid="leads-export">
            <Download className="size-3.5" aria-hidden /> 📥 Exportovat kontakty do CSV
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-card text-muted-foreground">
              <tr>
                <th className={th}>E-mail</th>
                <th className={th}>IČO / firma (ARES)</th>
                <th className={th}>Obor CZ-NACE</th>
                <th className={th}>Role</th>
                <th className={th}>Co testoval</th>
                <th className={th}>Okruhy / rozváděče</th>
                <th className={th}>Zdroj</th>
                <th className={th}>Novinky</th>
                <th className={th}>Zachyceno</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((lead) => (
                <tr key={lead.email} className="border-t border-border" data-testid="market-lead">
                  <td className={cn(td, "font-medium")}>{lead.email}</td>
                  <td className={td}>
                    {lead.ico ? <span className="font-mono">{lead.ico}</span> : "–"}
                    {lead.companyName ? <span className="block text-muted-foreground">{lead.companyName}</span> : null}
                  </td>
                  <td className={td}>
                    {lead.segmentLabel}
                    {lead.nace.length ? <span className="block font-mono text-[10px] text-muted-foreground">{lead.nace.slice(0, 6).join(" ")}</span> : null}
                  </td>
                  <td className={td}>{leadRoleLabel(lead.role)}</td>
                  <td className={td}>
                    {lead.summary || "–"}
                    {lead.trigger ? <span className="block text-muted-foreground">{LEAD_TRIGGER_LABEL[lead.trigger as LeadTrigger] ?? lead.trigger}</span> : null}
                  </td>
                  <td className={cn(td, "tabular-nums")}>
                    {lead.circuits ?? "–"} / {lead.boards ?? "–"}
                  </td>
                  <td className={td}>{SOURCE_LABEL[lead.source as TrafficSource] ?? lead.source}</td>
                  <td className={td}>{lead.marketingConsent ? "✅ souhlas" : "ne"}</td>
                  <td className={cn(td, "whitespace-nowrap")}>
                    {formatDateTime(lead.createdAt)}
                    {lead.registered ? <span className="block text-emerald-300">registrován</span> : null}
                  </td>
                </tr>
              ))}
              {!data.leads.length ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-center text-muted-foreground">
                    Zatím žádný kontakt – okno se ukáže návštěvníkovi ukázkové firmy při exportu kusovníku, tisku elaborátu nebo uložení projektu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">E-mailem oslovujte jen kontakty se souhlasem s novinkami (sloupec „Novinky“, § 7 zákona č. 480/2004 Sb.) – odběr se potvrzuje odkazem v e-mailu (newsletter s dvojím potvrzením).</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Tržní data" data-testid="market-brands">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <h3 className="text-sm font-semibold">Oblíbenost designových řad vypínačů</h3>
          <ul className="flex flex-col gap-2 text-xs">
            {data.series.map((row) => (
              <li key={row.key} className="flex flex-col gap-1">
                <span className="flex justify-between gap-2">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {n(row.elements)} přístrojů · {n(row.floorplans)} půdorysů · zvoleno {n(row.selected)}×
                  </span>
                </span>
                <Bar value={row.elements} max={maxSeries} />
              </li>
            ))}
            {!data.series.length ? <li className="text-muted-foreground">Zatím žádný uložený půdorys.</li> : null}
          </ul>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <h3 className="text-sm font-semibold">Značky přístrojů v rozváděčích (jističe, chrániče, přepěťové ochrany …)</h3>
          <ul className="flex flex-col gap-2 text-xs">
            {data.brands.map((row) => (
              <li key={row.brand} className="flex flex-col gap-1">
                <span className="flex justify-between gap-2">
                  <span className="font-medium">{row.brand}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {n(row.devices)} přístrojů · {n(row.modules)} modulů
                  </span>
                </span>
                <Bar value={row.devices} max={maxBrand} className="bg-sky-500" />
              </li>
            ))}
            {!data.brands.length ? <li className="text-muted-foreground">Zatím žádný rozváděč s přístroji z katalogu.</li> : null}
          </ul>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Objem materiálu" data-testid="market-material">
        {[
          ["Uložené půdorysy", n(data.material.floorplans)],
          ["Metry kabelů v půdorysech", `${n(data.material.cableM)} m`],
          ["Krabice KOPOS", n(data.material.koposBoxes)],
          ["Instalační krabice celkem", n(data.material.boxes)],
          ["Rozváděče (projekty)", n(data.material.projects)],
          ["Moduly v rozváděčích", n(data.material.modules)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" aria-label="Souhlasy s cookies" data-testid="market-consent">
          <h3 className="text-sm font-semibold">Souhlasy s cookies (GDPR / ZEK audit)</h3>
          <p className="text-xs text-muted-foreground">Záznamy voleb za {data.days} dní: {n(data.consent.total)} (náhodné id volby, bez IP adresy a bez vazby na účet).</p>
          <ul className="flex flex-col gap-2 text-xs">
            {[
              ["Přijato vše", data.consent.acceptAll, "bg-emerald-500"],
              ["Pouze nezbytné", data.consent.necessaryOnly, "bg-zinc-400"],
              ["Vlastní výběr", data.consent.custom, "bg-amber-400"],
            ].map(([label, value, color]) => (
              <li key={String(label)} className="flex flex-col gap-1">
                <span className="flex justify-between gap-2">
                  <span>{label}</span>
                  <span className="tabular-nums">
                    {n(Number(value))} · {share(Number(value), data.consent.total)}
                  </span>
                </span>
                <Bar value={Number(value)} max={Math.max(1, data.consent.total)} className={String(color)} />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" aria-label="Události telemetrie">
          <h3 className="text-sm font-semibold">Události produktové telemetrie</h3>
          <ul className="grid grid-cols-2 gap-1 text-xs">
            {data.events.map((row) => (
              <li key={row.type} className="flex justify-between gap-2 rounded-md bg-background/50 px-2 py-1">
                <span>{TELEMETRY_LABEL[row.type as TelemetryType] ?? row.type}</span>
                <span className="font-mono tabular-nums">{n(row.count)}</span>
              </li>
            ))}
            {!data.events.length ? <li className="text-muted-foreground">Zatím žádné události.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
