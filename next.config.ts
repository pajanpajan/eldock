import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E testy pouští vlastní dev server s odděleným build adresářem (viz playwright.config.ts),
  // aby mohly běžet vedle `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Produkční Docker obraz (viz Dockerfile): `.next/standalone` obsahuje server.js a jen nutné node_modules.
  output: "standalone",
  // Nahrané soubory a zdrojáky (trasované kvůli cestám přes process.cwd()) do obrazu nepatří – data jsou ve svazku.
  // Docker build na serveru (2 GB RAM) kontrolu typů vynechává – padala na nedostatek paměti. Typy hlídá
  // `npm run verify` (typecheck) před každým nasazením; lokální `next build` je kontroluje dál.
  typescript: { ignoreBuildErrors: process.env.ELDOCK_SKIP_BUILD_TYPECHECK === "1" },
  outputFileTracingExcludes: { "*": ["storage/**", "src/**", "e2e/**", "*.db", "*.db-journal", "*.db-wal", "*.db-shm"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
