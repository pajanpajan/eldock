import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { readZip } from "../src/server/services/test-zip";
import { toast } from "./helpers";
import { PUBLIC_STATE } from "./auth";

// Fáze 69 (GDPR): export dat firmy (ZIP), vlastní údaje (JSON), odebrání zaměstnance, žádost o zrušení účtu firmy
// s lhůtou a její zrušení; export firmy Panel Builderu a ochrana ukázkové firmy.
test.describe.configure({ mode: "serial" });

const OWNER = { name: "Olga Ředitelová", email: "olga@lisovna-kolin.example", password: "Lisovna-Kolin-2026" };
const EMPLOYEE = { name: "Marek Elektrikář", email: "marek@lisovna-kolin.example" };

async function download(page: Page, click: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent("download"), click()]);
  return { name: file.suggestedFilename(), data: readFileSync((await file.path())!) };
}

test.describe("registrovaná firma Správy závodů", () => {
  test.use({ storageState: PUBLIC_STATE });

  test("export ZIP, vlastní údaje, odebrání zaměstnance a žádost o zrušení účtu s jejím zrušením", async ({ page }) => {
    await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: "12345679", companyName: "Lisovna Kolín s.r.o.", dic: "CZ12345679", street: "Průmyslová 5", city: "Kolín", zip: "280 02" } }));
    await page.goto("/register-plant");
    await page.getByLabel("IČO").fill("12345679");
    await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Lisovna Kolín s.r.o.");
    await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(OWNER.name);
    await page.getByLabel("Telefon").fill("+420 777 444 555");
    await page.getByLabel("Název prvního závodu").fill("Závod Kolín – Lisovna");
    await page.getByLabel("E-mail (přihlášení)").fill(OWNER.email);
    await page.getByLabel("Heslo (min. 10 znaků)").fill(OWNER.password);
    await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
    await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
    await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });

    // Soubor firmy (nahraný, zatím nepřipojený) – v exportu musí být
    const uploaded = await page.request.post("/api/uploads", { multipart: { kind: "document", file: { name: "revizni-zprava.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") } } });
    const fileUrl = ((await uploaded.json()) as { url: string }).url;

    // Zaměstnanec (pozvánka) – pak ho odebereme
    await page.goto("/admin/users");
    await page.getByLabel("Jméno a příjmení").fill(EMPLOYEE.name);
    await page.getByLabel("E-mail", { exact: true }).fill(EMPLOYEE.email);
    await page.getByRole("button", { name: "Založit podúčet" }).click();
    await expect(toast(page)).toContainText(`Podúčet ${EMPLOYEE.name} založen.`);

    // Data firmy → export ZIP
    await page.getByRole("link", { name: "Data firmy" }).click();
    await expect(page).toHaveURL(/\/admin\/data$/);
    const exported = await download(page, () => page.getByTestId("data-export").click());
    expect(exported.name).toMatch(/^eldock-export-12345679-\d{4}-\d{2}-\d{2}\.zip$/);
    const zip = readZip(exported.data);
    expect(JSON.parse(zip.get("manifest.json")!.toString("utf8"))).toMatchObject({ format: "eldock-export", company: { name: "Lisovna Kolín s.r.o.", product: "PLANT_MANAGEMENT" } });
    const users = JSON.parse(zip.get("data/uzivatele.json")!.toString("utf8")) as { email: string }[];
    expect(users.map((user) => user.email).sort()).toEqual([EMPLOYEE.email, OWNER.email].sort());
    expect(zip.get("data/uzivatele.json")!.toString("utf8")).not.toContain("passwordHash");
    expect(zip.get(`soubory/${fileUrl.replace("/api/files/", "")}`)!.toString()).toBe("%PDF-1.4 e2e");
    await page.reload();
    await expect(page.getByTestId("data-requests")).toContainText("Export dat firmy");

    // Vlastní údaje (Můj účet)
    await page.goto("/ucet");
    const personal = await download(page, () => page.getByTestId("personal-export").click());
    expect(JSON.parse(personal.data.toString("utf8"))).toMatchObject({ format: "eldock-osobni-udaje", user: { email: OWNER.email } });

    // Odebrání zaměstnance (jméno zůstane v historii, e-mail zmizí)
    await page.goto("/admin/users");
    const row = page.getByTestId(`account-row-${EMPLOYEE.email}`);
    await row.getByRole("button", { name: "Odebrat" }).click();
    await row.getByTestId("remove-employee").getByRole("button", { name: "Odebrat zaměstnance" }).click();
    await expect(toast(page)).toContainText(`${EMPLOYEE.name}: zaměstnanec odebrán.`);
    await expect(page.getByTestId(`account-row-${EMPLOYEE.email}`)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Bezpečnostní deník" })).toContainText("Zaměstnanec odebrán");

    // Žádost o zrušení účtu: špatné heslo, pak správně → výmaz za 30 dní, pruh i v „Můj účet“; zrušení žádosti
    await page.goto("/admin/data");
    await page.getByTestId("closure-open").click();
    await page.getByLabel("Vaše heslo").fill("spatne-heslo-123");
    await page.getByLabel(/Pro potvrzení napište/).fill("ZRUŠIT");
    await page.getByRole("button", { name: "Požádat o zrušení účtu" }).click();
    await expect(toast(page)).toContainText("Nesprávné heslo.");
    await page.getByLabel("Vaše heslo").fill(OWNER.password);
    await page.getByRole("button", { name: "Požádat o zrušení účtu" }).click();
    await expect(toast(page)).toContainText("Žádost přijata");
    await expect(page.getByTestId("closure-pending")).toContainText("bude zrušen a data smazána");
    await page.goto("/ucet");
    await expect(page.getByTestId("account-closure-pending")).toBeVisible();
    await page.goto("/admin/data");
    await page.getByTestId("closure-cancel").click();
    await expect(toast(page)).toContainText("účet firmy zůstává");
    await expect(page.getByTestId("closure-pending")).toHaveCount(0);
    await expect(page.getByTestId("data-requests")).toContainText("zrušeno");
  });
});

test("obchodní demo nemá data firmy k exportu; firma Panel Builderu stáhne svá data, ukázkovou firmu zrušit nejde", async ({ page }) => {
  // Dotaz do API bez otevřené stránky (/app po načtení přesměruje do závodu a přerušil by další navigaci)
  const demo = await page.request.get("/api/data-export");
  expect(demo.status()).toBe(403);
  expect(((await demo.json()) as { error: string }).error).toContain("Obchodní demo");

  await page.goto("/panel-builder/company");
  await expect(page.getByTestId("data-closure")).toContainText("Ukázkovou firmu zrušit nejde.");
  const exported = await download(page, () => page.getByTestId("data-export").click());
  const zip = readZip(exported.data);
  expect(JSON.parse(zip.get("manifest.json")!.toString("utf8"))).toMatchObject({ company: { product: "PANEL_BUILDER" } });
  expect(JSON.parse(zip.get("data/projekty-rozvadecu.json")!.toString("utf8")).map((project: { code: string }) => project.code)).toContain("PB-001");
});
