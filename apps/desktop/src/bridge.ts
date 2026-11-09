// Fáze 71: API hlavního procesu (electron/preload.ts → `window.eldock`). Mimo Electron (vývoj rozhraní
// v prohlížeči, `npm run dev:web`) náhrada: token v localStorage, soubor se stáhne prohlížečem.

import type { TokenStore } from "@/sync-client";

export interface AppInfo {
  version: string;
  hostname: string;
  platform: string;
  /** Token je zašifrovaný systémem (Windows DPAPI). */
  encrypted: boolean;
}

export interface EldockBridge {
  token: TokenStore;
  appInfo(): Promise<AppInfo>;
  /** Otevře soubor ve výchozí aplikaci Windows; prázdný řetězec = v pořádku, jinak chyba. */
  openFile(name: string, data: ArrayBuffer): Promise<string>;
  takeDeepLink(): Promise<string | null>;
  onDeepLink(callback: (url: string) => void): () => void;
}

declare global {
  interface Window {
    eldock?: EldockBridge;
  }
}

const TOKEN_KEY = "eldock.desktop.token";

const browserBridge: EldockBridge = {
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
    return { version: __APP_VERSION__, hostname: "prohlížeč", platform: "web", encrypted: false };
  },
  async openFile(name, data) {
    const url = URL.createObjectURL(new Blob([data]));
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

export const inElectron = typeof window !== "undefined" && Boolean(window.eldock);
export const bridge: EldockBridge = (typeof window !== "undefined" && window.eldock) || browserBridge;
