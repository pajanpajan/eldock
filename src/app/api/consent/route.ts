import { z } from "zod";

import { brandEnv } from "@/lib/auth";
import { isGa4Id } from "@/lib/consent";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  version: z.number().int().min(1).max(1000),
  analytics: z.boolean(),
  marketing: z.boolean(),
  source: z.enum(["banner", "settings"]),
});

/**
 * Fáze 56: záznam volby souhlasu s cookies (prokázání souhlasu, čl. 7 odst. 1 GDPR). Ukládá jen náhodné id
 * z cookie, verzi, volbu a čas – žádnou IP adresu ani vazbu na účet. Veřejné (bez přihlášení).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Neplatný požadavek." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Neplatný záznam souhlasu." }, { status: 400 });
  const { id, ...choice } = parsed.data;
  await prisma.consentRecord.create({ data: { consentId: id, ...choice } });
  return Response.json({ ok: true }, { status: 201 });
}

/** Konfigurace volitelných služeb za běhu serveru (statické stránky by si ID z buildu „zapekly“). */
export async function GET() {
  const ga4 = brandEnv("GA4_ID")?.trim() ?? "";
  return Response.json({ ga4Id: isGa4Id(ga4) ? ga4 : null }, { headers: { "Cache-Control": "public, max-age=300" } });
}
