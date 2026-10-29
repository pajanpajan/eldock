"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AUTH_COOKIE, AUTH_TTL_SECONDS, brandEnv, checkAccessPassword, safeNextPath, signAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { setAccount } from "./session";

export interface LoginState {
  error?: string;
  email?: string;
  accountId?: string;
}

const loginSchema = z.object({
  accountId: z.string().max(64).optional(),
  email: z.string().trim().max(200).optional(),
  password: z.string().max(200),
  next: z.string().max(500).optional(),
});

/** Přihlášení: účet (výběr nebo e-mail) + přístupové heslo / PIN → podepsaná cookie a přepnutí účtu. */
export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const input = loginSchema.parse({
    accountId: formData.get("accountId") || undefined,
    email: formData.get("email") || undefined,
    password: formData.get("password") ?? "",
    next: formData.get("next") || undefined,
  });
  const echo = { email: input.email, accountId: input.accountId };
  const user = input.email
    ? await prisma.user.findFirst({ where: { email: input.email.toLowerCase(), accountType: { not: null } } })
    : input.accountId
      ? await prisma.user.findFirst({ where: { id: input.accountId, accountType: { not: null } } })
      : null;
  if (!user) return { ...echo, error: input.email ? "Účet s tímto e-mailem neexistuje." : "Vyberte účet nebo zadejte e-mail." };
  if (!(await checkAccessPassword(input.password))) return { ...echo, error: "Nesprávné heslo / PIN." };

  const store = await cookies();
  store.set(AUTH_COOKIE, await signAuthToken(user.id), {
    path: "/",
    maxAge: AUTH_TTL_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && brandEnv("INSECURE_COOKIE") !== "1",
  });
  await setAccount(user.id, "/", safeNextPath(input.next));
  return {};
}

/** Odhlásit (Zamknout): zruší přihlašovací cookie, účet a závod zůstávají zapamatované. */
export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
