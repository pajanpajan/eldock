import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, Building2, CircuitBoard, Download, Mail, Receipt } from "lucide-react";

import { KpiTile } from "@/components/common/KpiTile";
import { NewsletterComposer } from "@/components/superadmin/NewsletterComposer";
import { CreditControls, OrderActions, ResolveFeedback } from "@/components/superadmin/SuperadminControls";
import { ORDER_STATUS, creditPackage, formatCzk } from "@/lib/credits";
import { formatDate } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/panel-builder/project";
import { parseRailPhotos } from "@/lib/panel-builder/rails";
import { cn } from "@/lib/utils";
import { getSuperadminCompanies, getSuperadminFeedback, getSuperadminOrders, getSuperadminOverview } from "@/server/queries/superadmin";
import { prisma } from "@/lib/prisma";
import { audienceLabel } from "@/lib/newsletter";
import { parseFeedbackSnapshot } from "@/server/services/credits";
import { newsletterOverview } from "@/server/services/newsletter";
import { isSuperadmin } from "@/server/superadmin-session";

export const metadata: Metadata = { title: "Přehled" };

const TABS = [
  { id: "companies", label: "Registrované firmy a kredity" },
  { id: "orders", label: "Objednávky kreditů a fakturace" },
  { id: "feedback", label: "Hlášení chyb AI a fotky" },
  { id: "newsletter", label: "Newsletter" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const th = "px-2 py-1.5 text-left font-medium";
const td = "px-2 py-1.5 align-top";

// Fáze 50: obchodní a technický velín – KPI, firmy a kredity, objednávky, hlášení chyb AI.
export default async function SuperadminPage({ searchParams }: PageProps<"/superadmin">) {
  if (!(await isSuperadmin())) notFound();
  const tabParam = (await searchParams).tab;
  const tab: TabId = TABS.some((item) => item.id === tabParam) ? (tabParam as TabId) : "companies";
  const overview = await getSuperadminOverview();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">SuperAdmin velín</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="superadmin-kpi">
        <KpiTile label="Registrované firmy" value={overview.panelCompanies + overview.plantCompanies} hint={`Panel Builder ${overview.panelCompanies} · Závody ${overview.plantCompanies}`} icon={Building2} />
        <KpiTile label="Vygenerované rozváděče" value={overview.projects} hint="projekty registrovaných firem" icon={CircuitBoard} />
        <KpiTile label="Čekající objednávky" value={overview.pendingOrders} hint={`${formatCzk(overview.pendingCzk)} s DPH`} icon={Receipt} accent={overview.pendingOrders ? "text-amber-300" : undefined} />
        <KpiTile label="Otevřená hlášení AI" value={overview.openFeedback} hint="čekají na vyřešení" icon={Bug} accent={overview.openFeedback ? "text-red-300" : undefined} />
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Záložky velínu">
        {TABS.map((item) => (
          <Link key={item.id} href={`/superadmin?tab=${item.id}`} aria-current={tab === item.id ? "page" : undefined} className={cn("rounded-t-lg px-4 py-2 text-sm", tab === item.id ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === "companies" ? <CompaniesTab /> : tab === "orders" ? <OrdersTab /> : tab === "newsletter" ? <NewsletterTab /> : <FeedbackTab />}
    </div>
  );
}

async function CompaniesTab() {
  const companies = await getSuperadminCompanies();
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs" data-testid="superadmin-companies">
        <thead className="bg-card text-muted-foreground">
          <tr>
            <th className={th}>Firma</th>
            <th className={th}>IČO / DIČ</th>
            <th className={th}>Kontakt</th>
            <th className={th}>TIČR</th>
            <th className={th}>Registrace</th>
            <th className={th}>Projekty</th>
            <th className={th}>Kredity</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-t border-border" data-testid={`company-${company.ico}`}>
              <td className={td}>
                <p className="font-semibold">{company.companyName}</p>
                <p className="text-muted-foreground">
                  {company.city} · {company.productScope === "PANEL_BUILDER" ? "AI Panel Builder" : "Správa závodů"}
                </p>
              </td>
              <td className={cn(td, "font-mono")}>
                {company.ico}
                <br />
                {company.dic ?? "–"}
              </td>
              <td className={td}>
                {company.contactName}
                <br />
                <a href={`mailto:${company.email}`} className="text-primary hover:underline">
                  {company.email}
                </a>
                <br />
                {company.phone}
              </td>
              <td className={td}>{company.authorizationNumber ?? "–"}</td>
              <td className={td}>{formatDate(company.createdAt)}</td>
              <td className={td}>
                {company._count.panelProjects ? (
                  <details>
                    <summary className="cursor-pointer text-primary">{company._count.panelProjects} projektů</summary>
                    <ul className="mt-1 flex flex-col gap-1.5">
                      {company.panelProjects.map((project) => {
                        const photos = [project.photoUrl, ...Object.values(parseRailPhotos(project.railPhotosJson))].filter((url): url is string => Boolean(url));
                        return (
                          <li key={project.id} className="rounded border border-border p-1.5">
                            <span className="font-mono text-primary">{project.code}</span> {project.name} · {PROJECT_STATUS[project.status].label} · {project._count.items} přístrojů
                            {photos.length ? (
                              <span className="mt-1 flex flex-wrap gap-1">
                                {photos.map((url) => (
                                  <a key={url} href={url} target="_blank" rel="noreferrer" title="Otevřít originál">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- nahrané fotky se servírují přes /api/files */}
                                    <img src={url} alt={`Fotka ${project.code}`} className="h-14 w-20 rounded object-cover" loading="lazy" />
                                  </a>
                                ))}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : (
                  "0"
                )}
              </td>
              <td className={td}>
                <p className="mb-1 font-mono text-base font-bold" data-testid="company-credits">
                  {company.creditsRemaining}
                </p>
                <CreditControls companyId={company.id} companyName={company.companyName} credits={company.creditsRemaining} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function OrdersTab() {
  const rank = { PENDING: 0, PAID: 1, CANCELLED: 2 } as const;
  const orders = (await getSuperadminOrders()).sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.getTime() - a.createdAt.getTime());
  if (!orders.length) return <p className="text-sm text-muted-foreground">Zatím žádná objednávka kreditů.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs" data-testid="superadmin-orders">
        <thead className="bg-card text-muted-foreground">
          <tr>
            <th className={th}>VS</th>
            <th className={th}>Firma</th>
            <th className={th}>Balíček</th>
            <th className={th}>Částka</th>
            <th className={th}>Objednáno</th>
            <th className={th}>Stav</th>
            <th className={th}>Akce</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-border" data-testid={`order-${order.variableSymbol}`}>
              <td className={cn(td, "font-mono font-bold")}>{order.variableSymbol}</td>
              <td className={td}>
                {order.company.companyName}
                <br />
                <span className="font-mono text-muted-foreground">IČO {order.company.ico}</span>
              </td>
              <td className={td}>
                {creditPackage(order.packageCode)?.name ?? order.packageCode} · {order.creditsCount} kr.
              </td>
              <td className={cn(td, "font-mono tabular-nums")}>
                {formatCzk(order.priceCzkInclVat)}
                <br />
                <span className="text-muted-foreground">{formatCzk(order.priceCzkExclVat)} bez DPH</span>
              </td>
              <td className={td}>{formatDate(order.createdAt)}</td>
              <td className={td}>
                <span className={cn("rounded-full border px-2 py-0.5", ORDER_STATUS[order.status].badge)}>{ORDER_STATUS[order.status].label}</span>
                {order.paidAt ? <p className="mt-1 text-muted-foreground">{formatDate(order.paidAt)}</p> : null}
              </td>
              <td className={td}>{order.status === "PENDING" ? <OrderActions orderId={order.id} variableSymbol={order.variableSymbol} /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function FeedbackTab() {
  const reports = await getSuperadminFeedback();
  if (!reports.length) return <p className="text-sm text-muted-foreground">Žádné hlášení chyb AI.</p>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2" data-testid="superadmin-feedback">
      {reports.map((report) => {
        const snapshot = parseFeedbackSnapshot(report.detectedSnapshotJson);
        const photos = [report.photoUrl, ...Object.values(snapshot?.railPhotos ?? {})].filter((url): url is string => Boolean(url));
        return (
          <li key={report.id} className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm", report.status === "OPEN" ? "border-red-500/50" : "border-border opacity-75")} data-status={report.status}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("rounded-full border px-2 py-0.5 font-semibold", report.status === "OPEN" ? "border-red-500/60 text-red-200" : "border-emerald-500/60 text-emerald-200")}>{report.status === "OPEN" ? "Otevřené" : "Vyřešené"}</span>
              <span>{formatDate(report.createdAt)}</span>
              <span>{report.company?.companyName ?? "firma smazána"}</span>
              {report.project ? (
                <span>
                  · <span className="font-mono text-primary">{report.project.code}</span> {report.project.name}
                </span>
              ) : snapshot ? (
                <span>· {snapshot.code} (projekt smazán)</span>
              ) : null}
            </div>
            <p className="font-medium whitespace-pre-line" data-testid="feedback-message">
              {report.message}
            </p>
            {photos.length ? (
              <div className="flex flex-wrap gap-2">
                {photos.map((url) => (
                  <span key={url} className="flex flex-col items-start gap-0.5">
                    <a href={url} target="_blank" rel="noreferrer" title="Zvětšit (otevřít originál)">
                      {/* eslint-disable-next-line @next/next/no-img-element -- nahrané fotky se servírují přes /api/files */}
                      <img src={url} alt="Fotka rozváděče z hlášení" className="h-28 w-40 rounded border border-border object-cover hover:opacity-90" loading="lazy" />
                    </a>
                    <a href={url} download className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                      <Download className="size-3" aria-hidden /> Stáhnout originál
                    </a>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Bez fotky (návrh od nuly).</p>
            )}
            {snapshot?.items.length ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Snímek {snapshot.items.length} prvků v okamžiku hlášení</summary>
                <ul className="mt-1 grid max-h-48 grid-cols-2 gap-x-3 overflow-y-auto font-mono">
                  {snapshot.items.map((item, index) => (
                    <li key={index}>
                      L{item.rail}/{item.position} {item.designation} {item.typeCode ?? item.category ?? "?"} · {item.status}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {report.status === "OPEN" ? <ResolveFeedback reportId={report.id} /> : report.adminNote ? <p className="text-xs text-muted-foreground">Poznámka: {report.adminNote}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Fáze 56: newsletter – počty odběratelů, export CSV, nové vydání a historie rozeslání. */
async function NewsletterTab() {
  const overview = await newsletterOverview(prisma);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]" data-testid="superadmin-newsletter">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <KpiTile label="Potvrzení" value={overview.confirmed} hint="dostávají vydání" icon={Mail} />
          <KpiTile label="Čekají" value={overview.pending} hint="nepotvrdili e-mail" icon={Mail} />
          <KpiTile label="Odhlášení" value={overview.unsubscribed} hint="souhlas odvolán" icon={Mail} />
        </div>
        <ul className="flex flex-col gap-1 rounded-xl border border-border p-3 text-sm">
          {overview.byAudience.length ? (
            overview.byAudience.map((row) => (
              <li key={row.audience ?? "none"} className="flex justify-between">
                <span>{audienceLabel(row.audience)}</span>
                <span className="font-mono">{row.count}</span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">Zatím žádný potvrzený odběratel.</li>
          )}
        </ul>
        <a href="/superadmin/newsletter-export" className="flex w-fit items-center gap-1.5 text-sm text-primary hover:underline">
          <Download className="size-4" aria-hidden /> Export potvrzených (CSV)
        </a>
        <div className="rounded-xl border border-border p-3 text-sm">
          <h2 className="mb-2 font-semibold">Rozeslaná vydání</h2>
          {overview.issues.length ? (
            <ul className="flex flex-col gap-1">
              {overview.issues.map((issue) => (
                <li key={issue.id} className="flex justify-between gap-2">
                  <span className="truncate">{issue.subject}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {issue.sentAt ? formatDate(issue.sentAt) : "neodesláno"} · {issue.recipients}
                    {issue.failed ? ` (+${issue.failed} chyb)` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Zatím nic.</p>
          )}
        </div>
      </div>
      <NewsletterComposer confirmed={overview.confirmed} />
    </div>
  );
}
