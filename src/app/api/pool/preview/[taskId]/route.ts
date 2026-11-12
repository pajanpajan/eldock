import { prisma } from "@/lib/prisma";
import { parseMarkup } from "@/lib/markup";
import { markupSvg } from "@/lib/redline-marketplace";
import { getPoolDesigner } from "@/server/pool-session";

/**
 * Fáze 103: náhled zákresu Červenky (jen vrstva tahů, bez schématu závodu) pro přihlášené projektanty poolu – u volného
 * úkolu všem schváleným, u přijatého jen tomu, kdo ho přijal.
 */
export async function GET(_request: Request, context: RouteContext<"/api/pool/preview/[taskId]">) {
  const designer = await getPoolDesigner();
  if (!designer) return new Response("Nepřihlášeno", { status: 401 });
  const { taskId } = await context.params;
  const task = await prisma.redlineTask.findUnique({ where: { id: taskId }, select: { mode: true, status: true, claimedById: true, changeRequest: { select: { number: true, markupData: true, equipment: { select: { tag: true } } } } } });
  if (!task || task.mode !== "POOL" || (task.status !== "OPEN" && task.claimedById !== designer.id)) return new Response("Nenalezeno", { status: 404 });
  const markup = parseMarkup(task.changeRequest.markupData);
  if (!markup) return new Response("Bez zákresu", { status: 404 });
  return new Response(markupSvg(markup, task.status === "OPEN" ? task.changeRequest.number : `${task.changeRequest.number} · ${task.changeRequest.equipment.tag}`), { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "private, no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}
