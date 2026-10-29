"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPlantAction } from "@/server/actions/plants";

interface PlantOption {
  id: string;
  code: string;
  name: string;
  city: string | null;
}

/** Přepínač závodu; aktivní závod se pozná z URL (`/plant/<id>/…`). Účty se Studiem mohou založit nový areál. */
export function PlantSwitcher({ plants, fallbackId, canCreate = false }: { plants: PlantOption[]; fallbackId?: string; canCreate?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = /^\/plant\/([^/]+)/.exec(pathname)?.[1] ?? fallbackId;
  const active = plants.find((plant) => plant.id === activeId);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const valid = name.trim().length >= 3 && /^[A-Z0-9]{2,6}$/.test(code);

  function create() {
    startTransition(async () => {
      const result = await createPlantAction({ name, code, location: location || null });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Areál ${name} založen.`, { description: "Přidejte do něj první budovu ve Studiu." });
      setOpen(false);
      setName("");
      setCode("");
      setLocation("");
      router.push(result.data.href);
    });
  }

  return (
    <>
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
          {canCreate ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11 gap-2 text-primary" onSelect={() => setOpen(true)}>
                + Přidat nový areál / závod
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nový areál / závod</DialogTitle>
            <DialogDescription>Založí se čistý areál bez budov. Budovy pak přidáte ve Studiu výstavby.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="plant-name">Název areálu</Label>
              <Input id="plant-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Závod Turnov – Optika" className="h-11" />
            </div>
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
              <div className="space-y-2">
                <Label htmlFor="plant-code">Kód</Label>
                <Input id="plant-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={6} placeholder="TUR" className="h-11 font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plant-location">Město / adresa</Label>
                <Input id="plant-location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} placeholder="Nádražní 15, Turnov" className="h-11" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zrušit
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2" onClick={create} disabled={pending || !valid}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Založit areál
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
