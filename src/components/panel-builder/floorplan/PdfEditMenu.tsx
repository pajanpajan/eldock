"use client";

import { BrickWall, CheckCircle2, ChevronDown, Crop, FileCog, Hammer, Maximize2, Ruler, RotateCcw, RotateCw, SquareDashed, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type PdfEditAction = "rotate-cw" | "rotate-ccw" | "zoom-in" | "zoom-out" | "zoom-fit" | "crop" | "crop-reset" | "calibrate" | "verify" | "draw-wall" | "draw-demolish" | "draw-zone" | "draw-text";

/**
 * Fáze 57: menu „Úprava PDF“ nad půdorysem – otočení podkladu o 90°, zoom, ořez a kalibrace měřítka s ověřením.
 * Bez podkladu (čistý rastr) zůstává jen zoom. Fáze 59: zakreslení změn (příčka, bourání, šrafa, text) i nad rastrem.
 */
export function PdfEditMenu({ hasBackground, cropped, zoomPercent, calibration, onAction }: { hasBackground: boolean; cropped: boolean; zoomPercent: number; calibration: "none" | "set" | "verified"; onAction: (action: PdfEditAction) => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" data-testid="pdf-edit-menu">
          <FileCog className="size-4" aria-hidden /> Úprava PDF
          {hasBackground && calibration !== "verified" ? <span className="size-2 rounded-full bg-amber-400" aria-label="měřítko neověřeno" /> : null}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Otočení podkladu</DropdownMenuLabel>
        <DropdownMenuItem disabled={!hasBackground} onSelect={() => onAction("rotate-cw")}>
          <RotateCw className="size-4" aria-hidden /> Otočit o 90° doprava
          <DropdownMenuShortcut>]</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasBackground} onSelect={() => onAction("rotate-ccw")}>
          <RotateCcw className="size-4" aria-hidden /> Otočit o 90° doleva
          <DropdownMenuShortcut>[</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Zoom ({zoomPercent} %)</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAction("zoom-in")}>
          <ZoomIn className="size-4" aria-hidden /> Přiblížit
          <DropdownMenuShortcut>+</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("zoom-out")}>
          <ZoomOut className="size-4" aria-hidden /> Oddálit
          <DropdownMenuShortcut>−</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("zoom-fit")}>
          <Maximize2 className="size-4" aria-hidden /> Celý výkres
          <DropdownMenuShortcut>0</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Ořez</DropdownMenuLabel>
        <DropdownMenuItem disabled={!hasBackground} onSelect={() => onAction("crop")}>
          <Crop className="size-4" aria-hidden /> Oříznout podklad (tažením)
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!cropped} onSelect={() => onAction("crop-reset")}>
          <Undo2 className="size-4" aria-hidden /> Zrušit ořez
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Měřítko</DropdownMenuLabel>
        <DropdownMenuItem disabled={!hasBackground} onSelect={() => onAction("calibrate")}>
          <Ruler className="size-4" aria-hidden /> Kalibrovat měřítko (2 body + délka)
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasBackground || calibration === "none"} onSelect={() => onAction("verify")}>
          <CheckCircle2 className="size-4" aria-hidden /> Ověřit měřítko druhou kótou
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Zakreslení změn</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAction("draw-wall")}>
          <BrickWall className="size-4 text-red-400" aria-hidden /> Nová příčka (barva, šrafa, tloušťka)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("draw-demolish")}>
          <Hammer className="size-4 text-amber-400" aria-hidden /> Bouraná konstrukce
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("draw-zone")}>
          <SquareDashed className="size-4 text-sky-400" aria-hidden /> Šrafovaná oblast / označení
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("draw-text")}>
          <Type className="size-4" aria-hidden /> Textové pole
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
