"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Stamp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { whitenToTransparent } from "@/lib/image-alpha";
import { uploadFile } from "@/lib/upload-client";
import { setCompanyBrandingAction } from "@/server/actions/panel-design";

/** Razítko z fotky / skenu: bílé pozadí → průhledné (HTML5 Canvas), max. 1200 px, PNG. */
async function transparentStamp(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Prohlížeč nepodporuje Canvas.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  whitenToTransparent(image.data);
  context.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Razítko se nepodařilo převést.");
  return new File([blob], "razitko.png", { type: "image/png" });
}

const checkerboard = { backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%)", backgroundSize: "16px 16px" };

/**
 * Firemní logo a otisk razítka s podpisem (fáze 43): logo se propisuje na titulní list, do rohového
 * razítka výkresů a na štítek CE; razítko do ES prohlášení o shodě a protokolu kusové zkoušky.
 */
export function CompanyBrandingForm({ initial }: { initial: { logoUrl: string | null; stampUrl: string | null } }) {
  const router = useRouter();
  const logoInput = useRef<HTMLInputElement>(null);
  const stampInput = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [stampUrl, setStampUrl] = useState(initial.stampUrl);
  const [busy, setBusy] = useState<"logo" | "stamp" | null>(null);
  const [, startTransition] = useTransition();

  function save(patch: { logoUrl?: string | null; stampUrl?: string | null }, success: string) {
    startTransition(async () => {
      const result = await setCompanyBrandingAction(patch);
      setBusy(null);
      if (!result.ok) return void toast.error(result.error);
      setLogoUrl(result.data.logoUrl);
      setStampUrl(result.data.stampUrl);
      toast.success(success);
      router.refresh();
    });
  }

  async function upload(kind: "logo" | "stamp", file: File) {
    setBusy(kind);
    try {
      const prepared = kind === "stamp" ? await transparentStamp(file) : file;
      const uploaded = await uploadFile("document", prepared);
      save(kind === "logo" ? { logoUrl: uploaded.url } : { stampUrl: uploaded.url }, kind === "logo" ? "Logo uloženo – propíše se do dokumentace." : "Razítko uloženo s průhledným pozadím.");
    } catch (error) {
      setBusy(null);
      toast.error(error instanceof Error ? error.message : "Soubor se nepodařilo nahrát.");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="company-branding">
      <section aria-label="Firemní logo" className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold">Firemní logo</h3>
        <p className="text-xs text-muted-foreground">PNG, SVG nebo JPG. Titulní list (List 1), rohové razítko výkresů (Listy 1–6) a výrobní štítek CE.</p>
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border bg-white p-2" data-testid="logo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- nahraný soubor firmy (/api/files) */}
          {logoUrl ? <img src={logoUrl} alt="Firemní logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-zinc-500">Logo zatím není nahrané</span>}
        </div>
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="sr-only"
          aria-label="Soubor s logem"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload("logo", file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={() => logoInput.current?.click()}>
            {busy === "logo" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />} Nahrát logo
          </Button>
          {logoUrl ? (
            <Button type="button" variant="ghost" className="gap-1.5 text-red-300" disabled={busy !== null} onClick={() => save({ logoUrl: null }, "Logo odebráno.")}>
              <Trash2 className="size-4" aria-hidden /> Odebrat
            </Button>
          ) : null}
        </div>
      </section>

      <section aria-label="Razítko a podpis" className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold">Otisk razítka a podpisu</h3>
        <p className="text-xs text-muted-foreground">
          PNG nebo JPG (sken / fotka na bílém papíře). Bílé pozadí se při nahrání vyčistí na průhledné, takže razítko na čáře podpisu vypadá jako skutečný otisk. Vloží se do ES prohlášení o shodě a protokolu kusové
          zkoušky.
        </p>
        <div className="relative flex h-28 items-end justify-center rounded-lg border border-dashed border-border p-2" style={checkerboard} data-testid="stamp-preview">
          <span className="absolute inset-x-6 bottom-6 border-t border-black" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element -- nahraný soubor firmy (/api/files) */}
          {stampUrl ? <img src={stampUrl} alt="Razítko a podpis" className="relative max-h-full max-w-full object-contain" /> : <span className="relative mb-8 text-xs text-zinc-600">Razítko zatím není nahrané</span>}
        </div>
        <input
          ref={stampInput}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          aria-label="Soubor s razítkem"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload("stamp", file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={() => stampInput.current?.click()}>
            {busy === "stamp" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Stamp className="size-4" aria-hidden />} Nahrát razítko
          </Button>
          {stampUrl ? (
            <Button type="button" variant="ghost" className="gap-1.5 text-red-300" disabled={busy !== null} onClick={() => save({ stampUrl: null }, "Razítko odebráno.")}>
              <Trash2 className="size-4" aria-hidden /> Odebrat
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
