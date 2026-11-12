import Link from "next/link";

import { CONTACT_FILTERS, MODULE_LABEL, STATUS_LABEL, categoriesOf, contactCategory, detailRows, optionLabel, projectHref, sameSitePath, ticketLabel } from "@/lib/contact";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { contactCounts, listContactMessages } from "@/server/services/contact";

import { ContactAttachments, ContactMessageControls, MarkAllContactRead } from "./ContactMessageControls";

// Fáze 107: velín „📬 Zprávy, Chyby & Schůzky“ – zprávy z kontaktního formuláře a plovoucího tlačítka: filtry podle typu,
// kontakty s mailto / tel, adresa a fáze projektu s odkazem, velké náhledy printscreenů (lightbox), stav a poznámka.

export async function ContactMessagesTab({ filter }: { filter: string }) {
  const active = CONTACT_FILTERS.some((item) => item.id === filter) ? filter : "all";
  const [messages, counts] = await Promise.all([listContactMessages(prisma, { filter: active }), contactCounts(prisma)]);
  const countOf = (id: string) =>
    categoriesOf(id).reduce(
      (sum, category) => ({ total: sum.total + (counts.byCategory[category]?.total ?? 0), unread: sum.unread + (counts.byCategory[category]?.unread ?? 0) }),
      { total: 0, unread: 0 },
    );

  return (
    <section className="flex flex-col gap-4" data-testid="contact-messages-tab">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-1.5" aria-label="Filtr zpráv">
          {CONTACT_FILTERS.map((item) => {
            const count = countOf(item.id);
            return (
              <Link
                key={item.id}
                href={`/superadmin?tab=zpravy&filtr=${item.id}`}
                aria-current={active === item.id ? "page" : undefined}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", active === item.id ? "border-primary bg-primary/15 font-semibold" : "border-border text-muted-foreground hover:text-foreground")}
                data-testid={`contact-filter-${item.id}`}
              >
                {item.label}
                <span className="font-mono text-xs">{count.total}</span>
                {count.unread ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{count.unread}</span> : null}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto">
          <MarkAllContactRead unread={counts.unread} />
        </span>
      </div>

      {messages.length ? null : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Zatím tu nejsou žádné zprávy.</p>}

      {messages.map((message) => {
        const category = contactCategory(message.category);
        const ticket = ticketLabel(message.ticket);
        const page = sameSitePath(message.diagnostics.currentUrl);
        const project = projectHref(message.diagnostics);
        const unread = !message.readAt;
        return (
          <article
            key={message.id}
            id={ticket.slice(1)}
            className={cn("flex scroll-mt-24 flex-col gap-3 rounded-xl border bg-card p-4", unread ? "border-red-500/50 shadow-[inset_4px_0_0_0_rgb(239_68_68)]" : "border-border")}
            data-testid="contact-message"
            data-ticket={ticket}
            data-status={message.status}
            data-unread={unread ? "true" : "false"}
          >
            <header className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">{ticket}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold">
                {category.icon} {category.label}
                {message.subtype ? ` · ${optionLabel(message.subtype)}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</span>
              <span className="text-xs">{STATUS_LABEL[message.status]}</span>
              {unread ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">NEPŘEČTENO</span> : null}
            </header>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 flex-col gap-2">
                {message.message ? <p className="text-sm whitespace-pre-wrap" data-testid="contact-message-text">{message.message}</p> : <p className="text-sm text-muted-foreground italic">(bez textu)</p>}
                {detailRows(message.details).length ? (
                  <dl className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
                    {detailRows(message.details).map((row) => (
                      <div key={row.label} className="contents">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <ContactAttachments files={message.attachments} ticket={ticket} />
              </div>

              <div className="flex flex-col gap-2 text-xs">
                <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 break-words" data-testid="contact-message-contact">
                  {message.name ? (
                    <>
                      <dt className="text-muted-foreground">Jméno</dt>
                      <dd>{message.name}</dd>
                    </>
                  ) : null}
                  {message.company || message.ico ? (
                    <>
                      <dt className="text-muted-foreground">Firma</dt>
                      <dd>
                        {message.company ?? "–"}
                        {message.ico ? <span className="font-mono text-muted-foreground"> · IČO {message.ico}</span> : null}
                      </dd>
                    </>
                  ) : null}
                  {message.email ? (
                    <>
                      <dt className="text-muted-foreground">E-mail</dt>
                      <dd>
                        <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${ticket} – ${category.label}`)}`} className="text-primary hover:underline">
                          {message.email}
                        </a>
                      </dd>
                    </>
                  ) : null}
                  {message.phone ? (
                    <>
                      <dt className="text-muted-foreground">Telefon</dt>
                      <dd>
                        <a href={`tel:${message.phone.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">
                          {message.phone}
                        </a>
                      </dd>
                    </>
                  ) : null}
                  {!message.email && !message.phone ? (
                    <>
                      <dt className="text-muted-foreground">Kontakt</dt>
                      <dd className="text-muted-foreground">bez kontaktu</dd>
                    </>
                  ) : null}
                  {page ? (
                    <>
                      <dt className="text-muted-foreground">Stránka</dt>
                      <dd>
                        <a href={page} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline" data-testid="contact-message-url">
                          {page}
                        </a>
                      </dd>
                    </>
                  ) : null}
                  {message.diagnostics.module ? (
                    <>
                      <dt className="text-muted-foreground">Modul</dt>
                      <dd data-testid="contact-message-module">
                        {MODULE_LABEL[message.diagnostics.module] ?? message.diagnostics.module}
                        {message.diagnostics.wizardPhase ? ` · ${message.diagnostics.wizardPhase}` : ""}
                      </dd>
                    </>
                  ) : null}
                  {message.diagnostics.projectId ? (
                    <>
                      <dt className="text-muted-foreground">Projekt</dt>
                      <dd>
                        {project ? (
                          <a href={project} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline" data-testid="contact-message-project">
                            {message.diagnostics.projectId}
                          </a>
                        ) : (
                          <span className="font-mono">{message.diagnostics.projectId}</span>
                        )}
                      </dd>
                    </>
                  ) : null}
                  {message.diagnostics.viewportSize ? (
                    <>
                      <dt className="text-muted-foreground">Okno</dt>
                      <dd>{message.diagnostics.viewportSize}</dd>
                    </>
                  ) : null}
                  {message.diagnostics.userAgent ? (
                    <>
                      <dt className="text-muted-foreground">Prohlížeč</dt>
                      <dd className="text-[11px] text-muted-foreground">{message.diagnostics.userAgent}</dd>
                    </>
                  ) : null}
                </dl>
                <p className="text-[11px] text-muted-foreground">
                  {message.notifyError ? `⚠️ Notifikace: ${message.notifyError}` : message.notifiedAt ? `✉️ Notifikace odeslána ${formatDateTime(message.notifiedAt)}` : "Notifikace e-mailem / webhookem není nastavená – zpráva je jen tady."}
                </p>
              </div>
            </div>

            <ContactMessageControls key={`${message.status}-${message.internalNote ?? ""}-${unread}`} id={message.id} status={message.status} note={message.internalNote} unread={unread} />
          </article>
        );
      })}
    </section>
  );
}
