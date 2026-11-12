import { prisma } from "@/lib/prisma";
import { batchZpl, serialCode } from "@/lib/qr-label-registry";
import { isSuperadmin } from "@/server/superadmin-session";

/**
 * Fáze 103: kód ZPL II celé série pro Zebra ZD421t (300 DPI) – rychlý tisk čistého QR kódu (`^BQ`, korekce H) se
 * sériovým číslem; štítek s logem ELDOCK uprostřed QR kódu se tiskne z PDF 1:1 (stránka tisku série).
 */
export async function GET(_request: Request, context: RouteContext<"/superadmin/qr-stitky/[batchId]/zpl">) {
  if (!(await isSuperadmin())) return new Response("Nenalezeno", { status: 404 });
  const { batchId } = await context.params;
  const batch = await prisma.qrLabelBatch.findUnique({ where: { id: batchId } });
  if (!batch) return new Response("Nenalezeno", { status: 404 });
  const codes = Array.from({ length: batch.lastSequence - batch.firstSequence + 1 }, (_, index) => serialCode(batch.firstSequence + index));
  return new Response(batchZpl(codes, batch.purpose, batch.companyName), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="eldock-${codes[0]}-${codes[codes.length - 1]}.zpl"`,
      "cache-control": "no-store",
    },
  });
}
