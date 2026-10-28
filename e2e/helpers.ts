import { expect, type Page } from "@playwright/test";

export type Role = "MAINTENANCE" | "CAE_ENGINEER";

const ROLE_LABEL: Record<Role, RegExp> = {
  MAINTENANCE: /Údržba v hale/,
  CAE_ENGINEER: /CAE Projektant/,
};

/** Přepne pohled přepínačem v hlavičce (stejně jako v demu) a počká na přesměrování. */
export async function switchRole(page: Page, role: Role) {
  const radio = page.getByRole("radio", { name: ROLE_LABEL[role] });
  if ((await radio.getAttribute("aria-checked")) === "true") return;
  const before = page.url();
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
  await page.waitForURL((url) => url.toString() !== before || url.pathname === "/cae", { timeout: 20_000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
}

/** Nastaví roli cookie ještě před první navigací. */
export async function startAs(page: Page, role: Role) {
  await page.context().addCookies([{ name: "digitry-role", value: role, url: "http://localhost:3200" }]);
}

export const toast = (page: Page) => page.locator("[data-sonner-toast]").first();

export const pin = (page: Page, tag: string) => page.locator("button.pin-button", { hasText: tag });
