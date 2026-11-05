import { prisma } from "@/lib/prisma";
import { audienceLabel } from "@/lib/newsletter";
import { isSuperadmin } from "@/server/superadmin-session";

const csvCell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Fáze 56: export potvrzených odběratelů (CSV, středník, UTF-8 s BOM pro Excel) – jen pro velín. */
export async function GET() {
  if (!(await isSuperadmin())) return new Response("Nenalezeno", { status: 404 });
  const rows = await prisma.newsletterSubscriber.findMany({ where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "asc" }, select: { email: true, audience: true, confirmedAt: true, consentVersion: true, source: true } });
  const lines = [["email", "profese", "potvrzeno", "verze_souhlasu", "zdroj"].join(";"), ...rows.map((row) => [row.email, audienceLabel(row.audience), row.confirmedAt?.toISOString() ?? "", row.consentVersion, row.source].map(csvCell).join(";"))];
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="eldock-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}
