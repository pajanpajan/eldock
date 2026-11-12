"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { EldockLabelFace } from "@/components/qr/EldockQrLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LABEL_PURPOSES, serialCode, type LabelPurpose } from "@/lib/qr-label-registry";
import { cn } from "@/lib/utils";
import { createLabelBatchAction } from "@/server/actions/qr-labels";

type Company = { id: string; companyName: string; ico: string; email: string };
type Created = { id: string; first: string; last: string; count: number; companyName: string; registered: boolean };

/**
 * Fáze 103: nová série QR štítků ELDOCK pro firmu – výběr registrované firmy nebo ruční zadání s načtením z ARES, účel
 * a rozměr štítku (Zebra ZD421t 300 DPI), počet kusů; výstupy na 1 klik (kotouč 1:1, arch A4, ZPL).
 */
export function QrBatchForm({ companies, nextSequence }: { companies: Company[]; nextSequence: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aresPending, startAres] = useTransition();
  const [companyName, setCompanyName] = useState("");
  const [ico, setIco] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState<LabelPurpose>("SWITCHBOARD");
  const [count, setCount] = useState("100");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  function pickCompany(id: string) {
    const company = companies.find((item) => item.id === id);
    if (!company) return;
    setCompanyName(company.companyName);
    setIco(company.ico);
    setEmail(company.email);
  }

  function loadAres() {
    startAres(async () => {
      const response = await fetch(`/api/ares?ico=${encodeURIComponent(ico.trim())}`).catch(() => null);
      const body = (await response?.json().catch(() => null)) as { companyName?: string; error?: string } | null;
      if (!response?.ok || !body?.companyName) return void toast.error(body?.error ?? "ARES teď neodpovídá – vyplňte název firmy ručně.");
      setCompanyName(body.companyName);
      toast.success(`ARES: ${body.companyName}`);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createLabelBatchAction({ companyName, ico: ico || null, email: email || null, purpose, count: Number(count), note: note || null });
      if (!result.ok) return void toast.error(result.error);
      setCreated(result.data);
      toast.success(`Série ${result.data.first} – ${result.data.last} vydána firmě ${result.data.companyName}.`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-4" data-testid="qr-batch-form">
      <h3 className="font-semibold">Nová série štítků pro firmu</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground xl:col-span-4">
          Vybrat registrovanou firmu (nebo vyplňte níže)
          <select defaultValue="" onChange={(event) => pickCompany(event.target.value)} className="h-10 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" data-testid="qr-batch-company-pick">
            <option value="">— vlastní zadání —</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.companyName} · IČO {company.ico}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-2">
          Název firmy
          <Input value={companyName} maxLength={160} onChange={(event) => setCompanyName(event.target.value)} className="h-10" data-testid="qr-batch-company" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          IČO (načtení z ARES)
          <div className="flex gap-1">
            <Input value={ico} inputMode="numeric" maxLength={10} onChange={(event) => setIco(event.target.value)} className="h-10 font-mono" data-testid="qr-batch-ico" />
            <Button type="button" variant="outline" className="h-10 gap-1 px-2" disabled={aresPending || ico.trim().length < 6} onClick={loadAres} data-testid="qr-batch-ares">
              {aresPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />} ARES
            </Button>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          E-mail zákazníka
          <Input type="email" value={email} maxLength={160} onChange={(event) => setEmail(event.target.value)} className="h-10" data-testid="qr-batch-email" />
        </label>
      </div>

      <fieldset className="grid gap-2 lg:grid-cols-3">
        <legend className="mb-1 text-xs text-muted-foreground">Účel a přesný rozměr štítku (termotransfer Zebra ZD421t – 300 DPI)</legend>
        {LABEL_PURPOSES.map((item) => (
          <label key={item.id} className={cn("flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-sm", purpose === item.id ? "border-primary bg-primary/10" : "border-border")} data-testid={`qr-purpose-${item.id}`}>
            <span className="flex items-center gap-2">
              <input type="radio" name="purpose" value={item.id} checked={purpose === item.id} onChange={() => setPurpose(item.id)} className="accent-primary" />
              <strong>
                {item.icon} {item.title}
              </strong>
            </span>
            <span className="text-xs text-muted-foreground">
              {item.widthMm} × {item.heightMm} mm – {item.norm}
            </span>
            <span className="w-fit rounded bg-white p-1">
              <EldockLabelFace code={serialCode(nextSequence)} purpose={item.id} companyName={companyName || "Firma s.r.o."} />
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Počet štítků (1–5 000)
          <Input type="number" min={1} max={5000} value={count} onChange={(event) => setCount(event.target.value)} className="h-10 font-mono" data-testid="qr-batch-count" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Poznámka k sérii
          <Input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} className="h-10" />
        </label>
        <Button type="submit" className="touch-target gap-2" disabled={pending || companyName.trim().length < 2} data-testid="qr-batch-submit">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}🏷️ Vygenerovat sérii od {serialCode(nextSequence)}
        </Button>
      </div>

      {created ? (
        <div className="space-y-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm" data-testid="qr-batch-created">
          <p>
            ✅ Série <strong className="font-mono">{created.first}</strong> až <strong className="font-mono">{created.last}</strong> ({created.count} ks) je trvale spárovaná s firmou <strong>{created.companyName}</strong>
            {created.registered ? " (registrovaná firma AI Panel Builderu)" : " – po registraci firmy se spáruje podle IČO / e-mailu"}.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={`/superadmin/qr-stitky/${created.id}/tisk?format=roll`} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground" data-testid="qr-batch-print-roll">
              🖨️ Tisk na kotouč Zebra ZD421t (PDF 1:1 + ZPL)
            </a>
            <a href={`/superadmin/qr-stitky/${created.id}/tisk?format=a4`} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-2" data-testid="qr-batch-print-a4">
              📄 Tisk na arch A4 (samolepicí arch)
            </a>
            <a href={`/superadmin/qr-stitky/${created.id}/zpl`} className="rounded-md border border-border px-3 py-2">
              ⬇️ ZPL kód
            </a>
          </div>
        </div>
      ) : null}
    </form>
  );
}
