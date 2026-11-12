import { createHmac } from "node:crypto";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { toast } from "./helpers";
import { PUBLIC_STATE } from "./auth";

// Fáze 67: účty zaměstnanců registrované firmy – pozvánka a vlastní heslo, limit pokusů, dvoufázové ověření,
// blokace zaměstnance (zrušení relace) a obrana proti podvržené cookie přepínače účtů.
test.use({ storageState: PUBLIC_STATE });
test.describe.configure({ mode: "serial" });

const OWNER = { name: "Ing. Jana Ředitelová", email: "jana@kovovyroba-tabor.example", password: "Kovovyroba-Tabor-2026" };
const EMPLOYEE = { name: "Tomáš Údržbář", email: "tomas@kovovyroba-tabor.example", password: "Zelena-zahrada-v-lete" };
let inviteLink = "";
let employeeId = "";
let totpSecret = "";
let recoveryCode = "";

/** TOTP (RFC 6238) pro test – stejný výpočet jako aplikace Authenticator. */
function totp(secret: string, time = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("nebo e-mail").fill(email);
  await page.getByLabel("Heslo / PIN").fill(password);
  await page.getByRole("button", { name: /Přihlásit/ }).click();
}

/** Chybová hláška formuláře (ne oznamovač tras Next.js, který má také role=alert). */
const loginAlert = (page: Page) => page.locator("form [role=alert]");

async function freshPage(browser: Browser) {
  const context = await browser.newContext({ storageState: PUBLIC_STATE });
  return context.newPage();
}

test("registrace firmy → pozvánka zaměstnance → vlastní heslo z odkazu → Můj účet", async ({ page, browser }) => {
  await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: "12345679", companyName: "Kovovýroba Tábor s.r.o.", dic: "CZ12345679", street: "Chýnovská 12", city: "Tábor", zip: "390 02" } }));
  await page.goto("/register-plant");
  await page.getByLabel("IČO").fill("12345679");
  await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Kovovýroba Tábor s.r.o.");
  await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(OWNER.name);
  await page.getByLabel("Telefon").fill("+420 777 123 456");
  await page.getByLabel("Název prvního závodu").fill("Závod Tábor – Kovovýroba");
  await page.getByLabel("E-mail (přihlášení)").fill(OWNER.email);
  await page.getByLabel("Heslo (min. 10 znaků)").fill(OWNER.password);
  await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
  await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
  await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Můj účet/ })).toBeVisible();

  // Správce firmy založí zaměstnance – pozvánka s odkazem (bez SMTP se zkopíruje z aplikace)
  await page.goto("/admin/users");
  await page.getByLabel("Jméno a příjmení").fill(EMPLOYEE.name);
  await page.getByLabel("E-mail", { exact: true }).fill(EMPLOYEE.email);
  await page.getByRole("button", { name: "Založit podúčet" }).click();
  await expect(toast(page)).toContainText(`Podúčet ${EMPLOYEE.name} založen.`);
  const notice = page.getByTestId("password-link");
  await expect(notice).toContainText(`Pozvánka pro ${EMPLOYEE.email}`);
  inviteLink = await page.getByTestId("password-link-url").inputValue();
  expect(inviteLink).toMatch(/\/nastavit-heslo\/[\w-]{40,}$/);
  const row = page.getByTestId(`account-row-${EMPLOYEE.email}`);
  await expect(row.getByTestId("account-status")).toContainText("Čeká na nastavení hesla");
  employeeId = (await row.locator("[data-testid^='account-actions-']").getAttribute("data-testid"))!.replace("account-actions-", "");

  // Zaměstnanec v jiném prohlížeči nastaví heslo z odkazu a je rovnou přihlášený
  const employee = await freshPage(browser);
  await employee.goto(new URL(inviteLink).pathname);
  await expect(employee.getByRole("heading", { level: 1 })).toHaveText("Vítejte v Eldocku");
  await employee.getByLabel("Nové heslo", { exact: true }).fill("tomas-heslo-1");
  await expect(employee.getByTestId("password-rules")).toContainText("Heslo nesmí obsahovat e-mail.");
  await expect(employee.getByRole("button", { name: "Nastavit heslo a přihlásit" })).toBeDisabled();
  await employee.getByLabel("Nové heslo", { exact: true }).fill(EMPLOYEE.password);
  await employee.getByLabel("Nové heslo znovu").fill(EMPLOYEE.password);
  await employee.getByRole("button", { name: "Nastavit heslo a přihlásit" }).click();
  await expect(employee).toHaveURL(/\/plant\//, { timeout: 30_000 });
  await employee.getByRole("link", { name: /Můj účet/ }).click();
  await expect(employee.getByTestId("sessions")).toContainText("toto zařízení");
  // Odkaz je jednorázový
  await employee.goto(new URL(inviteLink).pathname);
  await expect(employee.getByTestId("password-link-invalid")).toBeVisible();
  await employee.context().close();

  await page.reload();
  await expect(page.getByTestId(`account-row-${EMPLOYEE.email}`).getByTestId("account-status")).toContainText("Aktivní");
  await expect(page.getByRole("region", { name: "Bezpečnostní deník" })).toContainText("Nastavení hesla");
});

test("stejná hláška pro neznámý e-mail i špatné heslo a zablokování po 5 chybách", async ({ page }) => {
  await login(page, EMPLOYEE.email, "spatne-heslo-123");
  await expect(loginAlert(page)).toHaveText("Nesprávný e-mail nebo heslo.");
  const unknown = "nikdo@kovovyroba-tabor.example";
  for (let attempt = 0; attempt < 5; attempt++) {
    await login(page, unknown, `spatne-heslo-${attempt}`);
    await expect(loginAlert(page)).toHaveText("Nesprávný e-mail nebo heslo.");
  }
  await login(page, unknown, "spatne-heslo-6");
  await expect(loginAlert(page)).toContainText("Příliš mnoho neúspěšných pokusů");
});

test("dvoufázové ověření: spárování, přihlášení kódem a záložním kódem", async ({ page }) => {
  await login(page, EMPLOYEE.email, EMPLOYEE.password);
  await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });
  await page.goto("/ucet");
  await page.getByRole("button", { name: "Zapnout dvoufázové ověření" }).click();
  totpSecret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Kód z aplikace").fill(totp(totpSecret));
  await page.getByRole("button", { name: "Zapnout", exact: true }).click();
  const codes = page.getByTestId("recovery-codes");
  await expect(codes).toContainText("Záložní kódy");
  recoveryCode = (await codes.locator("li").first().textContent())!.trim();
  expect(recoveryCode).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);

  await page.getByRole("button", { name: "Odhlásit (Zamknout)" }).click();
  await login(page, EMPLOYEE.email, EMPLOYEE.password);
  const form = page.getByTestId("two-factor-form");
  await form.getByLabel("Kód z aplikace").fill("000000");
  await form.getByRole("button", { name: "Ověřit a přihlásit" }).click();
  await expect(form.locator("[role=alert]")).toContainText("Kód nesouhlasí");
  await form.getByLabel("Kód z aplikace").fill(totp(totpSecret));
  await form.getByRole("button", { name: "Ověřit a přihlásit" }).click();
  await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });

  await page.getByRole("button", { name: "Odhlásit (Zamknout)" }).click();
  await login(page, EMPLOYEE.email, EMPLOYEE.password);
  await page.getByTestId("two-factor-form").getByLabel("Kód z aplikace").fill(recoveryCode);
  await page.getByRole("button", { name: "Ověřit a přihlásit" }).click();
  await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });
});

test("zablokování zaměstnance zruší jeho přihlášení; podvržená cookie přepínače účet firmy nevybere", async ({ page, browser }) => {
  const employee = await freshPage(browser);
  await login(employee, EMPLOYEE.email, EMPLOYEE.password);
  await employee.getByTestId("two-factor-form").getByLabel("Kód z aplikace").fill(totp(totpSecret));
  await employee.getByRole("button", { name: "Ověřit a přihlásit" }).click();
  await expect(employee).toHaveURL(/\/plant\//, { timeout: 30_000 });

  await login(page, OWNER.email, OWNER.password);
  await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });
  await page.goto("/admin/users");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(`account-actions-${employeeId}`).getByRole("button", { name: "Zablokovat" }).click();
  await expect(toast(page)).toContainText("účet zablokován");

  // Relace zaměstnance na druhém zařízení přestala platit
  await employee.goto("/app");
  await expect(employee).toHaveURL(/\/login/);
  await login(employee, EMPLOYEE.email, EMPLOYEE.password);
  await expect(loginAlert(employee)).toHaveText("Nesprávný e-mail nebo heslo.");
  await employee.context().close();

  await page.getByTestId(`account-actions-${employeeId}`).getByRole("button", { name: "Odblokovat" }).click();
  await expect(toast(page)).toContainText("účet odblokován");

  // Obchodní demo (přihlášené heslem dema) s cookie účtu nastavenou na zaměstnance firmy zůstane v demo účtu
  const demo = await freshPage(browser);
  await demo.goto("/login");
  await demo.getByLabel("Heslo / PIN").fill("eldock2026");
  await demo.getByRole("button", { name: /Přihlásit/ }).click();
  await expect(demo).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await demo.context().addCookies([{ name: "digitry-account", value: employeeId, url: new URL(demo.url()).origin }]);
  await demo.goto("/app");
  await expect(demo.getByText(EMPLOYEE.name)).toHaveCount(0);
  await expect(demo.getByText("Závod Tábor – Kovovýroba")).toHaveCount(0);
  await demo.context().close();
});
