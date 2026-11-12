import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { authSecret, brandEnv, signAuthToken, verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Fáze 103: přihlášení externího projektanta ELDOCK Poolu do /portal-projektantu (e-mail + přístupový kód z velínu).
// Vlastní cookie i vlastní tajemství podpisu – token portálu nikdy neplatí jako přihlášení do závodu ani Panel Builderu.

export const POOL_COOKIE = "eldock-pool";
const POOL_SUBJECT = "pool:";
const POOL_TTL_SECONDS = 60 * 60 * 24 * 30;
const poolSecret = () => `${authSecret()}:pool`;
const secure = () => process.env.NODE_ENV === "production" && brandEnv("INSECURE_COOKIE") !== "1";

/** Přihlášený schválený projektant poolu (deaktivovaný = nepřihlášen). */
export const getPoolDesigner = cache(async () => {
  const session = await verifyAuthToken((await cookies()).get(POOL_COOKIE)?.value, { secret: poolSecret() });
  if (!session?.userId.startsWith(POOL_SUBJECT)) return null;
  const designer = await prisma.poolDesigner.findUnique({ where: { id: session.userId.slice(POOL_SUBJECT.length) }, select: { id: true, name: true, email: true, active: true } });
  return designer?.active ? designer : null;
});

export async function signInPoolDesigner(designerId: string) {
  (await cookies()).set(POOL_COOKIE, await signAuthToken(`${POOL_SUBJECT}${designerId}`, { ttl: POOL_TTL_SECONDS, secret: poolSecret() }), {
    path: "/",
    maxAge: POOL_TTL_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: secure(),
  });
}

export async function signOutPoolDesigner() {
  (await cookies()).delete(POOL_COOKIE);
}
