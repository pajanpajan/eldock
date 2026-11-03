import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PANEL_AUTH_COOKIE, companyIdOf, isAuthBypassed, verifyAuthToken } from "@/lib/auth";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { prisma } from "@/lib/prisma";

export const PANEL_AUTH_PATH = "/panel-builder/auth";

const companySelect = {
  id: true,
  productScope: true,
  ico: true,
  dic: true,
  companyName: true,
  street: true,
  city: true,
  zip: true,
  contactName: true,
  email: true,
  phone: true,
  authorizationNumber: true,
  creditsRemaining: true,
  plantId: true,
  termsVersion: true,
  termsAcceptedAt: true,
  logoUrl: true,
  stampUrl: true,
} as const;

/**
 * Přihlášená firma AI Panel Builderu (cookie `eldock-pb`), jen registrace do produktu PANEL_BUILDER.
 * Při `ELDOCK_BYPASS_AUTH=1` (lokální vývoj) je to demo firma Tester.
 */
export const getPanelCompany = cache(async () => {
  const id = isAuthBypassed() ? TESTER_COMPANY.id : companyIdOf(await verifyAuthToken((await cookies()).get(PANEL_AUTH_COOKIE)?.value));
  if (!id) return null;
  return prisma.registeredCompany.findFirst({ where: { id, productScope: "PANEL_BUILDER" }, select: companySelect });
});

export type PanelCompany = NonNullable<Awaited<ReturnType<typeof getPanelCompany>>>;

/** Stránka Panel Builderu: bez přihlášené firmy přesměruje na registraci / přihlášení. */
export async function requirePanelCompany(next?: string): Promise<PanelCompany> {
  const company = await getPanelCompany();
  if (!company) redirect(next ? `${PANEL_AUTH_PATH}?next=${encodeURIComponent(next)}` : PANEL_AUTH_PATH);
  return company;
}
