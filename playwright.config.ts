import { defineConfig, devices } from "@playwright/test";

// E2E testy běží proti vlastnímu dev serveru na portu 3200 s čistou databází `e2e.db`
// a odděleným build adresářem `.next-e2e` – běžící `npm run dev` (port 3000, dev.db) neruší.
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Na Windows je Edge vždy k dispozici; jinak `npx playwright install chromium` a E2E_BROWSER_CHANNEL=chromium.
        channel: process.env.E2E_BROWSER_CHANNEL || "msedge",
      },
    },
  ],
  webServer: {
    command: `npx tsx e2e/prepare-db.ts && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/manifest.webmanifest`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: { DATABASE_URL: "file:./e2e.db", NEXT_DIST_DIR: ".next-e2e", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
