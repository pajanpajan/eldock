"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { PLANT_COOKIE, ROLE_COOKIE, roleSchema } from "@/lib/roles";
import { getRememberedPlantId } from "@/server/session";

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  httpOnly: true,
} as const;

/**
 * Přepne pohled. Z aktuální cesty si zapamatuje závod (`/plant/<id>/…`),
 * aby se Údržba po návratu z CAE vrátila tam, kde byla.
 */
export async function setRole(role: string, pathname: string) {
  const parsed = roleSchema.parse(role);
  const store = await cookies();
  store.set(ROLE_COOKIE, parsed, COOKIE_OPTIONS);

  const fromPath = /^\/plant\/([^/]+)/.exec(pathname)?.[1];
  if (fromPath && (await prisma.plant.count({ where: { id: fromPath } })) > 0) {
    store.set(PLANT_COOKIE, fromPath, COOKIE_OPTIONS);
  }

  revalidatePath("/", "layout");

  if (parsed === "CAE_ENGINEER") redirect("/cae");
  const plantId =
    fromPath ??
    (await getRememberedPlantId()) ??
    (await prisma.plant.findFirstOrThrow({ orderBy: { code: "asc" } })).id;
  redirect(`/plant/${plantId}`);
}
