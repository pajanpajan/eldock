import { expect, test } from "@playwright/test";

test("cache souborů: seed fotka s ETagem a 304, PDF projekt s Cache-Control", async ({ page }) => {
  const photo = await page.request.get("/api/files/photos/seed/equipment-RH1.svg");
  expect(photo.status()).toBe(200);
  expect(photo.headers()["cache-control"]).toBe("private, max-age=86400, stale-while-revalidate=604800");
  const etag = photo.headers()["etag"];
  expect(etag).toMatch(/^W\/"/);

  const again = await page.request.get("/api/files/photos/seed/equipment-RH1.svg", { headers: { "If-None-Match": etag } });
  expect(again.status()).toBe(304);

  const pdf = await page.request.get("/demo-docs/pohon-vrat-motor.pdf");
  expect(pdf.headers()["cache-control"]).toContain("max-age=86400");
});

test("líně načítané záložky karty zařízení se po otevření vykreslí", async ({ page }) => {
  await page.goto("/equipment/eq-rm1?tab=bom");
  await expect(page.getByRole("table").first()).toBeVisible();
  await page.goto("/equipment/eq-rm1?tab=3d");
  await expect(page.getByRole("tabpanel")).not.toContainText("Načítání", { timeout: 15_000 });
  await page.goto("/equipment/eq-rm1?tab=diagnostics");
  await expect(page.getByRole("tabpanel")).toBeVisible();
});
