"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Fáze 108 – vrstva B: k uzamčené revizi nahraje protokol podepsaný kvalifikovaným certifikátem (PAdES).
 * Postup: uložit protokol jako PDF → podepsat certifikátem (USB token, čipová karta, eObčanka) → nahrát.
 */
export function PadesUpload({ inspectionId, padesUrl, padesInfo }: { inspectionId: string; padesUrl: string | null; padesInfo: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("inspectionId", inspectionId);
      form.set("file", file);
      const response = await fetch("/api/inspections/pades", { method: "POST", body: form });
      const body = (await response.json()) as { error?: string; info?: string };
      if (!response.ok) return setError(body.error ?? "Podepsaný protokol se nepodařilo nahrát.");
      toast.success("Podepsaný protokol (PAdES) připojen k revizi.", { description: body.info });
      router.refresh();
    } catch {
      setError("Podepsaný protokol se nepodařilo nahrát.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (padesUrl) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" data-testid="pades-attached">
        <FileCheck2 className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">Připojen protokol s kvalifikovaným podpisem (PAdES){padesInfo ? ` · ${padesInfo.split(" · SHA-256")[0]}` : ""}.</span>
        <a href={padesUrl} className="font-semibold underline" target="_blank" rel="noreferrer">
          Stáhnout podepsaný PDF
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card px-3 py-2 text-sm" data-testid="pades-upload">
      <p>
        <strong>Vrstva B – kvalifikovaný podpis PAdES:</strong> 1) „Vytisknout / uložit PDF“ → Uložit jako PDF, 2) podepište PDF svým kvalifikovaným certifikátem (USB token, čipová karta, eObčanka) v programu pro podepisování PDF, 3) nahrajte podepsaný soubor sem – připojí se k uzamčené revizi.
      </p>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0])} data-testid="pades-file" />
      <Button type="button" variant="outline" className="gap-2" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} Nahrát podepsaný PDF (PAdES)
      </Button>
      {error ? (
        <p className="text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
