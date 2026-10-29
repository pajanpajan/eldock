import { expect, test } from "@playwright/test";

// Bez přihlašovací cookie ze `storageState` – test prochází bránou jako nový návštěvník.
test.use({ storageState: { cookies: [], origins: [] } });

test("bez přihlášení vede stránka na /login, API vrací 401; přihlášení a odhlášení (Zamknout)", async ({ page }) => {
  await page.goto("/equipment/eq-rm1");
  await expect(page).toHaveURL(/\/login\?next=%2Fequipment%2Feq-rm1/);
  await expect(page.getByRole("heading", { name: "Přihlášení do Eldock" })).toBeVisible();
  expect((await page.request.get("/api/files/seed/neexistuje.svg")).status()).toBe(401);

  // Výběr až po hydrataci (studený dev server)
  await expect(async () => {
    await page.locator("label", { hasText: "Petr Svoboda" }).click();
    await expect(page.getByRole("radio", { name: /^Petr Svoboda – / })).toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByLabel("Heslo / PIN").fill("spatne-heslo");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page.getByText("Nesprávné heslo / PIN.")).toBeVisible();

  await page.getByLabel("Heslo / PIN").fill("eldock2026");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/equipment\/eq-rm1$/);
  await expect(page.getByRole("button", { name: /^Účet: Petr Svoboda – / })).toBeVisible();

  await page.getByRole("button", { name: "Odhlásit (Zamknout)" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/cae");
  await expect(page).toHaveURL(/\/login\?next=%2Fcae/);

  // Přihlášení e-mailem
  await page.getByLabel("nebo e-mail").fill("tomas.krejci@eldock.cz");
  await page.getByLabel("Heslo / PIN").fill("eldock2026");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/cae$/);
  await expect(page.getByRole("button", { name: /^Účet: Ing\. Tomáš Krejčí – / })).toBeVisible();
});
