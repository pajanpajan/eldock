import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, Building2, CircuitBoard, DatabaseBackup, Download, FolderLock, HardDrive, Mail, Receipt } from "lucide-react";

import { KpiTile } from "@/components/common/KpiTile";
import { MarketTab } from "@/components/superadmin/MarketTab";
import { NewsletterComposer } from "@/components/superadmin/NewsletterComposer";
import { BackupNowButton, ClosureControls, CreditControls, OrderActions, ResolveFeedback } from "@/components/superadmin/SuperadminControls";
import { DATA_REQUESTER_LABELS, DATA_REQUEST_KIND_LABELS, DATA_REQUEST_STATUS_LABELS } from "@/lib/data-requests";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { getSuperadminDataRequests } from "@/server/queries/data-requests";
import { ORDER_STATUS, creditPackage, formatCzk, formatIban } from "@/lib/credits";
import { formatDate, formatDateTime } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/panel-builder/project";
import { parseRailPhotos } from "@/lib/panel-builder/rails";
import { cn } from "@/lib/utils";
import { getBackupOverview } from "@/server/queries/backups";
import { getSuperadminCompanies, getSuperadminFeedback, getSuperadminOrders, getSuperadminOverview } from "@/server/queries/superadmin";
import { prisma } from "@/lib/prisma";
import { audienceLabel } from "@/lib/newsletter";
import { bankAccount, parseFeedbackSnapshot } from "@/server/services/credits";
import { newsletterOverview } from "@/server/services/newsletter";
import { isSuperadmin } from "@/server/superadmin-session";

export const metadata: Metadata = { title: "Přehled" };

const TABS = [
  { id: "companies", label: "Registrované firmy a kredity" },
  // Fáze 102: trychtýř, kontakty z trenažéru s daty z ARES, tržní data a souhlasy s cookies
  { id: "market", label: "📈 Návštěvnost, Leady & Tržní data" },
  { id: "orders", label: "Objednávky kreditů a fakturace" },
  { id: "feedback", label: "Hlášení chyb AI a fotky" },
  { id: "newsletter", label: "Newsletter" },
  { id: "backups", label: "Zálohy a data" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const th = "px-2 py-1.5 text-left font-medium";
const td = "px-2 py-1.5 align-top";

// Fáze 50: obchodní a technický velín – KPI, firmy a kredity, objednávky, hlášení chyb AI.
export default async function SuperadminPage({ searchParams }: PageProps<"/superadmin">) {
  if (!(await isSuperadmin())) notFound();
  const tabParam = (await searchParams).tab;
  const tab: TabId = TABS.some((item) => item.id === tabParam) ? (tabParam as TabId) : "companies";
  const daysParam = Number((await searchParams).dni);
  const days = [7, 30, 90, 365].includes(daysParam) ? daysParam : 30;
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
      {tab === "companies" ? <CompaniesTab /> : tab === "market" ? <MarketTab days={days} /> : tab === "orders" ? <OrdersTab /> : tab === "newsletter" ? <NewsletterTab /> : tab === "backups" ? <BackupsTab /> : <FeedbackTab />}
    </div>
  );
}

async function CompaniesTab() {
  const [companies, requests] = await Promise.all([getSuperadminCompanies(), getSuperadminDataRequests()]);
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
            <th className={th}>Účet a data</th>
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
              <td className={td} data-testid="company-account">
                {company.closedAt ? (
                  <p className="text-muted-foreground">zrušena {formatDate(company.closedAt)} – jen fakturační údaje k dokladům</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {requests.pendingByCompany.has(company.id) ? <p className="font-semibold text-red-300">výmaz {formatDate(requests.pendingByCompany.get(company.id) ?? new Date())}</p> : <p className="text-emerald-300">aktivní</p>}
                    <a href={`/api/data-export?companyId=${company.id}`} className="text-primary hover:underline">
                      Export dat (ZIP)
                    </a>
                    {company.id !== TESTER_COMPANY.id ? <ClosureControls companyId={company.id} companyName={company.companyName} ico={company.ico} pending={requests.pendingByCompany.has(company.id)} /> : null}
                  </div>
                )}
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
  // Fáze 84: účet, na který chodí úhrady kreditů (párování podle variabilního symbolu)
  const bank = bankAccount();
  const account = (
    <p className="text-xs text-muted-foreground" data-testid="superadmin-bank">
      Úhrady kreditů na účet <b className="font-mono text-foreground">{bank.accountNumber ?? formatIban(bank.iban)}</b>
      {bank.bankName ? ` · ${bank.bankName}` : ""} · IBAN <span className="font-mono">{formatIban(bank.iban)}</span>
      {bank.bic ? ` · SWIFT / BIC ${bank.bic}` : ""} – platbu spárujte podle variabilního symbolu a potvrďte tlačítkem u objednávky.
    </p>
  );
  if (!orders.length)
    return (
      <div className="flex flex-col gap-2">
        {account}
        <p className="text-sm text-muted-foreground">Zatím žádná objednávka kreditů.</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      {account}
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

const RUN_STATUS: Record<string, { label: string; className: string }> = {
  RUNNING: { label: "běží", className: "text-sky-300" },
  OK: { label: "v pořádku", className: "text-emerald-300" },
  WARNING: { label: "s upozorněním", className: "text-amber-300" },
  FAILED: { label: "selhala", className: "text-red-300" },
};
const TRIGGER_LABEL: Record<string, string> = { SCHEDULE: "plánovač", MANUAL: "velín", CLI: "příkaz" };
const RUN_KIND_LABEL: Record<string, string> = { BACKUP: "Záloha", RETENTION: "Retence", ERASURE: "Výmaz účtů" };
const OWNER_LABEL: Record<string, string> = { COMPANY: "Firmy", DEMO: "Obchodní demo", SHARED: "Sdílené (starší / katalog)" };
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;

// Fáze 68: zálohy (místní a mimo server), retence a registr souborů podle vlastníků.
async function BackupsTab() {
  const [overview, requests] = await Promise.all([getBackupOverview(), getSuperadminDataRequests()]);
  const { config, lastOk } = overview;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]" data-testid="superadmin-backups">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiTile label="Poslední záloha" value={lastOk ? formatDateTime(lastOk.startedAt) : "nikdy"} hint={lastOk?.summary ? `${mb(lastOk.summary.snapshot.archiveBytes)}${lastOk.summary.snapshot.encrypted ? " · šifrováno" : " · bez šifrování"}` : "zatím žádná úspěšná"} icon={DatabaseBackup} accent={overview.stale ? "text-red-300" : undefined} />
          <KpiTile label="Mimo server" value={config.offsite ? `${overview.offsite.db.objects} snímků` : "nenastaveno"} hint={config.offsite ? `${overview.offsite.file.objects} souborů · ${mb(overview.offsite.db.bytes + overview.offsite.file.bytes)}` : "jen místní snímky na serveru"} icon={HardDrive} accent={config.offsite ? undefined : "text-amber-300"} />
          <KpiTile label="Soubory v registru" value={overview.registry.total} hint={`${mb(overview.registry.bytes)} · ${overview.registry.companies} firem`} icon={FolderLock} />
        </div>
        {overview.stale ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
            Poslední úspěšná záloha je starší než 36 hodin (nebo žádná není). Zkontrolujte běhy níže, případně spusťte zálohu ručně.
          </p>
        ) : null}
        {config.issues.map((issue) => (
          <p key={issue} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            {issue}
          </p>
        ))}
        <BackupNowButton running={overview.running} />
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm" data-testid="backup-runs">
            <caption className="px-3 py-2 text-left font-semibold">Poslední běhy údržby</caption>
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className={th}>Začátek</th>
                <th className={th}>Druh</th>
                <th className={th}>Stav</th>
                <th className={th}>Výsledek</th>
              </tr>
            </thead>
            <tbody>
              {overview.runs.length ? (
                overview.runs.map((run) => {
                  const status = RUN_STATUS[run.status] ?? RUN_STATUS.OK;
                  const s = run.summary;
                  const detail = run.error
                    ? run.error
                    : s
                      ? [`${s.snapshot.name} (${mb(s.snapshot.archiveBytes)})`, s.offsite ? `mimo server: soubory +${s.offsite.filesUploaded}, čeká ${s.offsite.filesPending}, smazáno ${s.offsite.filesDeleted}${s.offsite.errors.length ? `, chyby ${s.offsite.errors.length}` : ""}` : s.offsiteSkipped ?? ""].filter(Boolean).join(" · ")
                      : run.retention
                        ? `smazáno: deník ${run.retention.securityEvents}, relace ${run.retention.sessions}, odkazy ${run.retention.authTokens}`
                        : "";
                  return (
                    <tr key={run.id} className="border-t border-border">
                      <td className={cn(td, "whitespace-nowrap font-mono text-xs")}>{formatDateTime(run.startedAt)}</td>
                      <td className={td}>
                        {RUN_KIND_LABEL[run.kind] ?? run.kind} <span className="text-xs text-muted-foreground">({TRIGGER_LABEL[run.trigger] ?? run.trigger})</span>
                      </td>
                      <td className={cn(td, status.className)}>{status.label}</td>
                      <td className={cn(td, "text-xs text-muted-foreground")}>{detail}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className={td} colSpan={4}>
                    Zatím žádný běh – první záloha proběhne v {config.time} (Europe/Prague){config.scheduleEnabled ? "" : " po zapnutí plánovače v produkci"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border p-3 text-sm" data-testid="backup-config">
          <h2 className="mb-2 font-semibold">Nastavení</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Denní záloha</dt>
            <dd>{config.scheduleEnabled ? `v ${config.time} (Europe/Prague)` : "plánovač vypnutý (jen ručně / příkazem)"}</dd>
            <dt className="text-muted-foreground">Místní snímky</dt>
            <dd className="break-all">
              {config.dir} · posledních {config.keepLocal}
            </dd>
            <dt className="text-muted-foreground">Šifrování</dt>
            <dd>{config.encrypted ? `AES-256-GCM, otisk klíče ${config.keyFingerprint}` : "vypnuté (chybí ELDOCK_BACKUP_KEY)"}</dd>
            <dt className="text-muted-foreground">Mimo server</dt>
            <dd className="break-all">{config.offsite ? `${config.offsite.endpoint}/${config.offsite.bucket}/${config.offsite.prefix}` : "nenastaveno (ELDOCK_BACKUP_S3_*)"}</dd>
            <dt className="text-muted-foreground">Retence</dt>
            <dd>
              snímky {config.keepDaily} dní + {config.keepMonthly} měsíců, smazané soubory {config.deletedRetentionDays} dní; bezpečnostní deník 1 rok, relace a odkazy na heslo 30 dní
            </dd>
          </dl>
        </div>
        <div className="rounded-xl border border-border p-3 text-sm">
          <h2 className="mb-2 font-semibold">Místní snímky databáze</h2>
          {overview.local.length ? (
            <ul className="flex flex-col gap-1" data-testid="local-snapshots">
              {overview.local.map((item) => (
                <li key={item.name} className="flex justify-between gap-2 font-mono text-xs">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 text-muted-foreground">{mb(item.bytes)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Zatím žádný snímek.</p>
          )}
        </div>
        <div className="rounded-xl border border-border p-3 text-sm" data-testid="file-registry">
          <h2 className="mb-2 font-semibold">Soubory podle vlastníka</h2>
          <ul className="flex flex-col gap-1">
            {overview.registry.byOwner.map((row) => (
              <li key={row.ownerKind} className="flex justify-between gap-2">
                <span>{OWNER_LABEL[row.ownerKind] ?? row.ownerKind}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {row.files} · {mb(row.bytes)}
                </span>
              </li>
            ))}
            {!overview.registry.byOwner.length ? <li className="text-muted-foreground">Registr je prázdný.</li> : null}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Soubor firmy čtou jen její přihlášení, demo soubory jen obchodní demo; sdílené soubory (starší data s více vlastníky, katalog) každé přihlášení. Smazané: {overview.registry.deleted}.</p>
        </div>
        <div className="rounded-xl border border-border p-3 text-sm" data-testid="data-requests-log">
          <h2 className="mb-2 font-semibold">Žádosti o data (GDPR)</h2>
          {requests.recent.length ? (
            <ul className="flex flex-col gap-1.5">
              {requests.recent.map((request) => (
                <li key={request.id} className="flex flex-col">
                  <span>
                    {DATA_REQUEST_KIND_LABELS[request.kind]} · {request.companyName ?? "–"} {request.companyIco ? `(${request.companyIco})` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(request.requestedAt)} · {DATA_REQUESTER_LABELS[request.requestedBy] ?? request.requestedBy} · {DATA_REQUEST_STATUS_LABELS[request.status].label}
                    {request.status === "PENDING" && request.scheduledAt ? ` – výmaz ${formatDate(request.scheduledAt)}` : ""}
                    {request.error ? ` – ${request.error}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Zatím žádná žádost.</p>
          )}
        </div>
      </div>
    </div>
  );
}
