import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { authSecret, brandEnv, signAuthToken, verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Fáze 106: přihlášení zasmluvněného výrobce rozváděčů do portálu /vyroba-rozvadecu (e-mail + přístupový kód z velínu).
// Vlastní cookie i vlastní tajemství podpisu – token portálu nikdy neplatí jako přihlášení firmy ani závodu.

export const MANUFACTURER_COOKIE = "eldock-vyroba";
const SUBJECT = "vyroba:";
const TTL_SECONDS = 60 * 60 * 24 * 30;
const secret = () => `${authSecret()}:vyroba`;
const secure = () => process.env.NODE_ENV === "production" && brandEnv("INSECURE_COOKIE") !== "1";

/** Přihlášený aktivní výrobce (deaktivovaný = nepřihlášen). */
export const getManufacturer = cache(async () => {
  const session = await verifyAuthToken((await cookies()).get(MANUFACTURER_COOKIE)?.value, { secret: secret() });
  if (!session?.userId.startsWith(SUBJECT)) return null;
  const manufacturer = await prisma.panelManufacturer.findUnique({ where: { id: session.userId.slice(SUBJECT.length) }, select: { id: true, name: true, email: true, region: true, ico: true, phone: true, leadDays: true, active: true } });
  return manufacturer?.active ? manufacturer : null;
});

export async function signInManufacturer(manufacturerId: string) {
  (await cookies()).set(MANUFACTURER_COOKIE, await signAuthToken(`${SUBJECT}${manufacturerId}`, { ttl: TTL_SECONDS, secret: secret() }), { path: "/", maxAge: TTL_SECONDS, sameSite: "lax", httpOnly: true, secure: secure() });
}

export async function signOutManufacturer() {
  (await cookies()).delete(MANUFACTURER_COOKIE);
}
