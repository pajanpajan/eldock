import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { getPoolDesigner } from "@/server/pool-session";
import { taskPackage } from "@/server/services/redlines";

/**
 * Fáze 103: balíček podkladů úkolu ELDOCK Poolu jedním klikem (ZIP: platné schéma, vrstva Červenky, fotky, zadání) –
 * jen pro projektanta, který úkol přijal.
 */
export async function GET(_request: Request, context: RouteContext<"/api/pool/package/[taskId]">) {
  const designer = await getPoolDesigner();
  if (!designer) return Response.json({ error: "Přihlaste se do portálu projektantů." }, { status: 401 });
  const { taskId } = await context.params;
  try {
    const { fileName, bytes } = await taskPackage(prisma, taskId, designer.id);
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${fileName}"`, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof WorkflowError) return Response.json({ error: error.message }, { status: 403 });
    console.error(error);
    return Response.json({ error: "Balíček podkladů se nepodařilo připravit." }, { status: 500 });
  }
}
