"use client";

import { useState, useTransition } from "react";
import { Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { REGIONS, czk, materialText, type TurnkeyConfig, type TurnkeyEstimate } from "@/lib/panel-builder/turnkey-manufacturing";
import { cn } from "@/lib/utils";
import { createManufacturingOrderAction } from "@/server/actions/manufacturing";


export interface ManufacturerOption {
  id: string;
  name: string;
  region: string;
  leadDays: number;
}

/**
 * Fáze 106: „🏭 Poptat / Objednat výrobu rozváděče na klíč“ – co zákazník dostane, orientační kalkulace (materiál, montáž,
 * drátování a kusová zkouška, doprava), výběr zasmluvněného výrobce nebo poptávka všem v kraji, kontakt a odeslání.
 * Po odeslání systém zarezervuje unikátní QR štítek ELDOCK z registru přímo pro tento rozváděč.
 */
export function TurnkeyOrderModal({ projectId, projectLabel, estimate, config, manufacturers, contact, blockers, label = "🏭 Poptat / Objednat výrobu rozváděče na klíč", className }: { projectId: string; projectLabel: string; estimate: TurnkeyEstimate; config: TurnkeyConfig; manufacturers: readonly ManufacturerOption[]; contact: { name: string; email: string; phone: string }; blockers: readonly string[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<string>(manufacturers[0]?.region ?? REGIONS[0]);
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  const [form, setForm] = useState({ contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone, deliveryAddress: "", note: "" });
  const [result, setResult] = useState<{ number: string; qrSerial: string } | null>(null);
  const [pending, start] = useTransition();
  const inRegion = manufacturers.filter((entry) => entry.region === region);
  const submit = (broadcast: boolean) =>
    start(async () => {
      const response = await createManufacturingOrderAction({ projectId, manufacturerId: broadcast ? null : manufacturerId, region, config, ...form });
      if (!response.ok) return void toast.error(response.error);
      setResult(response.data);
      toast.success(`Poptávka ${response.data.number} odeslána – zarezervovaný QR štítek ${response.data.qrSerial}.`);
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={cn("gap-1.5", className)} data-testid="turnkey-open">
          <Factory className="size-4" aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="turnkey-modal">
        <DialogHeader>
          <DialogTitle>Objednávka výroby rozváděče na klíč u certifikovaného výrobce ELDOCK</DialogTitle>
          <DialogDescription>{projectLabel}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/60 bg-emerald-500/10 p-4 text-sm" data-testid="turnkey-done">
            <b>✅ Poptávka {result.number} je odeslaná.</b>
            <span>
              Pro rozváděč je zarezervovaný unikátní QR štítek <b className="font-mono" data-testid="turnkey-serial">{result.qrSerial}</b> – výrobce ho po výrobě nalepí na dveře a pod adresou https://eldock.cz/q/{result.qrSerial} bude uzamčená Verze 1.0 dokumentace.
            </span>
            <span className="text-muted-foreground">Stav zakázky uvidíte v kroku 4 u tohoto rozváděče; po dokončení výroby dostanete e-mail.</span>
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-border p-3 text-sm">
              <h3 className="mb-1 font-semibold">Co dostanete hotové na stavbu</h3>
              <ul className="list-disc pl-5 text-xs leading-relaxed">
                <li>Kompletně osazený, prodrátovaný a odzkoušený rozváděč podle vašeho návrhu (CNC vrtání, drátovací list, hřebeny).</li>
                <li>Protokol o kusové zkoušce dle ČSN EN IEC 61439-1 ed. 3, EU prohlášení o shodě a popisky jističů.</li>
                <li>
                  Nalepený odolný stříbrný <b>QR štítek ELDOCK</b> (https://eldock.cz/q/EL-…) – pod ním v cloudu uzamčená kompletní dokumentace (Verze 1.0).
                </li>
              </ul>
            </section>
            <section className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-4" data-testid="turnkey-estimate">
              <div>
                <span className="block text-xs text-muted-foreground">Materiál</span>
                <b data-testid="turnkey-material">{materialText(estimate)}</b>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Montáž, drátování a kusová zkouška</span>
                <b>{czk(estimate.laborCzk)}</b>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Doprava na stavbu</span>
                <b>{czk(estimate.transportCzk)}</b>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Orientačně celkem bez DPH</span>
                <b className="text-base" data-testid="turnkey-total">
                  {czk(estimate.totalCzk)}
                </b>
              </div>
              <p className="text-[11px] text-muted-foreground sm:col-span-4">Orientační kalkulace – závaznou cenu a termín potvrdí výrobce při přijetí zakázky.{estimate.missingPrices ? ` ${estimate.missingPrices} přístrojů zatím bez ceníkové ceny – celková částka je bez nich, cenu materiálu doplní výrobce.` : ""}</p>
            </section>
            {blockers.length ? (
              <p className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-2 text-xs text-amber-100" data-testid="turnkey-blockers">
                Před výrobou doplňte: {blockers.join(" ")}
              </p>
            ) : null}
            <section className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm">
              <h3 className="font-semibold">Výrobce a region</h3>
              <label className="flex items-center gap-2 text-xs">
                Kraj dodání
                <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 dark:bg-input/30" data-testid="turnkey-region">
                  {REGIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1" role="radiogroup" aria-label="Výrobce">
                {inRegion.length ? (
                  inRegion.map((entry) => (
                    <button key={entry.id} type="button" role="radio" aria-checked={manufacturerId === entry.id} onClick={() => setManufacturerId(entry.id)} className={cn("rounded-lg border px-2.5 py-1.5 text-left text-xs", manufacturerId === entry.id ? "border-primary bg-primary/15 font-semibold" : "border-border hover:bg-muted")} data-testid="turnkey-manufacturer">
                      🏭 {entry.name} · {entry.region} · {entry.leadDays <= 7 ? `⚡ Expresní výroba do ${entry.leadDays} pracovních dnů` : `výroba do ${entry.leadDays} pracovních dnů`}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">V tomto kraji zatím není certifikovaný výrobce – zvolte jiný kraj.</p>
                )}
              </div>
            </section>
            <section className="grid gap-2 rounded-xl border border-border p-3 text-xs sm:grid-cols-2">
              {(
                [
                  ["contactName", "Kontaktní osoba"],
                  ["contactEmail", "E-mail"],
                  ["contactPhone", "Telefon"],
                  ["deliveryAddress", "Adresa stavby / dodání"],
                ] as const
              ).map(([key, title]) => (
                <label key={key} className="flex flex-col gap-0.5">
                  {title}
                  <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="h-8 rounded-md border border-input bg-transparent px-2" data-testid={`turnkey-${key}`} />
                </label>
              ))}
              <label className="flex flex-col gap-0.5 sm:col-span-2">
                Poznámka pro výrobce
                <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="h-16 rounded-md border border-input bg-transparent p-2" />
              </label>
            </section>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || !manufacturerId || blockers.length > 0} onClick={() => submit(false)} data-testid="turnkey-send">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} 📨 Odeslat poptávku vybranému výrobci
              </Button>
              <Button type="button" variant="outline" disabled={pending || !inRegion.length || blockers.length > 0} onClick={() => submit(true)} data-testid="turnkey-broadcast">
                ⚡ Odeslat všem certifikovaným výrobcům ELDOCK v mém regionu
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
