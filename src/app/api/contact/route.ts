import { after } from "next/server";

import { prisma } from "@/lib/prisma";
import { handleContactGet, handleContactPatch, handleContactPost } from "@/server/contact-intake";
import { isSuperadmin } from "@/server/superadmin-session";

/**
 * Fáze 107: kontaktní a zpětnovazební hub.
 * - `POST /api/contact` (veřejné, limit 10 zpráv / min / IP v proxy): zpráva v 7 kategoriích, až 3 printscreeny
 *   (multipart `payload` + `images`) a technická diagnostika → číslo tiketu `#EL-1042`; notifikace majiteli po odpovědi.
 * - `GET /api/contact?filter=bugs` a `PATCH /api/contact` (jen velín): přehled, stav, interní poznámka, přečteno.
 */
export async function POST(request: Request) {
  return handleContactPost(request, {
    prisma,
    senderCompany: async () => (await import("@/server/panel-session")).getPanelCompany(),
    aiFeedback: async (companyId, projectId, message) => (await import("@/server/services/credits")).createAiFeedback(prisma, companyId, projectId, message),
    schedule: (task) => after(task),
  });
}

export async function GET(request: Request) {
  return handleContactGet(request, { prisma, isSuperadmin });
}

export async function PATCH(request: Request) {
  return handleContactPatch(request, { prisma, isSuperadmin });
}
