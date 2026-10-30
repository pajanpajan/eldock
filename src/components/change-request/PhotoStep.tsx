"use client";

import { useRef, useState, type Dispatch } from "react";
import dynamic from "next/dynamic";
import { Camera, ImagePlus, PenLine, RotateCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { resizeImage, uploadFile } from "@/lib/upload-client";

// Editor zákresu (canvas) se stáhne až po kliknutí na „Zakreslit“.
const PhotoAnnotator = dynamic(() => import("./PhotoAnnotator").then((m) => m.PhotoAnnotator), { ssr: false });
import type { WizardAction, WizardPhoto } from "./wizard-state";

const MAX_PHOTOS = 10;

/**
 * Krok 2 – fotky zapojení / štítku: fotoaparát nebo galerie, zmenšení na klientu, nahrání s průběhem.
 * Do každé nahrané fotky lze zakreslit místo změny – nahraje se složená fotka se zákresem.
 */
export function PhotoStep({ photos, dispatch, annotate = true }: { photos: WizardPhoto[]; dispatch: Dispatch<WizardAction>; annotate?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<string, File>());
  const [annotating, setAnnotating] = useState<WizardPhoto | null>(null);

  async function saveAnnotation(photo: WizardPhoto, file: File) {
    files.current.set(photo.key, file);
    dispatch({ type: "updatePhoto", key: photo.key, patch: { previewUrl: URL.createObjectURL(file), url: null, progress: 0, error: null } });
    try {
      const result = await uploadFile("photo", file, (progress) => dispatch({ type: "updatePhoto", key: photo.key, patch: { progress } }));
      dispatch({
        type: "updatePhoto",
        key: photo.key,
        patch: { url: result.url, sizeBytes: result.sizeBytes, progress: 100, annotated: true, caption: photo.caption || "Zákres do fotky" },
      });
      setAnnotating(null);
    } catch (error) {
      dispatch({ type: "updatePhoto", key: photo.key, patch: { error: error instanceof Error ? error.message : "Nahrání se nepodařilo." } });
      setAnnotating(null);
    }
  }

  async function upload(key: string, file: File) {
    dispatch({ type: "updatePhoto", key, patch: { progress: 0, error: null } });
    try {
      const resized = await resizeImage(file);
      files.current.set(key, resized);
      const result = await uploadFile("photo", resized, (progress) => dispatch({ type: "updatePhoto", key, patch: { progress } }));
      dispatch({ type: "updatePhoto", key, patch: { url: result.url, sizeBytes: result.sizeBytes, progress: 100 } });
    } catch (error) {
      dispatch({ type: "updatePhoto", key, patch: { error: error instanceof Error ? error.message : "Nahrání se nepodařilo." } });
    }
  }

  function retry(key: string) {
    const file = files.current.get(key);
    if (file) void upload(key, file);
    else dispatch({ type: "removePhoto", key });
  }

  function onFiles(list: FileList | null) {
    const selected = Array.from(list ?? []).slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    for (const file of selected) {
      const key = crypto.randomUUID();
      dispatch({
        type: "addPhoto",
        photo: {
          key,
          fileName: file.name,
          caption: "",
          previewUrl: URL.createObjectURL(file),
          url: null,
          sizeBytes: file.size,
          progress: 0,
          error: null,
        },
      });
      void upload(key, file);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        aria-label="Vyfotit nebo vybrat fotky"
        data-testid="photo-input"
        onChange={(event) => onFiles(event.target.files)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          className="h-20 gap-3 text-lg"
          onClick={() => inputRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
        >
          <Camera className="size-7" />
          Vyfotit
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-20 gap-3 text-lg"
          onClick={() => {
            // Bez `capture` nabídne mobil i galerii.
            inputRef.current?.removeAttribute("capture");
            inputRef.current?.click();
            inputRef.current?.setAttribute("capture", "environment");
          }}
          disabled={photos.length >= MAX_PHOTOS}
        >
          <ImagePlus className="size-7" />
          Vybrat z galerie
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Vyfoťte zapojení v rozváděči nebo štítek nového přístroje. Fotky se zmenší a nahrají hned (max. {MAX_PHOTOS}).
      </p>

      {photos.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.key} className="overflow-hidden rounded-xl border border-border bg-card" data-uploaded={photo.url ? "true" : "false"}>
              <div className="relative aspect-[4/3] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- lokální náhled (blob:) nebo /api/files */}
                <img src={photo.previewUrl} alt={photo.caption || photo.fileName} className="size-full object-cover" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="touch-target absolute top-2 right-2"
                  onClick={() => dispatch({ type: "removePhoto", key: photo.key })}
                  aria-label={`Odebrat fotku ${photo.fileName}`}
                >
                  <X className="size-5" />
                </Button>
                {photo.annotated ? (
                  <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                    <PenLine className="size-3.5" aria-hidden /> Se zákresem
                  </span>
                ) : null}
                {photo.url && annotate ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="touch-target absolute bottom-2 left-2 gap-1.5"
                    onClick={() => setAnnotating(photo)}
                    aria-label={`Zakreslit do fotky ${photo.fileName}`}
                  >
                    <PenLine className="size-4" />
                    Zakreslit
                  </Button>
                ) : null}
                {!photo.url && !photo.error ? (
                  <div className="absolute inset-x-0 bottom-0 bg-zinc-950/80 p-2">
                    <Progress value={photo.progress} aria-label="Průběh nahrávání" />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                {photo.error ? (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <span className="flex-1">{photo.error}</span>
                    <Button size="sm" variant="outline" onClick={() => retry(photo.key)}>
                      <RotateCw className="size-4" />
                      Znovu
                    </Button>
                  </div>
                ) : null}
                <Input
                  value={photo.caption}
                  onChange={(event) => dispatch({ type: "updatePhoto", key: photo.key, patch: { caption: event.target.value } })}
                  placeholder="Popisek (nepovinné)"
                  aria-label="Popisek fotky"
                  className="h-11"
                  maxLength={200}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {annotating ? (
        <PhotoAnnotator
          key={annotating.key}
          open
          imageSrc={annotating.previewUrl}
          fileName={annotating.fileName}
          onClose={() => setAnnotating(null)}
          onSave={(file) => saveAnnotation(annotating, file)}
        />
      ) : null}
    </div>
  );
}
