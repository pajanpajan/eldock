import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E testy pouští vlastní dev server s odděleným build adresářem (viz playwright.config.ts),
  // aby mohly běžet vedle `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Fáze 62: E2E dev server bez vestavěného MCP serveru Next.js – ten zapisuje logy prohlížeče do
  // `.next-e2e/dev/logs/next-development.log`, watcher zápis bral jako změnu („✓ Compiled in 3ms“) a stránka se
  // znovu načetla, zapsala další log („Download the React DevTools…“) a tak dokola (padající E2E na navigaci).
  // Fáze 87: totéž pro server generátoru video-návodů (`.next-tutorials`) – obnovení stránky by zkazilo natáčení.
  experimental: { mcpServer: process.env.NEXT_DIST_DIR !== ".next-e2e" && process.env.NEXT_DIST_DIR !== ".next-tutorials" },
  // Produkční Docker obraz (viz Dockerfile): `.next/standalone` obsahuje server.js a jen nutné node_modules.
  output: "standalone",
  // Fáze 100: komprese odpovědí serveru Next (gzip) – výchozí, uvedeno výslovně; na produkci komprimuje i Caddy (zstd / gzip).
  compress: true,
  // Fáze 100: katalogové fotky výrobců se mezi nasazeními nemění na místě (nová fotka = nový soubor, viz
  // public/catalog-images/README.md) – prohlížeč je drží rok bez dotazu na server (dřív max-age=0 a revalidace ETagem).
  async headers() {
    return [{ source: "/catalog-images/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
  // Nahrané soubory a zdrojáky (trasované kvůli cestám přes process.cwd()) do obrazu nepatří – data jsou ve svazku.
  // Docker build na serveru (2 GB RAM) kontrolu typů vynechává – padala na nedostatek paměti. Typy hlídá
  // `npm run verify` (typecheck) před každým nasazením; lokální `next build` je kontroluje dál.
  typescript: { ignoreBuildErrors: process.env.ELDOCK_SKIP_BUILD_TYPECHECK === "1" },
  outputFileTracingExcludes: { "*": ["storage/**", "src/**", "e2e/**", "*.db", "*.db-journal", "*.db-wal", "*.db-shm"] },
  // Fáze 92: nahrávač fotek řad zakóduje obrázek přes sharp – jeho nativní binárka i libvips (`@img/sharp-*`; v Linuxu
  // sdílená knihovna načítaná mimo `require`, trasování by ji mohlo minout) musí být ve standalone výstupu.
  outputFileTracingIncludes: { "/api/catalog-images/upload": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"] },
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
