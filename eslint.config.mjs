import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Fáze 71 a 73: aplikace Eldock (Windows, Android, iOS) – žádné next/image, obrázky z mezipaměti jako blob:
  { files: ["apps/client/**"], rules: { "@next/next/no-img-element": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    // Ruční testovací server (NEXT_DIST_DIR=.next-manual, e2e-manual.db)
    ".next-manual/**",
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vygenerovaný Prisma klient.
    "src/generated/**",
    // Fáze 71: sestavená aplikace pro Windows a instalátor.
    "apps/client/dist/**",
    "apps/client/dist-electron/**",
    "apps/client/release/**",
    // Fáze 73: nativní projekty Android a iOS (do nich Capacitor kopíruje sestavené rozhraní)
    "apps/client/android/**",
    "apps/client/ios/**",
  ]),
]);

export default eslintConfig;
