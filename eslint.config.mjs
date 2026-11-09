import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Fáze 71: aplikace pro Windows (Electron) – žádné next/image, obrázky z mezipaměti jako blob:
  { files: ["apps/desktop/**"], rules: { "@next/next/no-img-element": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vygenerovaný Prisma klient.
    "src/generated/**",
    // Fáze 71: sestavená aplikace pro Windows a instalátor.
    "apps/desktop/dist/**",
    "apps/desktop/dist-electron/**",
    "apps/desktop/release/**",
  ]),
]);

export default eslintConfig;
