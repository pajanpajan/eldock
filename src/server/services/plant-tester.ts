// Testovací firma Správy závodů (2026-11-10): obecné přihlášení pro testy webu i aplikací Windows / iOS / Android –
// technický ředitel (zakladatel) a směnový údržbář se stejným heslem, závod s ukázkovou halou (rozváděče s QR štítky,
// linka, kompresor, spotřebič). Zakládá ji `npm run db:plant-tester` (entrypoint při každém startu kontejneru) stejnými
// funkcemi jako registrace firmy, správa podúčtů a Studio. Existující firmu nemění (hesla, zařízení ani úpravy z testů);
// zrušená a vymazaná firma vznikne při dalším startu znovu. Záměrně bez `server-only` (testy, skript).

import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_GRID } from "@/lib/cad-grid";
import { PLANT_TESTER } from "@/lib/registered-company";
import type { StudioDraft } from "@/lib/studio-draft";

import { hashPassword } from "../password";
import { createSubAccount } from "./accounts";
import { registerPlantCompany } from "./companies";
import { saveStudioBuilding } from "./studio";

/** Ukázková hala 54 × 30 m: hlavní rozváděč → rozváděč linky → lisovací linka, kompresor a kuchyňka s konvicí. */
export function plantTesterHall(plantId: string): StudioDraft {
  const floor = { kind: "draft", key: "1np" } as const;
  return {
    plantId,
    grid: { ...DEFAULT_GRID, cols: 10, rows: 6 },
    building: { mode: "new", code: "A", name: "Hala A - Lisovna", type: "PRODUCTION", map: { x: 10, y: 10, w: 24, h: 16 } },
    floors: [
      {
        key: "1np",
        level: 0,
        usage: "Lisovna",
        zones: [
          { key: "linka", x: 0, y: 0, w: 30, h: 18, name: "Lisovací linka", kind: "PRODUCTION" },
          { key: "kuchynka", x: 36, y: 18, w: 18, h: 12, name: "Kuchyňka", kind: "FACILITIES" },
        ],
        gates: [{ at: "C10", label: "Vrata" }],
      },
    ],
    equipment: [
      { key: "rh", floor, pos: { x: 48, y: 4 }, roomKey: null, tag: "RH1", name: "Hlavní rozváděč haly", type: "SWITCHBOARD", parent: null, circuit: null, zone: null, isRoot: true },
      { key: "rm", floor, pos: { x: 26, y: 4 }, roomKey: null, tag: "RM-L1", name: "Rozváděč lisovací linky", type: "SWITCHBOARD", parent: { kind: "draft", key: "rh" }, circuit: "QF3", zone: null, isRoot: false },
      { key: "linka", floor, pos: { x: 12, y: 9 }, roomKey: null, tag: "L1", name: "Lisovací linka", type: "PRODUCTION_LINE", parent: { kind: "draft", key: "rm" }, circuit: "Vývod FA1", zone: null, isRoot: false },
      { key: "kompresor", floor, pos: { x: 48, y: 12 }, roomKey: null, tag: "K1", name: "Šroubový kompresor", type: "COMPRESSOR", parent: { kind: "draft", key: "rh" }, circuit: "QF5", zone: null, isRoot: false },
      { key: "konvice", floor, pos: { x: 37, y: 19 }, roomKey: "kuchynka", tag: "SP-0001", name: "Rychlovarná konvice", type: "APPLIANCE", parent: { kind: "draft", key: "rh" }, circuit: "Zásuvkový okruh ZS1", zone: "Kuchyňka", isRoot: false },
    ],
  };
}

export type PlantTesterResult = { created: false } | { created: true; companyId: string; plantCode: string; users: number; equipment: number };

/** Založí testovací firmu, pokud ještě neexistuje (podle přihlašovacího e-mailu firmy). */
export async function ensurePlantTester(prisma: PrismaClient, now: Date = new Date()): Promise<PlantTesterResult> {
  if (await prisma.registeredCompany.findUnique({ where: { email: PLANT_TESTER.email }, select: { id: true } })) return { created: false };
  // Registrace firmy: firma, závod a technický ředitel v jedné transakci (stejně jako /register-plant)
  const { companyId, plant } = await registerPlantCompany(
    prisma,
    {
      // Smyšlené IČO se správnou kontrolní číslicí (stejné jako u firmy Tester Panel Builderu)
      ico: "12345679",
      dic: null,
      companyName: PLANT_TESTER.companyName,
      street: "Zkušební 1",
      city: "Liberec",
      zip: "460 01",
      contactName: "Ing. Tomáš Zkušební",
      phone: "+420 777 000 111",
      email: PLANT_TESTER.email,
      authorizationNumber: null,
      password: PLANT_TESTER.password,
      termsAccepted: true,
      plantName: PLANT_TESTER.plantName,
    },
    now,
  );
  // Fáze 113: testovací firma má ⭐ neomezený přístup (Hlídač revizí bez limitu zařízení pro testy aplikací)
  await prisma.registeredCompany.update({ where: { id: companyId }, data: { unlimitedAccess: true } });
  // Směnový údržbář jako podúčet firmy (jako ze správy podúčtů) s heslem rovnou nastaveným (místo pozvánky)
  const technician = await createSubAccount(prisma, {
    name: PLANT_TESTER.technician.name,
    email: PLANT_TESTER.technician.email,
    title: PLANT_TESTER.technician.title,
    accountType: "MAINTENANCE_TECH",
    owner: { companyId, homePlantId: plant.id },
  });
  await prisma.user.update({ where: { id: technician.id }, data: { passwordHash: await hashPassword(PLANT_TESTER.password), passwordChangedAt: now } });
  const hall = await saveStudioBuilding(prisma, plantTesterHall(plant.id));
  return { created: true, companyId, plantCode: plant.code, users: 2, equipment: hall.equipment };
}
