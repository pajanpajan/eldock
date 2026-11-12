import { leadsCsv } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { leadRows } from "@/server/services/leads";
import { isSuperadmin } from "@/server/superadmin-session";

/**
 * Fáze 102: export zachycených kontaktů a firem (CSV, středník, UTF-8 s BOM pro Excel) – jen pro velín. Sloupec
 * `souhlas_obchodni_sdeleni`: e-mailem oslovovat jen kontakty se souhlasem (§ 7 zákona č. 480/2004 Sb.).
 */
export async function GET() {
  if (!(await isSuperadmin())) return new Response("Nenalezeno", { status: 404 });
  const rows = await leadRows(prisma, 5000);
  return new Response(leadsCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="eldock-kontakty-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}
