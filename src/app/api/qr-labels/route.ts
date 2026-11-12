import { prisma } from "@/lib/prisma";
import { qrUrl, serialCode } from "@/lib/qr-label-registry";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { createLabelBatch, labelBatches, type BatchInput } from "@/server/services/qr-labels";
import { isSuperadmin } from "@/server/superadmin-session";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Fáze 103: API registru QR štítků ELDOCK (jen velín): `GET /api/qr-labels` = poslední vydané číslo a série,
 * `POST /api/qr-labels` `{ companyName, ico?, email?, purpose: "APPLIANCE" | "SWITCHBOARD" | "MACHINE", count, note? }`
 * = nová série s globálně unikátními čísly EL-xxxxxx (atomické počítadlo, UNIQUE v databázi).
 */
export async function GET() {
  if (!(await isSuperadmin())) return json({ error: "Jen pro velín ELDOCK." }, 403);
  const [counter, batches] = await Promise.all([prisma.qrLabelCounter.findUnique({ where: { id: 1 } }), labelBatches(prisma, 500)]);
  return json({
    lastSequenceNumber: counter?.lastSequenceNumber ?? 0,
    batches: batches.map((batch) => ({ id: batch.id, from: batch.from, to: batch.to, count: batch.count, activated: batch.activated, companyName: batch.companyName, ico: batch.ico, purpose: batch.purpose, registeredCompanyId: batch.registeredCompanyId, createdAt: batch.createdAt, printedAt: batch.printedAt })),
  });
}

export async function POST(request: Request) {
  if (!(await isSuperadmin())) return json({ error: "Jen pro velín ELDOCK." }, 403);
  let body: Partial<BatchInput>;
  try {
    body = (await request.json()) as Partial<BatchInput>;
  } catch {
    return json({ error: "Tělo požadavku musí být JSON." }, 400);
  }
  try {
    const batch = await createLabelBatch(prisma, { companyName: String(body.companyName ?? ""), ico: body.ico ?? null, email: body.email ?? null, purpose: body.purpose as BatchInput["purpose"], count: Number(body.count), note: body.note ?? null });
    return json(
      {
        id: batch.id,
        from: batch.first,
        to: batch.last,
        count: batch.count,
        companyName: batch.companyName,
        registeredCompanyId: batch.registeredCompanyId,
        firstUrl: qrUrl(serialCode(batch.firstSequence)),
        printRoll: `/superadmin/qr-stitky/${batch.id}/tisk?format=roll`,
        printA4: `/superadmin/qr-stitky/${batch.id}/tisk?format=a4`,
        zpl: `/superadmin/qr-stitky/${batch.id}/zpl`,
      },
      201,
    );
  } catch (error) {
    if (error instanceof WorkflowError) return json({ error: error.message }, 400);
    if (error instanceof Error && error.message.startsWith("Série má")) return json({ error: error.message }, 400);
    console.error(error);
    return json({ error: "Sérii štítků se nepodařilo vytvořit." }, 500);
  }
}
