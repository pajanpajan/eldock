// Fáze 73: mobilní aplikace Eldock (Android, iOS) – stejné rozhraní `dist/` jako aplikace pro Windows ve WebView
// systému. Nativní funkce jen přes most `src/platform/native.ts`.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cz.eldock.app",
  appName: "Eldock",
  webDir: "dist",
  backgroundColor: "#09090b",
  android: {
    // Server závodu v interní síti jede přes http – rozhraní (https://localhost) na něj smí volat
    allowMixedContent: true,
  },
  ios: {
    // Okraje displeje (výřez, domovská lišta) řeší rozhraní přes env(safe-area-inset-*)
    contentInset: "never",
    backgroundColor: "#09090b",
  },
  plugins: {
    // Android: WebView od okraje k okraji, okraje v CSS proměnných --safe-area-inset-*; světlé ikony na tmavém pozadí
    SystemBars: { insetsHandling: "css", initialViewportFitValueHint: "cover", style: "DARK" },
    LocalNotifications: { smallIcon: "ic_stat_eldock", iconColor: "#facc15" },
  },
};

export default config;
