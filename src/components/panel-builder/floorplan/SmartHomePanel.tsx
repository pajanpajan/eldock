"use client";

import { AlertTriangle, Cpu, FileText } from "lucide-react";

import { CHANNEL_ROLES, ROLE_LABEL, SMART_SYSTEMS, type SmartPlan, type SmartSystemId } from "@/lib/panel-builder/smart-home";
import { productOfModule } from "@/lib/panel-builder/smart-catalog";
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "../ManufacturerLogo";
import { PanelSection } from "./RightPanels";

const ROLE_ICON: Record<string, string> = { switch: "💡", dim: "🔆", dali: "🎛️", blind: "🪟", heating: "🌡️", pwm: "🌈", input: "🧲" };

/** „1 kanál“, „3 kanály“, „5 kanálů“. */
const channelWord = (count: number) => (count === 1 ? "kanál" : count >= 2 && count <= 4 ? "kanály" : "kanálů");

/**
 * Fáze 61: chytrá domácnost na sběrnicové úrovni instalace – volba systému a výrobce, potřebné kanály podle zátěží
 * v půdorysu (spínání, stmívání, DALI, žaluzie, topení; fáze 77 i 24 V PWM a binární vstupy), vybrané akční členy s objednacími čísly a šířkou na DIN
 * liště, kontrola sběrnice a přiřazení kanálů. Moduly se při generování vloží do rozváděče.
 */
export function SmartHomePanel({ plan, onSystem, onDatasheet }: { plan: SmartPlan; onSystem: (system: SmartSystemId) => void; /** Fáze 65: technický list modulu. */ onDatasheet?: (moduleId: string) => void }) {
  // Fáze 77: i kanály 24 V PWM (LED pásky, CCT, RGBW) a binární vstupy (okenní kontakty, čidla vody)
  const roles = CHANNEL_ROLES.filter((role) => plan.channels[role].needed > 0);
  const actuators = plan.modules.filter((module) => module.modules > 0);
  const offRail = plan.modules.filter((module) => module.modules === 0);
  const busOk = !plan.psuMa || plan.busMa <= plan.psuMa * 0.8;
  return (
    // Fáze 76: sbalovací karta pravého sloupce
    <PanelSection id="smart" title="Chytrá domácnost – akční členy" ariaLabel="Chytrá domácnost" testId="smart-home" className="border-2 border-emerald-500/40" icon={<Cpu className="size-4 text-emerald-300" aria-hidden />}>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Systém chytré domácnosti">
        {SMART_SYSTEMS.map((system) => (
          <button
            key={system.id}
            type="button"
            role="radio"
            aria-checked={plan.system.id === system.id}
            onClick={() => onSystem(system.id)}
            className={cn("flex items-center gap-2 rounded-lg border p-1.5 text-left text-xs", plan.system.id === system.id ? "border-emerald-400 bg-emerald-500/10" : "border-border hover:border-emerald-400/60")}
            data-testid={`smart-system-${system.id}`}
          >
            <span className="flex h-7 w-14 shrink-0 items-center justify-center rounded bg-white p-0.5">
              <ManufacturerLogo manufacturer={system.manufacturer} className="h-5 w-full" />
            </span>
            <span className="min-w-0">
              <b className="block">{system.label}</b>
              {plan.system.id === system.id ? <span className="text-muted-foreground">{system.description}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {roles.length ? (
        <ul className="grid grid-cols-2 gap-1 text-xs" data-testid="smart-channels">
          {roles.map((role) => (
            <li key={role} className="rounded-md border border-border px-2 py-1" data-role={role}>
              {ROLE_ICON[role]} {ROLE_LABEL[role]}: <b>{plan.channels[role].needed}</b> {channelWord(plan.channels[role].needed)}
              <span className="block text-[10px] text-muted-foreground">k dispozici {plan.channels[role].available} (s rezervou)</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Vložte svítidla, motory žaluzií, čidla nebo hlavice – kanály akčních členů se spočítají samy.</p>
      )}
      {plan.ledSupplyW > 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="smart-led-supply">
          🔌 Zdroj 24 V DC pro LED: příkon pásků a svítidel PWM s rezervou 20 % = <b>{plan.ledSupplyW} W</b>
        </p>
      ) : null}
      {actuators.length ? (
        <table className="w-full text-xs" data-testid="smart-modules">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-medium">Přístroj</th>
              <th className="text-left font-medium">Obj. číslo</th>
              <th className="text-right font-medium">Šířka</th>
            </tr>
          </thead>
          <tbody>
            {actuators.map((module) => (
              <tr key={`${module.id}-${module.index}`} className="border-t border-border" data-module={module.typeCode}>
                <td className="py-0.5 pr-1">
                  {/* Fáze 77: obecný modul (PWM, vstupy) a zdroj LED nemají technický list výrobce systému */}
                  {onDatasheet && productOfModule(plan.system.id, module.id) ? (
                    <button type="button" onClick={() => onDatasheet(module.id)} className="mr-1 inline-flex align-middle text-muted-foreground hover:text-foreground" aria-label={`Datasheet: ${module.typeCode}`} title="Technický list" data-testid="module-datasheet">
                      <FileText className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                  {module.typeCode}
                  {module.manual ? <span className="ml-1 rounded border border-sky-400/60 px-1 text-[10px] text-sky-200">ručně</span> : null}
                  <span className="block text-[10px] text-muted-foreground">
                    {module.label}
                    {module.channels && module.role !== "psu" && module.role !== "interface" ? ` · obsazeno ${module.assigned.length}/${module.channels}` : ""}
                  </span>
                </td>
                <td className={cn("font-mono text-[10px]", module.verified ? "" : "text-amber-200")}>{module.articleNumber ? `${module.articleNumber}${module.verified ? "" : " (ověřte)"}` : "doplnit"}</td>
                <td className="text-right font-mono tabular-nums">{module.modules} M</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {offRail.length ? <p className="text-[11px] text-muted-foreground">Mimo DIN lištu: {offRail.map((module) => `${module.typeCode} (${module.articleNumber ?? "–"})`).join(", ")} – nástěnná montáž nebo adaptér na lištu.</p> : null}
      <p className={cn("text-xs", busOk ? "text-emerald-300" : "text-amber-200")} data-testid="smart-bus">
        Sběrnice: {plan.busDevices} {plan.busDevices === 1 ? "prvek" : plan.busDevices >= 2 && plan.busDevices <= 4 ? "prvky" : "prvků"}{plan.psuMa ? ` · odběr ~${plan.busMa} mA ze ${plan.psuMa} mA zdroje` : ""} · na DIN lištu {plan.widthModules} M
      </p>
      {plan.warnings.map((warning) => (
        <p key={warning} className="flex gap-1.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {warning}
        </p>
      ))}
      {actuators.some((module) => module.assigned.length) ? (
        <details className="text-xs" data-testid="smart-allocation">
          <summary className="cursor-pointer text-muted-foreground">Přiřazení kanálů ({actuators.reduce((sum, module) => sum + module.assigned.length, 0)})</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {actuators.flatMap((module) =>
              module.assigned.map((slot) => (
                <li key={`${module.id}-${module.index}-${slot.channel}`} className="flex justify-between gap-2">
                  <span className="font-mono">
                    {module.typeCode} #{module.index} · K{slot.channel}
                  </span>
                  <span className="truncate text-right">
                    {slot.load.label} – {slot.load.room}
                    {slot.load.powerW ? ` (${slot.load.powerW} W)` : ""}
                  </span>
                </li>
              )),
            )}
          </ul>
        </details>
      ) : null}
    </PanelSection>
  );
}
