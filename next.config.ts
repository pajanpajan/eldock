import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E testy pouští vlastní dev server s odděleným build adresářem (viz playwright.config.ts),
  // aby mohly běžet vedle `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
