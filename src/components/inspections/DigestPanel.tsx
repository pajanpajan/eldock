"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Eye, Loader2, Mail, ServerCog, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DIGEST_BUCKETS, daysLabel, type DigestBucket, type DigestItem } from "@/lib/inspection-digest";
import { formatDate, formatDateTime, formatCount } from "@/lib/format";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { sendInspectionDigestAction } from "@/server/actions/notifications";
import type { DigestLogEntry } from "@/server/queries/notifications";

const BUCKET_STYLE: Record<DigestBucket, string> = {
  overdue: "border-red-500/40 bg-red-500/10 text-red-300",
  within14: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  within30: "border-amber-500/40 bg-amber-500/10 text-amber-200",
};

const DELIVERY: Record<string, { label: string; className: string }> = {
  SENT: { label: "Odesláno e-mailem", className: "text-emerald-300" },
  LOGGED: { label: "Uloženo do logu (bez SMTP)", className: "text-sky-300" },
  FAILED: { label: "Chyba odeslání", className: "text-red-300" },
};

interface PreviewState {
  title: string;
  description: string;
  html: string;
}

/** Hlídač lhůt: tři skupiny zařízení, příjemci, náhled e-mailu, ruční odeslání a log avíz. */
export function DigestPanel({
  plantId,
  groups,
  recipients,
  preview,
  log,
  smtpConfigured,
  cronConfigured,
}: {
  plantId: string;
  groups: Record<DigestBucket, DigestItem[]>;
  recipients: { id: string; name: string; email: string; title: string | null }[];
  preview: { subject: string; html: string };
  log: DigestLogEntry[];
  smtpConfigured: boolean;
  cronConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<PreviewState | null>(null);

  function send() {
    startTransition(async () => {
      const result = await sendInspectionDigestAction({ plantId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { delivery, recipients: to, subject, html, error } = result.data;
      if (delivery === "SENT") toast.success("Souhrnné avízo odesláno.", { description: to });
      else if (delivery === "LOGGED") toast.success("Avízo uloženo do logu notifikací.", { description: "SMTP server není nastaven – níže je náhled e-mailu." });
      else toast.error("E-mail se nepodařilo odeslat, avízo je v logu.", { description: error ?? undefined });
      setDialog({ title: DELIVERY[delivery]?.label ?? delivery, description: `${subject} · příjemci: ${to || "–"}`, html });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {DIGEST_BUCKETS.map((bucket) => (
          <section key={bucket.key} className={cn("rounded-xl border p-4", BUCKET_STYLE[bucket.key])} data-testid={`digest-${bucket.key}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">{bucket.title}</h2>
              <span className="font-mono text-3xl font-bold">{groups[bucket.key].length}</span>
            </div>
            {groups[bucket.key].length ? (
              <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                {groups[bucket.key].map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-2">
                    <Link href={equipmentHref(item.id)} className="min-w-0 truncate underline-offset-4 hover:underline">
                      <span className="font-mono font-semibold">{item.tag}</span> <span className="text-muted-foreground">{item.name.replace(`${item.tag} - `, "")}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground" title={formatDate(item.validUntil)}>
                      {daysLabel(item.daysLeft)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Žádné zařízení.</p>
            )}
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" aria-hidden />
            <h2 className="font-semibold">Souhrnné avízo vedení závodu</h2>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Příjemci</p>
            <ul className="mt-1 space-y-1 text-sm">
              {recipients.map((recipient) => (
                <li key={recipient.id} className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  <span>{recipient.name}</span>
                  <span className="text-muted-foreground">· {recipient.title ?? ""}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{recipient.email}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="space-y-1 text-sm">
            <li className={cn("flex items-center gap-2", smtpConfigured ? "text-emerald-300" : "text-sky-300")}>
              {smtpConfigured ? <CheckCircle2 className="size-4" aria-hidden /> : <ServerCog className="size-4" aria-hidden />}
              {smtpConfigured ? "SMTP server je nastaven – avízo odejde e-mailem." : "SMTP server není nastaven – avízo se uloží do logu notifikací s náhledem."}
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <ServerCog className="size-4" aria-hidden />
              {cronConfigured ? "Cron: POST /api/cron/inspection-alerts (token nastaven)." : "Cron: POST /api/cron/inspection-alerts – nastavte ELDOCK_CRON_SECRET."}
            </li>
          </ul>
          <Button size="lg" className="touch-target w-full gap-2" onClick={send} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Odeslat souhrnné avízo nyní
          </Button>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Log notifikací</h3>
            {log.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border text-sm" data-testid="digest-log">
                {log.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium", DELIVERY[entry.delivery]?.className)}>
                        {entry.delivery === "FAILED" ? <TriangleAlert className="mr-1 inline size-4" aria-hidden /> : null}
                        {DELIVERY[entry.delivery]?.label ?? entry.delivery}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)} · {formatCount(entry.itemCount, ["zařízení", "zařízení", "zařízení"])} · {entry.triggeredBy === "cron" ? "cron" : "ručně"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="touch-target"
                      aria-label={`Náhled avíza z ${formatDateTime(entry.createdAt)}`}
                      onClick={() => setDialog({ title: DELIVERY[entry.delivery]?.label ?? entry.delivery, description: `${entry.subject} · příjemci: ${entry.recipients || "–"}`, html: entry.html })}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Zatím nebylo odesláno žádné avízo.</p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Náhled e-mailu</h2>
          <p className="text-sm text-muted-foreground">
            Předmět: <span className="text-foreground">{preview.subject}</span>
          </p>
          <EmailFrame html={preview.html} title="Náhled souhrnného avíza" />
        </section>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-400" aria-hidden />
              {dialog?.title}
            </DialogTitle>
            <DialogDescription>{dialog?.description}</DialogDescription>
          </DialogHeader>
          {dialog ? <EmailFrame html={dialog.html} title="Odeslané avízo" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** E-mail v izolovaném rámu (`sandbox` bez skriptů, `srcDoc` – mimo hlavičku X-Frame-Options). */
function EmailFrame({ html, title }: { html: string; title: string }) {
  return <iframe srcDoc={html} sandbox="" title={title} className="h-[32rem] w-full rounded-lg border border-border bg-white" data-testid="digest-email-preview" />;
}
