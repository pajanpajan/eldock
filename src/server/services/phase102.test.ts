import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { ARES_URL } from "@/lib/ares";
import { TESTER_COMPANY } from "@/lib/registered-company";

import { clearAresCache, lookupAres } from "./ares";
import { applyLeadBonus, captureLead, leadPrefill, leadRows } from "./leads";
import { allowTelemetry, recordTelemetry } from "./telemetry";
import { createTestDb } from "./test-db";

// Fáze 102 nad SQLite: telemetrie prvních stran, kontakt z trenažéru s doplněním z ARES (podle IČO), bonus 45 kreditů
// při registraci z odkazu a endpoint ARES s mezipamětí.

/** Zkrácená odpověď ARES (ekonomicke-subjekty/{ico}) – struktura podle veřejného REST API MF ČR. */
const ARES_FIXTURE = {
  ico: "27082440",
  obchodniJmeno: "Elektro Novák s.r.o.",
  dic: "CZ27082440",
  sidlo: { nazevObce: "Kolín", nazevCastiObce: "Kolín II", nazevUlice: "Havlíčkova", cisloDomovni: 12, cisloOrientacni: 3, psc: 28002 },
  czNace: ["43210", "4322", "71120", "47"],
};

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  clearAresCache();
});
afterEach(() => db.cleanup());

const aresFetch = (status = 200, body: unknown = ARES_FIXTURE) => vi.fn(async (url: string) => (String(url).startsWith(ARES_URL) ? new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }) : new Response("?", { status: 500 })));

describe("fáze 102 – ARES podle IČO", () => {
  it("doplní název, sídlo, DIČ a obory CZ-NACE; neplatné IČO se ani nedotazuje, výsledek drží mezipaměť", async () => {
    const fetcher = aresFetch();
    const result = await lookupAres("27082440", fetcher as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: true, company: { companyName: "Elektro Novák s.r.o.", dic: "CZ27082440", street: "Havlíčkova 12/3", city: "Kolín", zip: "280 02", segment: "electro" } });
    expect(fetcher).toHaveBeenCalledWith(`${ARES_URL}/27082440`, expect.anything());
    await lookupAres("27082440", fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await lookupAres("12345678", fetcher as unknown as typeof fetch)).toMatchObject({ ok: false, status: 400 });
    expect(await lookupAres("00006947", aresFetch(404) as unknown as typeof fetch)).toMatchObject({ ok: false, status: 404 });
    const down = vi.fn(async () => {
      throw new Error("síť");
    });
    expect(await lookupAres("25596641", down as unknown as typeof fetch)).toMatchObject({ ok: false, status: 503 });
  });

  it("GET /api/ares vrátí firemní údaje s obory a zaměřením", async () => {
    vi.stubGlobal("fetch", aresFetch());
    try {
      const { GET } = await import("@/app/api/ares/route");
      const response = await GET(new Request("http://localhost/api/ares?ico=27082440"));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ companyName: "Elektro Novák s.r.o.", ico: "27082440", dic: "CZ27082440", nace: ["43210", "4322", "71120", "47"], segment: "electro", segmentLabel: "Elektromontážní firma (CZ-NACE 43.21)" });
      expect((await GET(new Request("http://localhost/api/ares?ico=123"))).status).toBe(400);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("fáze 102 – telemetrie a kontakty", () => {
  it("událost bez IP a user-agentu, zdroj z UTM / odkazu, vlastnosti jako JSON; omezení četnosti", async () => {
    await recordTelemetry(prisma, { type: "page_view", path: "/", referrer: "https://search.seznam.cz", landing: true });
    await recordTelemetry(prisma, { type: "sandbox_started", path: "/panel-builder/floorplan", utm: { source: "linkedin", campaign: "pilot" }, props: { sandbox: "2D Půdorys 4+kk" } });
    const rows = await prisma.telemetryEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => [row.type, row.source, row.referrerHost, row.landing])).toEqual([
      ["page_view", "seznam", "search.seznam.cz", true],
      ["sandbox_started", "linkedin", null, false],
    ]);
    expect(JSON.parse(rows[1].props)).toEqual({ sandbox: "2D Půdorys 4+kk" });
    expect(Object.keys(rows[0])).not.toContain("ip");
    const key = `test-${Date.now()}`;
    expect(Array.from({ length: 121 }, () => allowTelemetry(key, 1000)).filter(Boolean)).toHaveLength(120);
    expect(allowTelemetry(key, 1000 + 61_000)).toBe(true);
  });

  it("kontakt z trenažéru: ARES doplní firmu, opakované zachycení kontakt aktualizuje; souhlas s novinkami se neztratí", async () => {
    const context = { kind: "floorplan", trigger: "xlsx", summary: "2D půdorys RD 4+kk: 17 okruhů, 622 m kabelu", circuits: 17, cableM: 622 } as const;
    const first = await captureLead(prisma, { email: "Jan@Firma.cz", ico: "27082440", role: "installer", marketing: true, context, source: { referrer: "https://www.google.com" } }, { fetcher: aresFetch() as unknown as typeof fetch });
    expect(first.company).toMatchObject({ companyName: "Elektro Novák s.r.o.", segmentLabel: "Elektromontážní firma (CZ-NACE 43.21)" });
    await captureLead(prisma, { email: "jan@firma.cz", role: "installer", marketing: false, context: { ...context, trigger: "pdf" } }, { fetcher: aresFetch() as unknown as typeof fetch });
    const rows = await leadRows(prisma);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "jan@firma.cz", ico: "27082440", companyName: "Elektro Novák s.r.o.", nace: ["43210", "4322", "71120", "47"], source: "google", marketingConsent: true, trigger: "pdf", circuits: 17 });
    expect((await prisma.lead.findUniqueOrThrow({ where: { email: "jan@firma.cz" } })).captures).toBe(2);
    expect(await prisma.telemetryEvent.count({ where: { type: "lead_captured" } })).toBe(2);
    await expect(captureLead(prisma, { email: "x", role: "installer", marketing: false, context })).rejects.toThrow();
  });

  it("registrace z odkazu kontaktu: předvyplnění a propojení jen jednou (fáze 111: 1 testovací projekt místo 45 kreditů)", async () => {
    const { token } = await captureLead(prisma, { email: "petr@projekce.cz", role: "designer", marketing: false, context: { kind: "panel", trigger: "pdf", summary: "Rozváděč RH1" } });
    expect(await leadPrefill(prisma, token)).toMatchObject({ email: "petr@projekce.cz" });
    const company = await prisma.registeredCompany.create({
      data: { productScope: "PANEL_BUILDER", ico: "27082440", companyName: "Projekce Petr", street: "Ulice 1", city: "Praha", zip: "110 00", contactName: "Petr", email: "petr@projekce.cz", phone: "+420 777 000 000", passwordHash: "x", termsAcceptedAt: new Date() },
    });
    expect(company).toMatchObject({ creditsRemaining: 0, trialFloorplanUsed: false, trialSwitchboardUsed: false });
    expect(await applyLeadBonus(prisma, token, company.id)).toBe(true);
    expect((await prisma.registeredCompany.findUniqueOrThrow({ where: { id: company.id } })).creditsRemaining).toBe(0);
    expect((await prisma.lead.findFirstOrThrow({ where: { token } })).registeredCompanyId).toBe(company.id);
    expect(await applyLeadBonus(prisma, token, company.id)).toBe(false);
    expect(await leadPrefill(prisma, token)).toBeNull();
    expect(await applyLeadBonus(prisma, "neplatny", company.id)).toBe(false);
    expect(TESTER_COMPANY.id).toBe("company-tester");
  });
});
