import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import { startAsAccount, toast } from "./helpers";
import { PUBLIC_STATE } from "./auth";

// Fáze 70: spárování aplikace v „Můj účet“ (kód + QR), API synchronizace s tokenem zařízení (relace, změny,
// nahrání souboru s SHA-256, fronta úprav), přehled zařízení firmy a odpojení správcem; obchodní demo nepáruje.
test.describe.configure({ mode: "serial" });

const OWNER = { name: "Petra Technická", email: "petra@montaze-melnik.example", password: "Montaze-Melnik-2026" };
const DEVICE = "Samsung údržba hala A";

test.describe("registrovaná firma Správy závodů", () => {
  test.use({ storageState: PUBLIC_STATE });

  test("spárování aplikace, API s tokenem zařízení a odpojení správcem firmy", async ({ page }) => {
    // Informace o serveru jsou veřejné, relace bez tokenu ne
    const info = await page.request.get("/api/sync/v1");
    expect(await info.json()).toMatchObject({ api: "eldock-sync", version: 1 });
    expect((await page.request.get("/api/sync/v1/session")).status()).toBe(401);

    await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: "24681351", companyName: "Montáže Mělník s.r.o.", dic: "CZ24681351", street: "Nádražní 12", city: "Mělník", zip: "276 01" } }));
    await page.goto("/register-plant");
    await page.getByLabel("IČO").fill("24681351");
    await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Montáže Mělník s.r.o.");
    await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(OWNER.name);
    await page.getByLabel("Telefon").fill("+420 777 222 333");
    await page.getByLabel("Název prvního závodu").fill("Závod Mělník – Montáže");
    await page.getByLabel("E-mail (přihlášení)").fill(OWNER.email);
    await page.getByLabel("Heslo (min. 10 znaků)").fill(OWNER.password);
    await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
    await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
    await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });

    // Můj účet → Aplikace a zařízení: kód + QR s adresou serveru
    await page.goto("/ucet");
    const card = page.getByTestId("devices-card");
    await expect(card).toContainText("Zatím žádné spárované zařízení.");
    await card.getByTestId("pair-start").click();
    const code = (await card.getByTestId("pair-code").innerText()).trim();
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    await expect(card.getByTestId("pair-server")).toContainText("http://localhost:3200");
    expect(await card.getByTestId("pair-qr").getAttribute("data-uri")).toBe(`eldock://pair?server=${encodeURIComponent("http://localhost:3200")}&code=${code}`);

    // Aplikace kód uplatní (opsaný bez pomlčky, malými písmeny)
    const paired = await page.request.post("/api/sync/v1/pair", { data: { code: code.replace("-", "").toLowerCase(), platform: "ANDROID", name: DEVICE, appVersion: "0.1.0-e2e" } });
    expect(paired.status()).toBe(201);
    const { token, session } = (await paired.json()) as { token: string; session: { scope: string; user: { name: string; accountType: string }; plants: { id: string; name: string }[] } };
    expect(session.user).toMatchObject({ name: OWNER.name, accountType: "PLANT_ADMIN" });
    expect(session.plants).toEqual([expect.objectContaining({ name: "Závod Mělník – Montáže" })]);
    expect((await page.request.post("/api/sync/v1/pair", { data: { code, platform: "IOS" } })).status()).toBe(404);
    // Stránka se sama obnoví a zařízení ukáže
    await expect(card.getByTestId("pair-done")).toBeVisible({ timeout: 20_000 });
    await expect(card.getByTestId("my-devices")).toContainText(DEVICE);
    await expect(card.getByTestId("my-devices")).toContainText("Zatím nesynchronizováno");

    const auth = { Authorization: `Bearer ${token}` };
    // První stažení: závod a technický ředitel (bez e-mailu a hesla)
    const pulled = await page.request.get(`/api/sync/v1/changes?cursor=0&scope=${session.scope}`, { headers: auth });
    expect(pulled.status()).toBe(200);
    const changes = (await pulled.json()) as { cursor: number; hasMore: boolean; reset: boolean; changes: { entity: string; op: string; data?: Record<string, unknown> }[] };
    expect(changes).toMatchObject({ hasMore: false, reset: false });
    expect(changes.changes.filter((change) => change.entity === "Plant").map((change) => change.data?.name)).toEqual(["Závod Mělník – Montáže"]);
    const user = changes.changes.find((change) => change.entity === "User");
    expect(user?.data).toMatchObject({ name: OWNER.name });
    expect(JSON.stringify(changes)).not.toMatch(/passwordHash|montaze-melnik\.example/);

    // Nahrání fotky z haly s otiskem; opakované nahrání = stejný soubor
    const photo = Buffer.from("e2e fotka rozvadece z haly");
    const sha256 = createHash("sha256").update(photo).digest("hex");
    const upload = () => page.request.post("/api/sync/v1/files?kind=photo&name=rozvadec-hala.jpg", { data: photo, headers: { ...auth, "Content-Type": "image/jpeg", "X-Content-SHA256": sha256 } });
    const first = await upload();
    expect(first.status()).toBe(201);
    const stored = (await first.json()) as { url: string; deduplicated: boolean };
    expect(stored).toMatchObject({ deduplicated: false });
    expect(await (await upload()).json()).toMatchObject({ url: stored.url, deduplicated: true });
    expect((await page.request.post("/api/sync/v1/files?kind=photo&name=x.jpg", { data: photo, headers: { ...auth, "X-Content-SHA256": "0".repeat(64) } })).status()).toBe(422);
    const download = await page.request.get(stored.url, { headers: auth });
    expect(download.status()).toBe(200);
    expect(download.headers()["x-content-sha256"]).toBe(sha256);

    // Fronta úprav: neexistující zařízení = odmítnuto, opakované odeslání = stejný výsledek
    const mutation = { mutations: [{ id: "e2e-mutace-0001", type: "changeRequest.submit", payload: { equipmentId: "neexistuje", note: "Výměna jističe", attachments: [{ url: stored.url }] } }] };
    const pushed = await page.request.post("/api/sync/v1/mutations", { data: mutation, headers: auth });
    expect(await pushed.json()).toMatchObject({ results: [{ id: "e2e-mutace-0001", status: "rejected", code: "NOT_FOUND" }] });
    expect(await (await page.request.post("/api/sync/v1/mutations", { data: mutation, headers: auth })).json()).toMatchObject({ results: [{ status: "rejected", duplicate: true }] });

    // Administrace → Zařízení: aplikace firmy, odmítnuté úpravy a odpojení
    await page.goto("/admin/devices");
    const devices = page.getByTestId("company-devices");
    await expect(devices).toContainText(DEVICE);
    await expect(devices).toContainText(OWNER.name);
    await expect(devices).toContainText("Synchronizováno");
    await expect(page.getByTestId("rejected-mutations")).toContainText("Zadání změny");
    page.once("dialog", (dialog) => void dialog.accept());
    await devices.getByRole("button", { name: "Odpojit" }).click();
    await expect(toast(page)).toContainText(`${DEVICE}: zařízení odpojeno.`);
    await expect(devices).toContainText("Odpojeno");
    expect((await page.request.get("/api/sync/v1/session", { headers: auth })).status()).toBe(401);
    expect((await page.request.get(stored.url, { headers: auth })).status()).toBe(401);
    await page.goto("/admin/users");
    await expect(page.getByRole("region", { name: "Bezpečnostní deník" })).toContainText("Aplikace odpojena");
  });
});

test("obchodní demo aplikace nepáruje", async ({ page }) => {
  await page.goto("/ucet");
  await expect(page.getByText("aplikace pro Windows, iOS a Android jsou pro účty registrovaných firem")).toBeVisible();
  await expect(page.getByTestId("devices-card")).toHaveCount(0);
  // Administrace je pro technického ředitele (demo účet Ing. Dvořák)
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/admin/devices");
  await expect(page.getByText("Obchodní demo nepáruje aplikace")).toBeVisible();
});
