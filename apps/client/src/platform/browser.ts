// Fáze 71 a 73: rozhraní v obyčejném prohlížeči (vývoj `npm run dev:web`, E2E v telefonním rozvržení) – token
// v localStorage, soubor stáhne prohlížeč. Na platformě „OTHER“ – ne jako aplikace pro Windows.

import type { EldockBridge } from "./types";

const TOKEN_KEY = "eldock.desktop.token";

export const browserBridge: EldockBridge = {
  kind: "web",
  syncPlatform: "OTHER",
  mobile: false,
  token: {
    async get() {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    },
    async set(token) {
      localStorage.setItem(TOKEN_KEY, token);
    },
    async clear() {
      localStorage.removeItem(TOKEN_KEY);
    },
  },
  async appInfo() {
    return { version: __APP_VERSION__, deviceName: "Prohlížeč", label: "Eldock v prohlížeči (vývoj)", tokenProtection: "nešifrovaný (vývojový režim v prohlížeči)" };
  },
  async openFile(name, data) {
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "";
  },
  async takeDeepLink() {
    return null;
  },
  onDeepLink() {
    return () => undefined;
  },
};
