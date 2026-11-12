"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ROUTINE_TEST_POINTS } from "@/lib/legislation-2027";
import type { FactoryTestInput } from "@/lib/panel-builder/turnkey-manufacturing";
import { acceptManufacturingOrderAction, completeManufacturingOrderAction, recordFactoryTestAction, signInManufacturerAction, signOutManufacturerAction } from "@/server/actions/manufacturing";

/** Přihlášení výrobce (e-mail + přístupový kód z velínu ELDOCK). */
export function ManufacturerLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex max-w-md flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await signInManufacturerAction(email, code);
          if (!result.ok) return void toast.error(result.error);
          toast.success(`Přihlášeno – ${result.data.name}.`);
          router.refresh();
        });
      }}
      data-testid="manufacturer-login"
    >
      <h2 className="font-semibold">Přihlášení zasmluvněného výrobce</h2>
      <label className="flex flex-col gap-0.5">
        E-mail
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2" autoComplete="username" data-testid="manufacturer-email" />
      </label>
      <label className="flex flex-col gap-0.5">
        Přístupový kód z velínu ELDOCK
        <input value={code} onChange={(event) => setCode(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 font-mono uppercase" autoComplete="one-time-code" data-testid="manufacturer-code" />
      </label>
      <Button type="submit" disabled={pending} data-testid="manufacturer-signin">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Přihlásit
      </Button>
      <p className="text-xs text-muted-foreground">Chcete vyrábět rozváděče na klíč z ELDOCKu? Napište nám přes formulář Kontakt & Spolupráce.</p>
    </form>
  );
}

export function ManufacturerLogoutButton({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <button type="button" className="touch-target flex items-center gap-1 rounded-lg border border-border px-3 text-muted-foreground hover:text-foreground" onClick={() => void signOutManufacturerAction().then(() => router.refresh())}>
      {children}
    </button>
  );
}

/** Krok 1: ✅ Přijmout zakázku do výroby (cena a termín). */
export function AcceptOrderForm({ orderId, suggestedPrice, suggestedDays }: { orderId: string; suggestedPrice: number; suggestedDays: number }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(suggestedPrice));
  const [days, setDays] = useState(String(suggestedDays));
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2 text-sm" data-testid="accept-order">
      <label className="flex flex-col gap-0.5">
        Cena výroby na klíč [Kč bez DPH]
        <input type="number" min={1} value={price} onChange={(event) => setPrice(event.target.value)} className="h-9 w-40 rounded-md border border-input bg-transparent px-2" data-testid="accept-price" />
      </label>
      <label className="flex flex-col gap-0.5">
        Termín dodání [prac. dnů]
        <input type="number" min={1} max={120} value={days} onChange={(event) => setDays(event.target.value)} className="h-9 w-28 rounded-md border border-input bg-transparent px-2" data-testid="accept-days" />
      </label>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await acceptManufacturingOrderAction(orderId, Number(price), Number(days));
            if (!result.ok) return void toast.error(result.error);
            toast.success(`Zakázka ${result.data.number} je vaše – stáhněte výrobní balíček.`);
            router.refresh();
          })
        }
        data-testid="accept-submit"
      >
        ✅ Přijmout zakázku do výroby
      </Button>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Krok 2: výstupní kusová zkouška výrobce dle ČSN EN IEC 61439-1 ed. 3. */
export function FactoryTestForm({ orderId, initial }: { orderId: string; initial: Partial<FactoryTestInput> | null }) {
  const router = useRouter();
  const [form, setForm] = useState({ testerName: initial?.testerName ?? "", enclosureSerial: initial?.enclosureSerial ?? "", measuredAt: initial?.measuredAt ?? today(), insulationMOhm: String(initial?.insulationMOhm ?? ""), peContinuityOhm: String(initial?.peContinuityOhm ?? ""), rcdTripCurrentMa: String(initial?.rcdTripCurrentMa ?? ""), rcdTripTimeMs: String(initial?.rcdTripTimeMs ?? ""), note: initial?.note ?? "" });
  const [flags, setFlags] = useState({ torqueOk: initial?.torqueOk ?? false, wiringOk: initial?.wiringOk ?? false, ip: initial?.checks?.ip ?? false, clearances: initial?.checks?.clearances ?? false, devices: initial?.checks?.devices ?? false, circuits: initial?.checks?.circuits ?? false, terminals: initial?.checks?.terminals ?? false });
  const [pending, start] = useTransition();
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label className="flex flex-col gap-0.5">
      {label}
      <input type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="h-9 rounded-md border border-input bg-transparent px-2" data-testid={`test-${key}`} />
    </label>
  );
  const pointLabel = (id: string) => ROUTINE_TEST_POINTS.find((point) => point.id === id)?.label ?? id;
  return (
    <form
      className="flex flex-col gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const optional = (value: string) => (value.trim() ? Number(value.replace(",", ".")) : undefined);
        start(async () => {
          const result = await recordFactoryTestAction(orderId, {
            testerName: form.testerName,
            enclosureSerial: form.enclosureSerial,
            measuredAt: form.measuredAt,
            insulationMOhm: Number(form.insulationMOhm.replace(",", ".")),
            peContinuityOhm: Number(form.peContinuityOhm.replace(",", ".")),
            rcdTripCurrentMa: optional(form.rcdTripCurrentMa),
            rcdTripTimeMs: optional(form.rcdTripTimeMs),
            torqueOk: flags.torqueOk,
            wiringOk: flags.wiringOk,
            checks: { ip: flags.ip, clearances: flags.clearances, devices: flags.devices, circuits: flags.circuits, terminals: flags.terminals },
            note: form.note || undefined,
          });
          if (!result.ok) return void toast.error(result.error);
          if (result.data.issues.length) toast.warning(`Uloženo, ale nevyhovuje: ${result.data.issues.join(" ")}`);
          else toast.success("Kusová zkouška vyhovuje – můžete dokončit výrobu a uzamknout Verzi 1.0.");
          router.refresh();
        });
      }}
      data-testid="factory-test"
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {field("testerName", "Zkoušku provedl (jméno)")}
        {field("enclosureSerial", "Výrobní číslo skříně")}
        {field("measuredAt", "Datum zkoušky", "date")}
        {field("insulationMOhm", "Izolační odpor R_iso [MΩ] (500 V DC)")}
        {field("peContinuityOhm", "Spojitost PE [Ω]")}
        {field("rcdTripCurrentMa", "RCD – vybavovací proud [mA]")}
        {field("rcdTripTimeMs", "RCD – vybavovací čas [ms]")}
      </div>
      <fieldset className="grid gap-1 rounded-lg border border-border p-2 text-xs sm:grid-cols-2">
        <legend className="px-1 font-semibold">Body kusové zkoušky (ČSN EN IEC 61439-1 ed. 3, čl. 11) – vyhovuje</legend>
        {(["ip", "clearances", "devices", "circuits", "terminals"] as const).map((key) => (
          <label key={key} className="flex items-center gap-1.5">
            <input type="checkbox" checked={flags[key]} onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })} data-testid={`test-check-${key}`} />
            {pointLabel(key)}
          </label>
        ))}
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={flags.torqueOk} onChange={(event) => setFlags({ ...flags, torqueOk: event.target.checked })} data-testid="test-torque" />
          Utahovací momenty svorek zkontrolovány
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={flags.wiringOk} onChange={(event) => setFlags({ ...flags, wiringOk: event.target.checked })} data-testid="test-wiring" />
          Zapojení podle drátovacího listu zkontrolováno
        </label>
      </fieldset>
      <Button type="submit" disabled={pending} className="w-fit" data-testid="factory-test-save">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} 🧪 Uložit výstupní kusovou zkoušku
      </Button>
    </form>
  );
}

/** Krok 3: 🔒 Dokončit výrobu, uzamknout Verzi 1.0 pod QR štítkem a expedovat. */
export function CompleteOrderButton({ orderId, serial }: { orderId: string; serial: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      className="w-fit bg-emerald-600 hover:bg-emerald-500"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await completeManufacturingOrderAction(orderId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(`Hotovo – dokumentace uzamčena jako Verze ${result.data.version} pod štítkem ${result.data.serial}.`);
          router.refresh();
        })
      }
      data-testid="complete-order"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} 🔒 Dokončit výrobu, uzamknout Verzi 1.0 pod QR štítkem {serial} a expedovat
    </Button>
  );
}
