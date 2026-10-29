import { expect, type Page } from "@playwright/test";

export type Role = "MAINTENANCE" | "CAE_ENGINEER";

/** Výchozí účet workflow role (seed `prisma/seed-accounts.ts`). */
const ROLE_ACCOUNT: Record<Role, string> = {
  MAINTENANCE: "Karel Novotný",
  CAE_ENGINEER: "Ing. Tomáš Krejčí",
};

/** Přepne účet přepínačem v hlavičce (stejně jako v demu) a počká, až hlavička ukáže nový účet. */
export async function switchAccount(page: Page, name: string) {
  const trigger = page.getByRole("button", { name: /^Účet: / });
  if ((await trigger.getAttribute("aria-label"))?.startsWith(`Účet: ${name} `)) return;
  await trigger.click();
  await page.getByRole("menuitem", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} – `) }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^Účet: ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} – `) })).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

/** Starší přepínač pohledu Údržba / CAE → výchozí účet role. */
export async function switchRole(page: Page, role: Role) {
  await switchAccount(page, ROLE_ACCOUNT[role]);
}

/** Nastaví roli cookie ještě před první navigací (výchozí účet role). */
export async function startAs(page: Page, role: Role) {
  await page.context().addCookies([{ name: "digitry-role", value: role, url: "http://localhost:3200" }]);
}

/** Nastaví konkrétní účet (id uživatele ze seedu) ještě před první navigací. */
export async function startAsAccount(page: Page, userId: string) {
  await page.context().addCookies([{ name: "digitry-account", value: userId, url: "http://localhost:3200" }]);
}

export const toast = (page: Page) => page.locator("[data-sonner-toast]").first();

export const pin = (page: Page, tag: string) => page.locator("button.pin-button", { hasText: tag });
