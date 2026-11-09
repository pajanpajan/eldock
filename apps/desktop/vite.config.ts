// Fáze 71: rozhraní aplikace Eldock pro Windows (renderer Electronu). Sdílené moduly webu `@/` (jádro synchronizace,
// štítky stavů, formáty) se berou přímo ze `src/` kořene projektu; React jen v jedné kopii (`dedupe`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  // Načítá se přes vlastní protokol `eldock-app://app/` – relativní cesty k souborům sestavení
  base: "./",
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: {
      "@app": fileURLToPath(new URL("./src", import.meta.url)),
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  server: { port: 5174, strictPort: true, fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
  build: { outDir: "dist", emptyOutDir: true, target: "chrome140", chunkSizeWarningLimit: 4000 },
});
