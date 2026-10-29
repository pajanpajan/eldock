"use client";

import { Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { LogoMark } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BRAND } from "@/lib/brand";

/** QR kód s přímým odkazem na zařízení + tisk štítku (print CSS v globals.css: `.print-area`). */
export function QrDialog({ url, tag, name, location }: { url: string; tag: string; name: string; location: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="touch-target gap-2">
          <QrCode className="size-4" />
          QR kód
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR kód zařízení</DialogTitle>
          <DialogDescription>Naskenujte telefonem nebo vytiskněte štítek na dvířka rozváděče.</DialogDescription>
        </DialogHeader>

        <div className="print-area mx-auto flex w-full max-w-72 flex-col items-center gap-3 rounded-xl bg-white p-5 text-zinc-950">
          <QRCodeSVG value={url} size={220} level="M" marginSize={0} className="h-auto w-full" title={`QR kód – ${tag}`} />
          <div className="text-center">
            <div className="font-mono text-2xl font-bold">{tag}</div>
            <div className="text-sm">{name.replace(`${tag} - `, "")}</div>
            <div className="mt-1 text-xs text-zinc-600">{location}</div>
          </div>
          <div className="flex w-full items-center justify-center gap-1.5 border-t border-zinc-300 pt-2 text-[10px] font-semibold tracking-wide text-zinc-700">
            <LogoMark className="size-4" />
            {BRAND.mark} · {BRAND.domain}
          </div>
        </div>
        <p className="font-mono text-xs break-all text-muted-foreground">{url}</p>

        <DialogFooter>
          <Button className="touch-target gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />
            Vytisknout štítek
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
