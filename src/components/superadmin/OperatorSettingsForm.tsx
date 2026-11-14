"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LABEL_KINDS, footerLine, type LabelKind, type LabelSet, type OperatorProfile } from "@/lib/operator";
import { saveLabelSetsAction, saveOperatorProfileAction } from "@/server/actions/superadmin";

/**
 * Fáze 112: velín – údaje provozovatele (patička webu, zálohové faktury s QR platbou, VOP a zásady) a sady QR štítků
 * k objednání. Jedno uložení se propíše všude.
 */

const KINDS: readonly LabelKind[] = ["A", "S", "M"];

interface SetRow {
  title: string;
  description: string;
  A: number;
  S: number;
  M: number;
  priceExclVat: number;
}

const FIELDS: { key: Exclude<keyof OperatorProfile, "vatPayer">; label: string; placeholder?: string }[] = [
  { key: "brand", label: "Značka webu" },
  { key: "name", label: "Jméno / obchodní firma provozovatele" },
  { key: "street", label: "Ulice a č. p.", placeholder: "nepovinné" },
  { key: "zip", label: "PSČ" },
  { key: "city", label: "Obec" },
  { key: "email", label: "E-mail" },
  // Fáze 113: IČO, DIČ a spisová značka nepovinné (režim před založením s.r.o.) – faktura i patička se obejdou bez nich
  { key: "ico", label: "IČO (nepovinné)", placeholder: "8 číslic – zatím nevyplněno" },
  { key: "dic", label: "DIČ (nepovinné)", placeholder: "CZ12345678 – jen plátce DPH" },
  { key: "registry", label: "Spisová značka (nepovinné)", placeholder: "např. C 12345 vedená u KS v Ústí nad Labem" },
  { key: "iban", label: "IBAN pro QR platby" },
  { key: "bic", label: "BIC / SWIFT" },
  { key: "bankName", label: "Banka" },
  { key: "accountNumber", label: "Číslo účtu", placeholder: "dopočítá se z českého IBAN" },
];

export function OperatorSettingsForm({ profile, labelSets }: { profile: OperatorProfile; labelSets: LabelSet[] }) {
  const router = useRouter();
  const [value, setValue] = useState(profile);
  const [sets, setSets] = useState<SetRow[]>(
    labelSets.map((set) => ({ title: set.title, description: set.description, priceExclVat: set.priceExclVat, ...Object.fromEntries(KINDS.map((kind) => [kind, set.items.find((item) => item.kind === kind)?.count ?? 0])) }) as SetRow),
  );
  const edit = (index: number, patch: Partial<SetRow>) => setSets((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const [saving, startSaving] = useTransition();

  function saveProfile() {
    startSaving(async () => {
      const result = await saveOperatorProfileAction(value);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Uloženo – patička: ${result.data.footer}`);
      router.refresh();
    });
  }

  function saveSets() {
    startSaving(async () => {
      const result = await saveLabelSetsAction(
        sets.map((set) => ({
          title: set.title,
          description: set.description,
          items: KINDS.map((kind) => ({ kind, count: Math.round(Number(set[kind]) || 0) })).filter((item) => item.count > 0),
          priceExclVat: Math.round(Number(set.priceExclVat)),
        })),
      );
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.data.count ? `Uloženo ${result.data.count} sad QR štítků – nabídka je v Dobít kredity / Tarify.` : "Objednávka sad QR štítků je vypnutá.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="operator-settings">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">🏢 Údaje provozovatele</h2>
        <p className="text-sm text-muted-foreground">
          Propíšou se do patičky webu, na zálohové faktury a výzvy k platbě (QR platba SPD), do obchodních podmínek a zásad zpracování osobních údajů. Náhled patičky: <b className="text-foreground">{footerLine(value)}</b>
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {field.label}
              <Input value={value[field.key]} placeholder={field.placeholder} maxLength={160} onChange={(event) => setValue((current) => ({ ...current, [field.key]: event.target.value }))} data-testid={`operator-${field.key}`} />
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-amber-400" checked={value.vatPayer} onChange={(event) => setValue((current) => ({ ...current, vatPayer: event.target.checked }))} data-testid="operator-vatPayer" />
            Plátce DPH (faktury s DPH 21 %) – nezaškrtnuto = neplátce DPH, cena bez DPH je konečná
          </label>
        </div>
        <Button type="button" className="w-fit gap-2" disabled={saving} onClick={saveProfile} data-testid="operator-save">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Uložit údaje provozovatele
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">🏷️ Sady QR štítků k objednání</h2>
        <p className="text-sm text-muted-foreground">
          Firmy je objednají v „Dobít kredity / Tarify“ s výzvou k platbě a QR platbou; po potvrzení úhrady vznikne série štítků v registru pro každý druh (spotřebič {LABEL_KINDS.A.size}, rozváděč {LABEL_KINDS.S.size}, stroj {LABEL_KINDS.M.size}) k vytištění a odeslání. Bez sad je objednávka vypnutá. Cena je bez DPH – u neplátce DPH konečná.
        </p>
        <ul className="flex flex-col gap-3">
          {sets.map((set, index) => (
            <li key={index} className="grid items-end gap-2 rounded-lg border border-border/70 p-2 lg:grid-cols-[1fr_1fr_5rem_5rem_5rem_7rem_auto]" data-testid="label-set-row">
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                Název sady
                <Input value={set.title} maxLength={120} onChange={(event) => edit(index, { title: event.target.value })} data-testid={`label-set-title-${index}`} />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                Popis (nepovinné)
                <Input value={set.description} maxLength={400} onChange={(event) => edit(index, { description: event.target.value })} data-testid={`label-set-description-${index}`} />
              </label>
              {KINDS.map((kind) => (
                <label key={kind} className="flex flex-col gap-0.5 text-xs text-muted-foreground" title={`${LABEL_KINDS[kind].label} ${LABEL_KINDS[kind].size} – ${LABEL_KINDS[kind].material}`}>
                  {LABEL_KINDS[kind].label} [ks]
                  <Input type="number" min={0} max={5000} value={set[kind]} onChange={(event) => edit(index, { [kind]: Number(event.target.value) })} data-testid={`label-set-${kind}-${index}`} />
                </label>
              ))}
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                Cena bez DPH [Kč]
                <Input type="number" min={1} value={set.priceExclVat} onChange={(event) => edit(index, { priceExclVat: Number(event.target.value) })} data-testid={`label-set-price-${index}`} />
              </label>
              <Button type="button" variant="ghost" size="icon" aria-label="Odebrat sadu" onClick={() => setSets((current) => current.filter((_, at) => at !== index))}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" disabled={sets.length >= 8} onClick={() => setSets((current) => [...current, { title: "Sada QR štítků ELDOCK", description: "", A: 50, S: 0, M: 0, priceExclVat: 0 }])} data-testid="label-set-add">
            <Plus className="size-4" aria-hidden /> Přidat sadu
          </Button>
          <Button type="button" className="gap-2" disabled={saving} onClick={saveSets} data-testid="label-sets-save">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Uložit sady štítků
          </Button>
        </div>
      </section>
    </div>
  );
}
