import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { LinkAccountsButton, SsoBridgeButton } from "@/components/auth/SsoBridgeButton";
import { PricingOverview } from "@/components/credits/PricingOverview";
import { PageHeader } from "@/components/common/PageHeader";
import { HlidacWorkspace } from "@/components/hlidac/HlidacWorkspace";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { HLIDAC_MODES, HLIDAC_PALETTE } from "@/lib/hlidac";
import { bankLine, operatorSummary } from "@/lib/operator";
import { prisma } from "@/lib/prisma";
import { getPlants } from "@/server/queries/plant";
import { deviceEntitlementLabel } from "@/lib/credits";
import { getHlidacMode, hlidacOverview, plantDeviceEntitlement } from "@/server/services/hlidac";
import { getOperatorProfile } from "@/server/operator";
import { getPanelCompany } from "@/server/panel-session";
import { getAuthSession, getAuthState, getCurrentAccount, getRememberedPlantId } from "@/server/session";

export const metadata: Metadata = {
  title: "Hlídač revizí & Správa spotřebičů a zařízení",
  description: "Revize spotřebičů, monitorů, prodlužovaček, kuchyněk, nářadí i rozváděčů v kancelářích, školách, klinikách a výrobních závodech podle ČSN 33 1600 ed. 2 – AI čtečka výrobních štítků a identifikační štítky s QR kódem.",
  alternates: { canonical: "https://eldock.cz/hlidac-revizi" },
};

const FEATURES = [
  "Budova, patra a místnosti za pár vteřin – administrativa, kanceláře, školy, kliniky i výrobní haly a dílny",
  "Spotřebiče na 1 klik: monitory, počítače, prodlužovačky, tiskárny, kuchyňka, nářadí, rozváděče, nouzové osvětlení i stroje",
  "📷 AI čtečka výrobního štítku: název, výrobce, model, výrobní číslo S/N, napětí, příkon, krytí a třída ochrany",
  "Fotka štítku zůstane u zařízení v plném rozlišení pro revizního technika i inspektora",
  "Lhůty revizí podle ČSN 33 1600 ed. 2 (třída ochrany, skupina používání A–E) a ČSN 33 1500",
  "Identifikační štítek s QR kódem EL-xxxxxx pro Zebra ZD421t (30 × 15 / 50 × 25 mm) – 20 stejných monitorů pozná technik podle S/N",
];

// Fáze 111: samostatná sekce Hlídač revizí & Správa spotřebičů a zařízení (hlavní navigace, pravá větev úvodní stránky,
// průmyslová část). Bez přihlášení přehled a tarify, s přihlášením Správy závodů pracovní plocha.
export default async function HlidacRevisionsPage({ searchParams }: PageProps<"/hlidac-revizi">) {
  const session = await getAuthSession();
  // Fáze 113: ceník podle plátcovství provozovatele
  const operator = await getOperatorProfile();
  const { vatPayer } = operator;
  // Fáze 114: dodavatel a bankovní spojení v ceníku (jen vyplněné údaje)
  const supplier = `${operatorSummary(operator)} · ${bankLine(operator)}`;
  // Fáze 114: přihlášená firma AI Panel Builderu → „🔄 Pokračovat pod mým účtem z Panel Builderu“ (SSO přemostění)
  const panel = await getPanelCompany();
  if (!session) return <Intro vatPayer={vatPayer} supplier={supplier} panel={panel ? { name: panel.companyName, email: panel.email } : null} />;
  const [account, plants, remembered, query, state] = await Promise.all([getCurrentAccount(), getPlants(), getRememberedPlantId(), searchParams, getAuthState()]);
  // Fáze 114: po přemostění nový spárovaný účet (?sso=novy); přihlášený v obou produktech bez propojení → 🔗 Propojit účty
  const user = state.user;
  const linkable = panel && user?.companyId && user.accountType === "PLANT_ADMIN" ? (await prisma.registeredCompany.findUnique({ where: { id: user.companyId }, select: { linkedCompanyId: true } }))?.linkedCompanyId !== panel.id : false;
  const ssoNotice = (
    <>
      {query.sso === "novy" ? (
        <p role="status" className="mb-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" data-testid="sso-created">
          ✅ Účet Hlídače revizí a Správy budov je založený a spárovaný s AI Panel Builderem{user?.email ? ` (${user.email}, stejné heslo)` : ""} – příště stačí jedno přihlášení.
        </p>
      ) : null}
      {linkable && panel ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm" data-testid="sso-link-card">
          <span className="text-muted-foreground">Jste přihlášeni i v AI Panel Builderu jako {panel.companyName}.</span>
          <LinkAccountsButton panelName={panel.companyName} />
        </div>
      ) : null}
    </>
  );
  const wanted = typeof query.zavod === "string" ? query.zavod : null;
  const plant = plants.find((candidate) => candidate.id === wanted) ?? plants.find((candidate) => candidate.id === remembered) ?? plants[0] ?? null;
  if (!plant) return <Intro signedIn vatPayer={vatPayer} supplier={supplier} panel={null} />;
  const [overview, mode, entitlement] = await Promise.all([hlidacOverview(prisma, plant.id), getHlidacMode(prisma, plant.id), plantDeviceEntitlement(prisma, plant.id)]);
  const devices = overview.reduce((sum, building) => sum + building.floors.reduce((acc, floor) => acc + floor.rooms.reduce((count, room) => count + room.devices.length, 0) + floor.unassigned.length, 0), 0);
  return (
    <PageTransition>
      {ssoNotice}
      <PageHeader
        title="🛡️ Hlídač revizí & Správa spotřebičů a zařízení"
        description={`${plant.name} · ${overview.length} ${overview.length === 1 ? "budova" : overview.length < 5 ? "budovy" : "budov"} · ${devices} zařízení. Revize spotřebičů podle ČSN 33 1600 ed. 2 a ČSN 33 1500 – 📷 AI čtečka výrobního štítku a identifikační štítky s QR kódem.`}
      />
      {/* Fáze 113: limit zařízení podle tarifu závodu (zkušební limit, REVIZE & BUDOVY, PRŮMYSL & ENTERPRISE, ⭐ bez limitu) */}
      <p
        className={`mb-3 w-fit rounded-full border px-3 py-1 text-xs font-semibold ${!entitlement.unlimited && entitlement.limit !== null && entitlement.used >= entitlement.limit ? "border-amber-400/60 bg-amber-400/10 text-amber-200" : "border-border text-muted-foreground"}`}
        data-testid="hlidac-entitlement"
        data-reason={entitlement.reason}
      >
        {deviceEntitlementLabel(entitlement)}
        {entitlement.reason === "TRIAL" ? " · neomezená správa s tarifem REVIZE & BUDOVY (500) nebo PRŮMYSL & ENTERPRISE (5 000)" : ""}
      </p>
      <HlidacWorkspace
        plant={{ id: plant.id, name: plant.name }}
        plants={plants.map((candidate) => ({ id: candidate.id, name: candidate.name }))}
        mode={mode}
        overview={overview}
        canEdit={account.can("studio") || account.can("recordInspection") || account.can("submitChange")}
        canStructure={account.can("studio") || account.can("recordInspection")}
      />
    </PageTransition>
  );
}

function Intro({ signedIn = false, vatPayer, supplier, panel }: { signedIn?: boolean; vatPayer: boolean; supplier: string; panel: { name: string; email: string } | null }) {
  return (
    <PageTransition>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8" data-testid="hlidac-intro">
        <section className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">🛡️ Hlídač revizí & Správa spotřebičů a zařízení</h1>
          <p className="text-lg text-muted-foreground">
            Pro administrativní a kancelářské budovy, školy, úřady, kliniky i výrobní závody – monitory, počítače, prodlužovačky, rychlovarné konvice, mikrovlnky, kávovary, ruční nářadí i rozváděče pravidelně podle <b className="text-foreground">ČSN 33 1600 ed. 2</b> a <b className="text-foreground">ČSN 33 1500</b>.
          </p>
          {/* Fáze 114: SSO – bez druhé registrace pod účtem firmy z AI Panel Builderu */}
          {panel && !signedIn ? (
            <SsoBridgeButton direction="to-plant" next="/hlidac-revizi" label={`🔄 Pokračovat pod mým účtem z Panel Builderu (${panel.name} / ${panel.email})`} className="w-fit max-w-full" />
          ) : null}
          <div className="flex flex-wrap gap-3">
            {signedIn ? (
              <Button asChild className="touch-target">
                <Link href="/studio">Založit závod / budovu ve Studiu</Link>
              </Button>
            ) : (
              <>
                <Button asChild className="touch-target">
                  <Link href="/login?next=/hlidac-revizi">Přihlásit se do Hlídače revizí</Link>
                </Button>
                <Button asChild variant="outline" className="touch-target">
                  <Link href="/register-plant">Zaregistrovat budovu / závod</Link>
                </Button>
              </>
            )}
            <Button asChild variant="outline" className="touch-target">
              <Link href="/kontakt">Domluvit ukázku</Link>
            </Button>
          </div>
        </section>
        <section className="grid gap-3 md:grid-cols-2" aria-label="Režim objektu">
          {Object.values(HLIDAC_MODES).map((mode) => (
            <div key={mode.id} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-lg font-semibold">
                {mode.icon} {mode.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Místnosti např.: {mode.rooms.join(", ")} · skupina používání {mode.usageGroup}</p>
            </div>
          ))}
        </section>
        <ul className="grid gap-2 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {feature}
            </li>
          ))}
        </ul>
        <section className="flex flex-col gap-2" aria-label="Paleta spotřebičů">
          <h2 className="text-xl font-bold">Paleta spotřebičů na 1 klik</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {HLIDAC_PALETTE.map((group) => (
              <div key={group.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <p className="font-semibold">{group.title}</p>
                <p className="mt-1 text-muted-foreground">{group.items.map((item) => `${item.emoji} ${item.label}`).join(" · ")}</p>
              </div>
            ))}
          </div>
        </section>
        <PricingOverview audience="buildings" vatPayer={vatPayer} supplier={supplier} />
      </div>
    </PageTransition>
  );
}
