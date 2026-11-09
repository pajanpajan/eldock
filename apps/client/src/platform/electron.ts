// Fáze 71 a 73: aplikace pro Windows – API hlavního procesu z preloadu (electron/preload.ts → `window.eldock`).

import type { TokenStore } from "@/sync-client";

import type { EldockBridge } from "./types";

/** API preloadu Electronu (úzké – token DPAPI, otevření souboru, odkazy eldock://). */
export interface ElectronApi {
  token: TokenStore;
  appInfo(): Promise<{ version: string; hostname: string; platform: string; encrypted: boolean }>;
  openFile(name: string, data: ArrayBuffer): Promise<string>;
  takeDeepLink(): Promise<string | null>;
  onDeepLink(callback: (url: string) => void): () => void;
}

declare global {
  interface Window {
    eldock?: ElectronApi;
  }
}

export function electronBridge(api: ElectronApi): EldockBridge {
  return {
    kind: "windows",
    syncPlatform: "WINDOWS",
    mobile: false,
    token: api.token,
    async appInfo() {
      const info = await api.appInfo();
      return { version: info.version, deviceName: `Windows – ${info.hostname}`, label: "Eldock pro Windows", tokenProtection: info.encrypted ? "zašifrovaný systémem Windows (DPAPI)" : "systém neumí šifrovat (DPAPI)" };
    },
    async openFile(name, data) {
      return api.openFile(name, await data.arrayBuffer());
    },
    takeDeepLink: () => api.takeDeepLink(),
    onDeepLink: (callback) => api.onDeepLink(callback),
  };
}
