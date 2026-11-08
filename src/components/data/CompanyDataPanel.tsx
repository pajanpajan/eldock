"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLOSURE_CONFIRM_WORD, CLOSURE_GRACE_DAYS, DATA_REQUESTER_LABELS, DATA_REQUEST_KIND_LABELS, DATA_REQUEST_STATUS_LABELS } from "@/lib/data-requests";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DataRequestRow } from "@/server/queries/data-requests";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

interface Props {
  companyName: string;
  /** Adresa stažení ZIP (`/api/data-export`, `?scope=panel`). */
  exportHref: string;
  pending: DataRequestRow | null;
  requests: DataRequestRow[];
  /** Co výmaz smaže (odrážky pro konkrétní produkt). */
  deletes: string[];
  /** Co po výmazu zůstane (doklady). */
  keeps?: string;
  passwordLabel: string;
  /** Ukázkovou firmu zrušit nejde. */
  canClose: boolean;
  requestAction: (input: { password: string; confirm: string }) => Promise<Result<{ scheduledAt: string }>>;
  cancelAction: () => Promise<Result>;
}

const tones = { ok: "text-emerald-300", warn: "text-amber-200", bad: "text-red-300" } as const;

/** Fáze 69 (GDPR): export dat firmy, zrušení účtu firmy s lhůtou a evidence žádostí. */
export function CompanyDataPanel({ companyName, exportHref, pending, requests, deletes, keeps, passwordLabel, canClose, requestAction, cancelAction }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = () =>
    startTransition(async () => {
      const result = await requestAction({ password, confirm });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Žádost přijata – data firmy se smažou ${formatDate(result.data.scheduledAt)}.`);
      setOpen(false);
      setPassword("");
      setConfirm("");
      router.refresh();
    });

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelAction();
      if (!result.ok) return void toast.error(result.error);
      toast.success("Žádost o zrušení účtu je zrušená – účet firmy zůstává.");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <section aria-labelledby="data-export-title" className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 id="data-export-title" className="text-lg font-semibold">
          Export dat firmy
        </h2>
        <p className="text-sm text-muted-foreground">
          Všechna data firmy {companyName} v jednom archivu ZIP: záznamy ve strojově čitelném formátu JSON, přehled zařízení a revizí pro Excel (CSV) a všechny nahrané soubory. Hesla a tajemství dvoufázového ověření se
          neexportují.
        </p>
        <a href={exportHref} download className={cn(buttonVariants({ variant: "outline" }), "w-fit gap-1.5")} data-testid="data-export">
          <Download className="size-4" aria-hidden /> Stáhnout data firmy (ZIP)
        </a>
      </section>

      <section aria-labelledby="data-closure-title" className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="data-closure">
        <h2 id="data-closure-title" className="text-lg font-semibold">
          Zrušení účtu firmy
        </h2>
        {pending ? (
          <div className="space-y-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100" role="alert" data-testid="closure-pending">
            <p className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Účet firmy bude zrušen a data smazána <strong>{formatDate(pending.scheduledAt ?? pending.requestedAt)}</strong>. Do té doby si data stáhněte; žádost můžete zrušit a účet zůstane beze změny.
              </span>
            </p>
            <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={cancel} data-testid="closure-cancel">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />} Zrušit žádost o výmaz
            </Button>
          </div>
        ) : !canClose ? (
          <p className="text-sm text-muted-foreground">Ukázkovou firmu zrušit nejde.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Po žádosti zůstane účet {CLOSURE_GRACE_DAYS} dní beze změny (můžete si stáhnout data nebo žádost zrušit). Potom se nevratně smaže:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {deletes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {keeps ? <p className="text-xs text-muted-foreground">{keeps}</p> : null}
            <p className="text-xs text-muted-foreground">Ze záloh zmizí smazaná data nejpozději za 6 měsíců (denní zálohy 14 dní, měsíční 6 měsíců).</p>
            {open ? (
              <form
                className="grid max-w-md gap-3 rounded-lg border border-red-500/40 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <label className="grid gap-1.5 text-sm">
                  {passwordLabel}
                  <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </label>
                <label className="grid gap-1.5 text-sm">
                  Pro potvrzení napište {CLOSURE_CONFIRM_WORD}
                  <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" required />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="destructive" disabled={busy || !password || !confirm} className="gap-1.5">
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldAlert className="size-4" aria-hidden />} Požádat o zrušení účtu
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Zpět
                  </Button>
                </div>
              </form>
            ) : (
              <Button type="button" variant="outline" className="w-fit gap-1.5 border-red-500/50 text-red-200" onClick={() => setOpen(true)} data-testid="closure-open">
                <ShieldAlert className="size-4" aria-hidden /> Zrušit účet firmy…
              </Button>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="data-requests-title" className="space-y-3">
        <h2 id="data-requests-title" className="text-lg font-semibold">
          Evidence žádostí o data
        </h2>
        <p className="text-sm text-muted-foreground">Exporty, odebrání zaměstnanců a žádosti o zrušení účtu (posledních 20, drží se 3 roky jako doklad o vyřízení).</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm" data-testid="data-requests">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Kdy</th>
                <th className="px-3 py-2 text-left font-medium">Žádost</th>
                <th className="px-3 py-2 text-left font-medium">Podal</th>
                <th className="px-3 py-2 text-left font-medium">Stav</th>
              </tr>
            </thead>
            <tbody>
              {requests.length ? (
                requests.map((request) => {
                  const status = DATA_REQUEST_STATUS_LABELS[request.status];
                  return (
                    <tr key={request.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{formatDateTime(request.requestedAt)}</td>
                      <td className="px-3 py-2">{DATA_REQUEST_KIND_LABELS[request.kind]}</td>
                      <td className="px-3 py-2 text-muted-foreground">{DATA_REQUESTER_LABELS[request.requestedBy] ?? request.requestedBy}</td>
                      <td className={cn("px-3 py-2", tones[status.tone])}>
                        {status.label}
                        {request.status === "PENDING" && request.scheduledAt ? ` – výmaz ${formatDate(request.scheduledAt)}` : ""}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                    Zatím žádná žádost.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
