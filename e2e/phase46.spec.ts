import { expect, test } from "@playwright/test";

import { startAs, toast } from "./helpers";

// Fáze 46: knihovna návodů a datasheetů, verzované zálohy SW s rollbackem, klasifikace zásahu dle
// Nařízení (EU) 2023/1230 v Července a CAE, LOTO dle ČSN EN 50110-1 ed. 4, pas baterie, QR doložka
// a normy 2027 + protokol o kusové zkoušce v AI Panel Builderu.
test.describe.configure({ mode: "serial" });

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("návody a datasheety: filtr, náhled, nahrání dokumentu ke komponentě", async ({ page }) => {
  await page.goto("/equipment/eq-r-cnc-04?tab=docs");
  const library = page.getByTestId("doc-library");
  await expect(page.getByRole("tab", { name: /Návody & Datasheety \(3\)/ })).toBeVisible();
  await expect(library.getByTestId("doc-card")).toHaveCount(3);
  await library.getByRole("button", { name: "Datasheety komponent (1)" }).click();
  await expect(library.getByTestId("doc-card")).toHaveCount(1);
  await expect(library.getByTestId("doc-component")).toHaveText("-K1");
  await library.getByRole("button", { name: "Náhled" }).click();
  await expect(page.getByTestId("doc-preview-image")).toBeVisible();
  await page.keyboard.press("Escape");

  await library.getByRole("button", { name: "Vše (3)" }).click();
  await library.getByRole("button", { name: "Nahrát návod / datasheet" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Soubor dokumentu").setInputFiles({ name: "jistic-f3.pdf", mimeType: "application/pdf", buffer: PDF });
  await dialog.getByLabel("Kategorie").selectOption("DATASHEET");
  await dialog.getByLabel("Název").fill("Datasheet jističe F3");
  await dialog.getByLabel("Komponenta ve schématu").fill("f3");
  await dialog.getByRole("button", { name: "Nahrát do knihovny" }).click();
  await expect(toast(page)).toContainText("Dokument nahrán");
  await expect(library.getByTestId("doc-card")).toHaveCount(4);
  await expect(library.getByTestId("doc-component").filter({ hasText: "-F3" })).toBeVisible();
});

test("zálohy SW: aktivní verze se Safety CRC, nová verze, archiv a rollback", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/equipment/eq-r-cnc-04?tab=software");
  const plc = page.getByTestId("software-unit").filter({ hasText: "PLC -A1 (Siemens S7-1500)" });
  await expect(plc.getByTestId("software-active")).toContainText("v1.1");
  await expect(plc.getByTestId("software-crc")).toContainText("CRC: 0x8F4A-2C91");
  await expect(plc.getByTestId("software-active")).toContainText("ZM-2025-0007");
  await expect(page.getByTestId("software-unit").filter({ hasText: "Frekvenční měnič vřetene -U1" }).getByTestId("software-active")).toContainText("v1.0");

  // Nová verze bezpečnostního programu (Minor +0.1) – CRC povinný
  await plc.getByRole("button", { name: "Nová verze" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("sw-next-version")).toContainText("v1.1 → v1.2");
  await dialog.getByLabel("Soubor zálohy").setInputFiles({ name: "R-CNC-04_PLC_A1.zap19", mimeType: "application/octet-stream", buffer: Buffer.from("TIA archive demo") });
  await dialog.getByLabel(/Popis změny/).fill("Úprava časovače mazání vřetene T12 z 30 na 45 s.");
  await dialog.getByLabel(/Safety Checksum/).fill("0x9a1b2c3d");
  await dialog.getByRole("button", { name: /Uložit jako v1.2/ }).click();
  await expect(toast(page)).toContainText("v1.2");
  await expect(plc.getByTestId("software-active")).toContainText("v1.2");
  await expect(plc.getByTestId("software-crc")).toContainText("CRC: 0x9A1B-2C3D");

  // Rollback na v1.1 z archivu
  await plc.getByText(/Historie a archiv starších verzí/).click();
  await plc.getByTestId("software-archived").filter({ hasText: "v1.1" }).getByRole("button", { name: "Nastavit jako aktivní" }).click();
  await expect(plc.getByTestId("software-active")).toContainText("v1.1");
});

test("Červenka: klasifikace podstatné změny a úprava SW → CAE vidí úkol čekající zálohy", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await startAs(page, "MAINTENANCE");
  await page.goto("/equipment/eq-cnc-04/change-request");
  for (let i = 0; i < 3 && !(await page.locator("#change-note").isVisible()); i++) await page.getByRole("button", { name: "Další" }).click();
  await page.locator("#change-note").fill("Výměna dveřního bezpečnostního spínače a úprava Safety programu.");
  const classification = page.getByTestId("safety-classification");
  await classification.getByRole("radio", { name: /Zásah do bezpečnostního obvodu/ }).click();
  await expect(page.getByTestId("substantial-warning")).toContainText("čl. 18 Nařízení (EU) 2023/1230");
  await classification.getByLabel(/Součástí zásahu byla i úprava řídicího SW/).check();
  await page.getByRole("button", { name: "Další" }).click();
  await expect(page.getByTestId("summary-safety")).toContainText("záloha čeká na nahrání");
  await page.getByRole("button", { name: "Odeslat do CAE" }).click();
  await expect(toast(page)).toContainText("odeslána do CAE");

  await startAs(page, "CAE_ENGINEER");
  await page.goto("/cae");
  await page.getByRole("row", { name: /(?<![-\w])CNC-04/ }).first().getByRole("link").click();
  await expect(page.getByTestId("ticket-safety-impact")).toHaveText("Podstatná změna – bezpečnost");
  await expect(page.getByTestId("ticket-software-task")).toContainText("Čeká na nahrání aktualizované zálohy SW");
});

test("LOTO dle ČSN EN 50110-1 ed. 4, pas baterie RZ1 a QR doložka", async ({ page }) => {
  await page.goto("/equipment/eq-rz1?tab=passport");
  const battery = page.getByTestId("battery-passport");
  await expect(battery).toContainText("48 kWh");
  await expect(battery).toContainText("LiFePO4");
  await expect(battery).toContainText("97 %");
  const loto = page.getByTestId("loto-50110");
  await expect(loto).toContainText("Osoba odpovědná za elektrické zařízení (OOEZ)");
  await expect(loto).toContainText("Osoba pověřená řízením pracovní činnosti (OPŘPČ)");
  await loto.getByLabel(/Vypnout a úplně odpojit/).check();
  await expect(page.getByTestId("loto-five-rules")).toContainText("1/5");

  await page.goto("/equipment/eq-rz1/label");
  await expect(page.getByTestId("qr-legal-note").first()).toHaveText("Digitální provozní dokumentace dle čl. 10 Nařízení (EU) 2023/1230 a ČSN EN 50110-1 ed. 4");
});

test("AI Panel Builder: norma strojního rozváděče a protokol o kusové zkoušce v dokumentaci", async ({ page }) => {
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByRole("link", { name: /^4\. Dokumentace, Kusovník & Štítky/ }).click();
  await expect(page.getByTestId("declaration-norms")).toContainText("ČSN EN IEC 61439-3 ed. 2");
  await expect(page.getByTestId("declaration-directives")).toContainText("RoHS 2011/65/EU");

  await page.getByLabel("Norma rozváděče").selectOption("CSN_60204_1_ED3");
  await expect(page.getByTestId("declaration-title")).toContainText("Nařízení (EU) 2023/1230");
  await expect(page.getByTestId("declaration-norms")).toContainText("ČSN EN 60204-1 ed. 3");
  await expect(page.getByTestId("doc-thermal-basis")).toContainText("ČSN EN 60204-1 ed. 3");

  const routine = page.getByTestId("routine-test");
  // Od fáze 55 má vzorový PB-001 v seedu vyplněnou kusovou zkoušku (VYHOVUJE) – test ji přepíše vlastními hodnotami
  await expect(page.getByTestId("routine-verdict")).toHaveText(/NEÚPLNÝ|VYHOVUJE/);
  // Tlačítko se přepíná – klikne se jen na body, které ještě nejsou „Vyhovuje“
  for (const button of await routine.getByRole("button", { name: "✓ Vyhovuje" }).all()) if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await routine.getByLabel("Izolační odpor R_iso", { exact: true }).fill("250");
  await routine.getByLabel("Zkoušku provedl").fill("Ing. Petra Nová");
  await expect(page.getByTestId("routine-verdict")).toHaveText("VYHOVUJE");
  await expect(routine).toContainText("Uloženo");
  await page.reload();
  await expect(page.getByTestId("routine-sheet-verdict")).toContainText("rozváděč VYHOVUJE");
  await expect(page.getByTestId("routine-point-dielectric")).toContainText("R_iso = 250 MΩ");

  // Zpět na výchozí normu (ostatní E2E počítají s rozvodnicí DBO)
  await page.getByLabel("Norma rozváděče").selectOption("CSN_61439_3_ED2");
  await expect(page.getByTestId("declaration-norms")).toContainText("ČSN EN IEC 61439-3 ed. 2");
});
