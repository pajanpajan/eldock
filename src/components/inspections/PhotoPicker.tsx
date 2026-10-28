"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { resizeImage, uploadFile, type UploadedFile } from "@/lib/upload-client";

/** Jedna volitelná fotka (fotoaparát / galerie) – zmenší se a nahraje přes POST /api/uploads. */
export function PhotoPicker({ value, onChange, label = "Přidat fotku (nepovinné)" }: { value: UploadedFile | null; onChange: (file: UploadedFile | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setProgress(0);
    try {
      onChange(await uploadFile("photo", await resizeImage(file), setProgress));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nahrání fotky se nepodařilo.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} aria-label={label} />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- náhled nahrané fotky z /api/files */}
          <img src={value.url} alt="Nahraná fotka" className="size-14 rounded object-cover" />
          <span className="min-w-0 flex-1 truncate text-sm">{value.fileName}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Odebrat fotku">
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="touch-target w-full gap-2 border-dashed" onClick={() => input.current?.click()} disabled={progress !== null}>
          {progress !== null ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" aria-hidden />}
          {label}
        </Button>
      )}
      {progress !== null ? <Progress value={progress} /> : null}
    </div>
  );
}
