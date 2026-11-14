import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE, AUTH_TTL_SECONDS, PANEL_AUTH_COOKIE, PANEL_AUTH_TTL_SECONDS, brandEnv, panelSubject, sessionSubject, signAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANT_COOKIE } from "@/lib/roles";
import { requestMeta } from "@/server/request-meta";
import { createUserSession, recordSecurityEvent } from "@/server/services/account-security";

// Fáze 114: zahájení přihlášení v druhém produktu po SSO přemostění – stejné cookie a relace na serveru jako po
// přihlášení heslem (AI Panel Builder: cookie `eldock-pb`, Správa závodů: relace `UserSession` + `digitry-auth`).
// Záměrně mimo `"use server"` (klient to volat nemůže) – volají to jen Server Actions po kontrole přihlášení.

const secure = () => process.env.NODE_ENV === "production" && brandEnv("INSECURE_COOKIE") !== "1";

/** Přihlášení firmy AI Panel Builderu (cookie `eldock-pb`). */
export async function startPanelSession(companyId: string) {
  (await cookies()).set(PANEL_AUTH_COOKIE, await signAuthToken(panelSubject(companyId), { ttl: PANEL_AUTH_TTL_SECONDS }), {
    path: "/",
    maxAge: PANEL_AUTH_TTL_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: secure(),
  });
}

/** Relace uživatele Správy závodů / Hlídače revizí po SSO z AI Panel Builderu (deník přihlášení „SSO …“). */
export async function startPlantSession(user: { id: string; companyId: string | null; email: string | null }, plantId: string | null, detail: string) {
  const store = await cookies();
  const { device, ipKey } = await requestMeta();
  const now = new Date();
  const session = await createUserSession(prisma, user.id, device, now);
  store.set(AUTH_COOKIE, await signAuthToken(sessionSubject(user.id, session.id)), { path: "/", maxAge: AUTH_TTL_SECONDS, sameSite: "lax", httpOnly: true, secure: secure() });
  if (plantId) store.set(PLANT_COOKIE, plantId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
  await recordSecurityEvent(prisma, { kind: "LOGIN_OK", userId: user.id, companyId: user.companyId, email: user.email, ipKey, detail }, now);
}
