"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PlantOption {
  id: string;
  code: string;
  name: string;
  city: string | null;
}

/** Přepínač závodu; aktivní závod se pozná z URL (`/plant/<id>/…`). */
export function PlantSwitcher({ plants, fallbackId }: { plants: PlantOption[]; fallbackId?: string }) {
  const pathname = usePathname();
  const activeId = /^\/plant\/([^/]+)/.exec(pathname)?.[1] ?? fallbackId;
  const active = plants.find((plant) => plant.id === activeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="touch-target max-w-[11rem] gap-2 px-3 sm:max-w-none" aria-label="Přepnout závod">
          <Building2 className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{active?.name ?? "Vyberte závod"}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuLabel>Závody</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {plants.map((plant) => (
          <DropdownMenuItem key={plant.id} asChild className="min-h-11 gap-2">
            <Link href={`/plant/${plant.id}`}>
              <span className="font-mono text-xs text-muted-foreground">{plant.code}</span>
              <span className="flex-1">{plant.name}</span>
              {plant.id === active?.id ? <Check className="size-4 text-primary" aria-hidden /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
