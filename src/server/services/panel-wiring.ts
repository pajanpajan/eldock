import type { PrismaClient } from "@/generated/prisma/client";
import { HIDDEN_MANUFACTURER_NAMES } from "@/lib/panel-builder/brands";
import { normalizeSearch } from "@/lib/panel-builder/catalog";
import { WIRING_CATEGORIES } from "@/lib/panel-builder/wiring-devices";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Fáze 47: domovní přístroje (vypínače, zásuvky, rámečky) přiřazené k obvodu rozváděče a ventilátory
// skříně. Business logika nad Prismou; Server Actions jen ověří přístup a volají tyto funkce.

export interface WiringHit {
  id: string;
  articleNumber: string;
  manufacturer: string;
  series: string;
  category: string;
  categoryLabel: string;
  title: string;
  color: string | null;
}

/** Hledání v katalogu domovní instalace (bez diakritiky, všechna slova). */
export async function searchWiringDevices(prisma: PrismaClient, query: string, limit = 20): Promise<WiringHit[]> {
  const words = normalizeSearch(query).split(/\s+/).filter((word) => word.length >= 2).slice(0, 6);
  if (!words.length) return [];
  const rows = await prisma.wiringDevice.findMany({
    where: { AND: words.map((word) => ({ searchText: { contains: word } })), manufacturer: { notIn: [...HIDDEN_MANUFACTURER_NAMES] } },
    orderBy: [{ series: "asc" }, { title: "asc" }],
    take: Math.min(Math.max(limit, 1), 50),
  });
  return rows.map((row) => ({
    id: row.id,
    articleNumber: row.articleNumber,
    manufacturer: row.manufacturer,
    series: row.series,
    category: row.category,
    categoryLabel: WIRING_CATEGORIES[row.category] ?? WIRING_CATEGORIES.WD_OTHER,
    title: row.title,
    color: row.color,
  }));
}

const cleanRoom = (room: string | null | undefined) => room?.trim().slice(0, 80) || null;

/** Přiřadí přístroj k obvodu (stejný přístroj ve stejné místnosti = navýšení počtu). */
export async function addItemWiring(prisma: PrismaClient, itemId: string, input: { wiringDeviceId: string; quantity: number; room?: string | null }) {
  const quantity = Math.round(input.quantity);
  if (quantity < 1 || quantity > 200) throw new WorkflowError("VALIDATION", "Počet kusů musí být 1–200.");
  const device = await prisma.wiringDevice.findUnique({ where: { id: input.wiringDeviceId }, select: { id: true } });
  if (!device) throw new WorkflowError("NOT_FOUND", "Přístroj domovní instalace nebyl nalezen.");
  const room = cleanRoom(input.room);
  // SQLite bere NULL v unikátním indexu jako různé hodnoty – existující řádek hledáme ručně
  const existing = await prisma.panelItemWiring.findFirst({ where: { itemId, wiringDeviceId: device.id, room } });
  if (existing) return prisma.panelItemWiring.update({ where: { id: existing.id }, data: { quantity: Math.min(200, existing.quantity + quantity) } });
  return prisma.panelItemWiring.create({ data: { itemId, wiringDeviceId: device.id, quantity, room } });
}

/** Změna počtu (0 = odebrat). */
export async function setItemWiringQuantity(prisma: PrismaClient, itemId: string, wiringId: string, quantity: number) {
  const row = await prisma.panelItemWiring.findFirst({ where: { id: wiringId, itemId } });
  if (!row) throw new WorkflowError("NOT_FOUND", "Přiřazený přístroj nebyl nalezen.");
  if (quantity <= 0) {
    await prisma.panelItemWiring.delete({ where: { id: row.id } });
    return null;
  }
  return prisma.panelItemWiring.update({ where: { id: row.id }, data: { quantity: Math.min(200, Math.round(quantity)) } });
}

/** Ventilátor skříně (null = bez ventilátoru) a počet kusů. */
export async function setProjectFan(prisma: PrismaClient, projectId: string, fanId: string | null, count = 1) {
  const fanCount = Math.round(count);
  if (fanCount < 1 || fanCount > 6) throw new WorkflowError("VALIDATION", "Počet ventilátorů musí být 1–6.");
  if (fanId && !(await prisma.enclosureFan.count({ where: { id: fanId } }))) throw new WorkflowError("NOT_FOUND", "Ventilátor nebyl nalezen.");
  return prisma.panelBoardProject.update({ where: { id: projectId }, data: { fanId, fanCount }, select: { fanId: true, fanCount: true } });
}
