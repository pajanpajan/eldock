"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_STATUSES, STATUS_LABEL, type ContactStatus } from "@/lib/contact";
import { cn } from "@/lib/utils";

// Fáze 107: ovládání zprávy ve velínu přes PATCH /api/contact – stav 🔴 Nové → 🟡 V řešení → 🟢 Vyřešeno, interní
// poznámka, přečteno / nepřečteno; velké náhledy printscreenů s lightboxem přes celou obrazovku.

async function patchContact(body: Record<string, unknown>): Promise<boolean> {
  const response = await fetch("/api/contact", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.ok) return true;
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  toast.error(data.error ?? "Změnu se nepodařilo uložit.");
  return false;
}

const STATUS_STYLE: Record<ContactStatus, string> = {
  NEW: "border-red-500/60 bg-red-500/15 text-red-200",
  IN_PROGRESS: "border-amber-500/60 bg-amber-500/15 text-amber-200",
  RESOLVED: "border-emerald-500/60 bg-emerald-500/15 text-emerald-200",
};

export function ContactMessageControls({ id, status, note, unread }: { id: string; status: ContactStatus; note: string | null; unread: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  async function update(body: Record<string, unknown>, success?: string) {
    setSaving(true);
    const ok = await patchContact({ id, ...body });
    setSaving(false);
    if (!ok) return;
    if (success) toast.success(success);
    startTransition(() => router.refresh());
  }

  const busy = saving || pending;
  return (
    <div className="flex flex-col gap-2" data-testid="contact-controls">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Stav zprávy">
        {CONTACT_STATUSES.map((value, index) => (
          <span key={value} className="flex items-center gap-1.5">
            {index ? (
              <span className="text-muted-foreground" aria-hidden>
                ➔
              </span>
            ) : null}
            <button
              type="button"
              role="radio"
              aria-checked={status === value}
              disabled={busy || status === value}
              onClick={() => update({ status: value })}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors", status === value ? STATUS_STYLE[value] : "border-border text-muted-foreground hover:text-foreground")}
              data-testid={`contact-status-${value}`}
            >
              {STATUS_LABEL[value]}
            </button>
          </span>
        ))}
        <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" disabled={busy} onClick={() => update({ read: unread })} data-testid="contact-toggle-read">
          {unread ? "✓ Označit jako přečtené" : "Označit jako nepřečtené"}
        </Button>
      </div>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
        <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={4000} placeholder="Interní poznámka (vidí jen velín)" className="min-h-0 text-xs" aria-label="Interní poznámka" data-testid="contact-note" />
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" disabled={busy || draft === (note ?? "")} onClick={() => update({ internalNote: draft }, "Poznámka uložena.")} data-testid="contact-note-save">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Uložit poznámku
        </Button>
      </div>
    </div>
  );
}

export function MarkAllContactRead({ unread }: { unread: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!unread) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        if (await patchContact({ allRead: true })) startTransition(() => router.refresh());
      }}
      data-testid="contact-all-read"
    >
      ✓ Označit vše jako přečtené ({unread})
    </Button>
  );
}

/** Velké náhledy printscreenů – klik otevře obrázek přes celou obrazovku (šipky / Esc). */
export function ContactAttachments({ files, ticket }: { files: { url: string; width: number; height: number }[]; ticket: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const count = files.length;
  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIndex(null);
      if (event.key === "ArrowRight") setIndex((current) => (current === null ? null : (current + 1) % count));
      if (event.key === "ArrowLeft") setIndex((current) => (current === null ? null : (current - 1 + count) % count));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, count]);
  if (!count) return null;
  const current = index === null ? null : files[index];
  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {files.map((file, position) => (
          <li key={file.url}>
            <button type="button" onClick={() => setIndex(position)} className="block w-full overflow-hidden rounded-lg border border-border bg-white hover:border-primary" aria-label={`Otevřít printscreen ${position + 1} zprávy ${ticket} přes celou obrazovku`} data-testid="contact-attachment">
              {/* eslint-disable-next-line @next/next/no-img-element -- printscreen se servíruje přes /api/files (jen velín) */}
              <img src={file.url} alt={`Printscreen ${position + 1} – ${ticket}`} width={file.width} height={file.height} loading="lazy" className="max-h-72 w-full object-contain" />
            </button>
          </li>
        ))}
      </ul>
      {current ? (
        <div role="dialog" aria-modal="true" aria-label={`Printscreen ${index! + 1} / ${count} – ${ticket}`} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" onClick={() => setIndex(null)} data-testid="contact-lightbox">
          {/* eslint-disable-next-line @next/next/no-img-element -- printscreen přes celou obrazovku */}
          <img src={current.url} alt={`Printscreen ${index! + 1} – ${ticket}`} className="max-h-full max-w-full object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
          <button type="button" onClick={() => setIndex(null)} className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Zavřít náhled" data-testid="contact-lightbox-close">
            <X className="size-5" aria-hidden />
          </button>
          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIndex((index! - 1 + count) % count);
                }}
                className="absolute left-4 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Předchozí printscreen"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIndex((index! + 1) % count);
                }}
                className="absolute right-4 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Další printscreen"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          ) : null}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {ticket} · {index! + 1} / {count} · Esc zavře
          </p>
        </div>
      ) : null}
    </>
  );
}
