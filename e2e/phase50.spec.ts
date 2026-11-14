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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dobít kredity / Tarify", { timeout: 60_000 });
  // Fáze 111: nový ceník – Balíček START 30 kreditů za 750 Kč; fáze 113: provozovatel je neplátce DPH (cena je konečná)
  await page.locator('[data-package="START_30"]').getByRole("button", { name: /Objednat balíček/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Objednávka VS \d{8}/, { timeout: 60_000 });
  const vs = /VS (\d{8})/.exec((await page.getByRole("heading", { level: 1 }).textContent()) ?? "")?.[1] ?? "";
  // Fáze 84: QR platba na účet Eldock u Raiffeisenbank a.s. (SPD 1.0 – ACC:IBAN+BIC)
  await expect(page.getByTestId("payment-qr")).toHaveAttribute("data-spd", new RegExp(`^SPD\\*1\\.0\\*ACC:CZ1755000000000918118002\\+RZBCCZPP\\*AM:750\\.00\\*CC:CZK\\*X-VS:${vs}\\*MSG:ELDOCK Kredity`));
  const payment = page.getByTestId("payment-details");
  await expect(payment).toContainText("750 Kč");
  await expect(payment.getByTestId("bank-name")).toHaveText("Raiffeisenbank a.s.");
  await expect(payment.getByTestId("bank-account")).toHaveText("918118002/5500");
  await expect(payment.getByTestId("bank-iban")).toHaveText("CZ17 5500 0000 0009 1811 8002");
  await expect(payment.getByTestId("bank-bic")).toHaveText("RZBCCZPP");
  await expect(payment.getByTestId("bank-vs")).toHaveText(vs);
  const orderUrl = page.url();
  await page.goto(`${orderUrl}/invoice`);
  await expect(page.getByTestId("invoice")).toContainText(`č. ${vs}`, { timeout: 60_000 });
  await expect(page.getByTestId("invoice-customer")).toContainText("Elektro Tester s.r.o.");
  await expect(page.getByTestId("invoice-total")).toHaveText("750 Kč");
  const invoicePayment = page.getByTestId("invoice-payment");
  for (const text of ["Raiffeisenbank a.s.", "918118002/5500", "CZ17 5500 0000 0009 1811 8002", "RZBCCZPP", vs]) await expect(invoicePayment).toContainText(text);
  await expect(page.getByTestId("invoice").getByTestId("payment-qr")).toHaveAttribute("data-spd", /ACC:CZ1755000000000918118002\+RZBCCZPP\*AM:750\.00/);

  // 🐛 Nahlásit chybu AI ve vzorovém projektu
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  // Fáze 107: tlačítko otevře kontaktní modal s kategorií „Hlášení chyby“ a ID projektu (hlášení jde i do „Hlášení chyb AI“)
  await page.getByTestId("report-ai-error").click();
  const contact = page.getByTestId("contact-modal");
  await expect(contact.getByTestId("contact-form")).toHaveAttribute("data-category", "BUG", { timeout: 30_000 });
  await contact.getByTestId("contact-message").fill("E2E: špatně rozpoznaný stykač na 2. liště");
  await contact.getByTestId("contact-submit").click();
  await expect(contact.getByTestId("contact-ticket")).toContainText("#EL-", { timeout: 30_000 });
  await page.keyboard.press("Escape");

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
  // Stejné IČO může mít víc registrací (obě služby, testy registrace fáze 41 / 67 / 68, fáze 114: spárovaný účet Správy
  // závodů ze SSO) – řádek firmy Tester AI Panel Builderu podle názvu a služby
  await expect(page.getByTestId("company-12345679").filter({ hasText: "Elektro Tester s.r.o." }).filter({ hasText: "AI Panel Builder" })).toHaveCount(1);

  // Objednávky → ✅ potvrdit úhradu a připsat kredity
  await page.getByRole("link", { name: "Objednávky kreditů a fakturace" }).click();
  // Fáze 84: velín ukazuje účet, na který chodí úhrady kreditů
  await expect(page.getByTestId("superadmin-bank")).toContainText("918118002/5500");
  await expect(page.getByTestId("superadmin-bank")).toContainText("CZ17 5500 0000 0009 1811 8002");
  await page.getByTestId(`confirm-${vs}`).click();
  await expect(page.getByTestId(`order-${vs}`)).toContainText("Uhrazeno", { timeout: 30_000 });

  // Hlášení chyb AI → ✓ vyřešeno
  await page.getByRole("link", { name: "Hlášení chyb AI a fotky" }).click();
  const report = page.getByTestId("superadmin-feedback").locator("li", { hasText: "E2E: špatně rozpoznaný stykač" }).first();
  await expect(report).toHaveAttribute("data-status", "OPEN");
  await report.getByTestId("resolve-feedback").click();
  await expect(page.getByTestId("superadmin-feedback").locator("li", { hasText: "E2E: špatně rozpoznaný stykač" }).first()).toHaveAttribute("data-status", "RESOLVED", { timeout: 30_000 });

  // Kredity firmy po úhradě +30
  await page.goto("/panel-builder");
  await expect(page.getByTestId("panel-credits")).toContainText(`Kredity: ${before + 30}`);
});
