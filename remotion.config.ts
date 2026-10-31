// Konfigurace Remotion CLI (studio a render videa). Bundler Remotionu je webpack mimo Next.js,
// proto mu dáváme stejný alias „@ → src“ jako má aplikace (tsconfig paths).
import path from "node:path";

import { Config } from "@remotion/cli/config";

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), "@": path.join(process.cwd(), "src") },
  },
}));

Config.setVideoImageFormat("jpeg");
