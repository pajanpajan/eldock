"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCog, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuildingType, EquipmentType, InstallationKind } from "@/generated/prisma/enums";
import { BUILDING_TYPE_LABELS, formatCount, formatDateShort } from "@/lib/format";
import { computeValidUntil } from "@/lib/inspection";
import {
  INSTALLATION_KIND_LABELS,
  USAGE_GROUP_LABELS,
  inspectionRuleFor,
  intervalIssue,
  lpsCriticalReasons,
  ruleKindOf,
  type UsageGroup,
} from "@/lib/inspection-rules";
import { cn } from "@/lib/utils";
import { updateInspectionSettingsAction } from "@/server/actions/inspection";

const SELECT = "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30";
const MONTHS = ["měsíc", "měsíce", "měsíců"] as const;
const KINDS = Object.keys(INSTALLATION_KIND_LABELS) as InstallationKind[];

export interface InspectionSettings {
  externalInfluences: string | null;
  installationKind: InstallationKind;
  lpsCritical: boolean;
  preventiveMaintenance: boolean;
  usageGroup: string | null;
  protectionClass: string | null;
  handHeld: boolean;
  intervalMonths: number;
}

interface Props {
  equipmentId: string;
  tag: string;
  type: EquipmentType;
  building: { name: string; type: BuildingType; crowdOver200: boolean };
  settings: InspectionSettings;
  /** Rozhodující revize `YYYY-MM-DD` – náhled zkrácení platnosti na zákonnou lhůtu. */
  governing: { inspectionDate: string; validUntil: string } | null;
}

/** Fáze 66: podklady pro nejdelší lhůtu revize (NV 190/2022 Sb., příloha č. 4; ČSN 33 1600 ed. 2) a lhůta zařízení. */
export function InspectionSettingsDialog({ equipmentId, tag, type, building, settings, governing }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [influences, setInfluences] = useState(settings.externalInfluences ?? "");
  const [installationKind, setInstallationKind] = useState(settings.installationKind);
  const [lpsCritical, setLpsCritical] = useState(settings.lpsCritical);
  const [preventiveMaintenance, setPreventiveMaintenance] = useState(settings.preventiveMaintenance);
  const [usageGroup, setUsageGroup] = useState(settings.usageGroup ?? "C");
  const [protectionClass, setProtectionClass] = useState(settings.protectionClass ?? "I");
  const [handHeld, setHandHeld] = useState(settings.handHeld);
  const [crowdOver200, setCrowdOver200] = useState(building.crowdOver200);
  const kind = ruleKindOf(type);
  const rule = inspectionRuleFor({
    type,
    externalInfluences: influences,
    installationKind,
    lpsCritical,
    preventiveMaintenance,
    usageGroup,
    protectionClass,
    handHeld,
    buildingType: building.type,
    crowdOver200,
  });
  const initialRule = inspectionRuleFor({ type, ...settings, buildingType: building.type, crowdOver200: building.crowdOver200 });
  // null = lhůta podle předpisu (sleduje změny podkladů); číslo = vlastní lhůta zařízení
  const [customMonths, setCustomMonths] = useState<number | null>(settings.intervalMonths === initialRule.months ? null : settings.intervalMonths);
  const months = customMonths ?? rule.months;
  const issue = intervalIssue(months, rule);
  const blocked = !Number.isInteger(months) || months < 1 || months > 120 || issue?.level === "error";
  const capPreview =
    governing && rule.binding && new Date(`${governing.validUntil}T10:00:00Z`).getTime() > computeValidUntil(new Date(`${governing.inspectionDate}T10:00:00Z`), rule.maxMonths).getTime()
      ? formatDateShort(computeValidUntil(new Date(`${governing.inspectionDate}T10:00:00Z`), rule.maxMonths))
      : null;
  const autoCritical = lpsCriticalReasons({ buildingType: building.type, crowdOver200, externalInfluences: influences });

  function save() {
    if (blocked) return;
    startTransition(async () => {
      const response = await updateInspectionSettingsAction({
        equipmentId,
        intervalMonths: months,
        externalInfluences: influences.trim() || null,
        ...(kind === "VTZ" ? { installationKind, preventiveMaintenance } : {}),
        ...(kind === "LPS" ? { lpsCritical } : {}),
        ...(kind === "VTZ" || kind === "LPS" ? { crowdOver200 } : {}),
        ...(kind === "APPLIANCE" ? { usageGroup: usageGroup as UsageGroup, protectionClass: protectionClass as "I" | "II" | "III", handHeld } : {}),
        ...(kind === "WELDER" ? { protectionClass: protectionClass as "I" | "II" | "III" } : {}),
      });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      const capped = response.data.cappedRecords ? ` · zkrácená platnost revizí: ${response.data.cappedRecords}` : "";
      toast.success(`Lhůta revize ${tag}: ${formatCount(response.data.intervalMonths, MONTHS)}.`, { description: `${rule.standard}${capped}${response.data.warning ? ` · ${response.data.warning}` : ""}` });
      setOpen(false);
      router.refresh();
    });
  }

  const check = (id: string, checked: boolean, onChange: (value: boolean) => void, label: React.ReactNode) => (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <Label htmlFor={id} className="block text-sm leading-snug font-normal">
        {label}
      </Label>
    </div>
  );

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)} data-testid="inspection-settings-open">
        <CalendarCog className="size-4" aria-hidden />
        Upravit lhůtu
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Lhůta pravidelné revize – {tag}</DialogTitle>
            <DialogDescription>Podklady pro nejdelší lhůtu podle {rule.standard}. U VTZ a hromosvodů je lhůta právně závazná – delší nejde uložit.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {kind === "VTZ" || kind === "LPS" ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm">
                  Objekt: <span className="font-semibold">{building.name}</span> – {BUILDING_TYPE_LABELS[building.type].toLowerCase()}
                  <span className="block text-xs text-muted-foreground">Účel objektu (administrativa 5 let, výroba 3 roky) se mění u budovy ve Studiu.</span>
                </p>
                {check(
                  "settings-crowd",
                  crowdOver200,
                  setCrowdOver200,
                  <>
                    Objekt podle požárně bezpečnostního řešení umožňuje přítomnost více než 200 osob (2 roky)
                    <span className="block text-xs text-muted-foreground">Platí pro celou budovu – zkrátí lhůty a platnosti revizí všech jejích VTZ.</span>
                  </>,
                )}
              </div>
            ) : null}

            {kind === "VTZ" ? (
              <div className="space-y-2">
                <Label id="settings-kind-label">Provedení</Label>
                <div role="radiogroup" aria-labelledby="settings-kind-label" className="grid gap-2 sm:grid-cols-3">
                  {KINDS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={installationKind === value}
                      onClick={() => setInstallationKind(value)}
                      className={cn("rounded-lg border px-3 py-2 text-left text-sm", installationKind === value ? "border-primary bg-primary/15" : "border-border bg-card hover:bg-muted/50")}
                    >
                      {INSTALLATION_KIND_LABELS[value]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {kind === "VTZ" || kind === "LPS" ? (
              <div className="space-y-1">
                <Label htmlFor="settings-influences">Vnější vlivy (z protokolu)</Label>
                <Input id="settings-influences" value={influences} onChange={(event) => setInfluences(event.target.value)} maxLength={300} placeholder="AA5, AB5, AD1, AE2, BE1 – prostory normální" className="h-11" />
                <p className="text-xs text-muted-foreground">
                  Mokrý prostor = AD4 a vyšší, trvale korozivní nebo znečišťující látky = AF4 (1 rok); nebezpečí požáru nebo výbuchu = BE2 / BE3 (3 roky). Je-li podle protokolu mokrý i prostor s AD3, zkraťte lhůtu ručně.
                </p>
              </div>
            ) : null}

            {kind === "LPS"
              ? check(
                  "settings-lps-critical",
                  lpsCritical,
                  setLpsCritical,
                  <>
                    LPS chrání kritické systémy – citlivé vnitřní systémy, VTZ I. třídy nebo objekt, kde úder blesku či přepětí způsobí škodu velkého rozsahu (2 roky)
                    {autoCritical.length ? <span className="block text-xs text-amber-200">Automaticky kritické: {autoCritical.join(", ")}.</span> : null}
                  </>,
                )
              : null}

            {kind === "VTZ"
              ? check(
                  "settings-maintenance",
                  preventiveMaintenance,
                  setPreventiveMaintenance,
                  <>
                    Lhůtu stanoví řád preventivní údržby provozovatele – až dvojnásobná (příloha č. 4, pozn. c)
                    <span className="block text-xs text-muted-foreground">Jen s platným řádem preventivní údržby (pravidelné kontroly a údržba minimalizující rizika).</span>
                  </>,
                )
              : null}

            {kind === "APPLIANCE" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="settings-group">Skupina užívání (ČSN 33 1600 ed. 2)</Label>
                  <select id="settings-group" value={usageGroup} onChange={(event) => setUsageGroup(event.target.value)} className={SELECT}>
                    {(Object.keys(USAGE_GROUP_LABELS) as UsageGroup[]).map((value) => (
                      <option key={value} value={value}>
                        {USAGE_GROUP_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settings-class">Třída ochrany</Label>
                  <select id="settings-class" value={protectionClass} onChange={(event) => setProtectionClass(event.target.value)} className={SELECT}>
                    <option value="I">Třída I</option>
                    <option value="II">Třída II</option>
                    <option value="III">Třída III</option>
                  </select>
                </div>
                {type === "APPLIANCE" ? <div className="flex items-end pb-2">{check("settings-hand", handHeld, setHandHeld, "Spotřebič držený v ruce")}</div> : null}
              </div>
            ) : null}

            <div className="space-y-2 rounded-lg border border-border p-3" data-testid="settings-rule">
              <p className="text-sm">
                Nejdelší lhůta: <span className="font-semibold">{formatCount(rule.maxMonths, MONTHS)}</span> · {rule.standard}
              </p>
              <p className="text-xs text-muted-foreground">{rule.basis}</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="settings-months">Lhůta zařízení (měsíce)</Label>
                  <Input
                    id="settings-months"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={rule.binding ? rule.maxMonths : 120}
                    value={months}
                    onChange={(event) => setCustomMonths(event.target.value === "" ? 0 : Number(event.target.value))}
                    className="h-11 w-32"
                    aria-invalid={issue?.level === "error" || undefined}
                  />
                </div>
                {customMonths !== null ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCustomMonths(null)}>
                    Podle předpisu ({formatCount(rule.months, MONTHS)})
                  </Button>
                ) : null}
              </div>
              {issue ? <p className={cn("text-sm", issue.level === "error" ? "text-red-300" : "text-amber-200")}>{issue.message}</p> : null}
              {capPreview ? <p className="text-sm text-amber-200">Platnost poslední revize se zkrátí na {capPreview} (nejdelší zákonná lhůta od data revize).</p> : null}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="touch-target">
                Zrušit
              </Button>
            </DialogClose>
            <Button className="touch-target gap-2" onClick={save} disabled={pending || blocked}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarCog className="size-4" />}
              Uložit lhůtu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
