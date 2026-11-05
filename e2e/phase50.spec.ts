import { expect, test } from "@playwright/test";

// Fáze 50: objednávka kreditů s QR platbou a zálohovou fakturou, hlášení chyby AI z projektu a velín
// /superadmin (přihlášení, potvrzení úhrady s připsáním kreditů, vyřešení hlášení).
test.describe.configure({ mode: "serial" });

const credits = async (page: import("@playwright/test").Page) => Number(/Kredity: (\d+)/.exec((await page.getByTestId("panel-credits").textContent()) ?? "")?.[1] ?? NaN);

test("🪙 objednávka kredity → QR platba + zálohová faktura, 🐛 hlášení chyby AI, velín potvrdí úhradu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  const before = await credits(page);

  // Kredity v liště = tlačítko na dobití
  await page.getByTestId("panel-credits").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dobít kredity pro AI Panel Builder", { timeout: 60_000 });
  await page.locator('[data-package="START_10"]').getByRole("button", { name: /Objednat balíček/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Objednávka VS \d{8}/, { timeout: 60_000 });
  const vs = /VS (\d{8})/.exec((await page.getByRole("heading", { level: 1 }).textContent()) ?? "")?.[1] ?? "";
  await expect(page.getByTestId("payment-qr")).toHaveAttribute("data-spd", new RegExp(`^SPD\\*1\\.0\\*ACC:CZ\\d+\\*AM:1198\\.00\\*CC:CZK\\*X-VS:${vs}\\*MSG:ELDOCK Kredity`));
  await expect(page.getByTestId("payment-details")).toContainText("1 198 Kč");
  const orderUrl = page.url();
  await page.goto(`${orderUrl}/invoice`);
  await expect(page.getByTestId("invoice")).toContainText(`č. ${vs}`, { timeout: 60_000 });
  await expect(page.getByTestId("invoice-customer")).toContainText("Elektro Tester s.r.o.");
  await expect(page.getByTestId("invoice-total")).toHaveText("1 198 Kč");

  // 🐛 Nahlásit chybu AI ve vzorovém projektu
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByTestId("report-ai-error").click();
  await page.getByLabel("Popis chyby").fill("E2E: špatně rozpoznaný stykač na 2. liště");
  await page.getByRole("button", { name: "Odeslat hlášení" }).click();
  await expect(page.getByText("Děkujeme! Hlášení jsme přijali")).toBeVisible({ timeout: 30_000 });

  // Velín bez přihlášení → login; heslo (lokálně přístupové heslo) → přehled
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
  await page.getByLabel("Heslo velínu").fill("spatne");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByText("Nesprávné heslo velínu.")).toBeVisible();
  await page.getByLabel("Heslo velínu").fill("eldock2026");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
  await expect(page.getByTestId("superadmin-kpi")).toContainText("Čekající objednávky");
  await expect(page.getByTestId("company-12345679")).toContainText("Elektro Tester s.r.o.");

  // Objednávky → ✅ potvrdit úhradu a připsat kredity
  await page.getByRole("link", { name: "Objednávky kreditů a fakturace" }).click();
  await page.getByTestId(`confirm-${vs}`).click();
  await expect(page.getByTestId(`order-${vs}`)).toContainText("Uhrazeno", { timeout: 30_000 });

  // Hlášení chyb AI → ✓ vyřešeno
  await page.getByRole("link", { name: "Hlášení chyb AI a fotky" }).click();
  const report = page.getByTestId("superadmin-feedback").locator("li", { hasText: "E2E: špatně rozpoznaný stykač" }).first();
  await expect(report).toHaveAttribute("data-status", "OPEN");
  await report.getByTestId("resolve-feedback").click();
  await expect(page.getByTestId("superadmin-feedback").locator("li", { hasText: "E2E: špatně rozpoznaný stykač" }).first()).toHaveAttribute("data-status", "RESOLVED", { timeout: 30_000 });

  // Kredity firmy po úhradě +10
  await page.goto("/panel-builder");
  await expect(page.getByTestId("panel-credits")).toContainText(`Kredity: ${before + 10}`);
});
