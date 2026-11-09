// Fáze 73: most mezi rozhraním a platformou – Windows (Electron, fáze 71), Android a iOS (Capacitor), prohlížeč
// (vývoj rozhraní, E2E v telefonním rozvržení). Rozhraní nevolá nativní API jinde než přes tento most.

import type { DurableBackup, SyncPlatformName, TokenStore } from "@/sync-client";

export type PlatformKind = "windows" | "android" | "ios" | "web";

export interface AppInfo {
  version: string;
  /** Výchozí název zařízení při párování („Windows – PC-HALA3“, „Android – Galaxy XCover7“). */
  deviceName: string;
  /** Název aplikace pro uživatele („Eldock pro Windows“). */
  label: string;
  /** Jak je chráněný token zařízení (Nastavení). */
  tokenProtection: string;
}

export interface NetworkWatch {
  connected(): Promise<boolean>;
  onChange(callback: (connected: boolean) => void): () => void;
}

export interface EldockBridge {
  kind: PlatformKind;
  /** Platforma při párování (`SyncDevice.platform`). */
  syncPlatform: SyncPlatformName;
  /** Mobilní aplikace (Android, iOS): nativní skener, fotoaparát, oznámení, zrcadlo fronty. */
  mobile: boolean;
  token: TokenStore;
  appInfo(): Promise<AppInfo>;
  /** Otevře soubor v systémové aplikaci; prázdný řetězec = v pořádku, jinak popis chyby. */
  openFile(name: string, data: Blob): Promise<string>;
  takeDeepLink(): Promise<string | null>;
  onDeepLink(callback: (url: string) => void): () => void;
  /** Nativní skener QR: text štítku, `null` = uživatel skenování zrušil. Bez něj kamera ve WebView (jsQR). */
  scanQr?: () => Promise<string | null>;
  /** Stav sítě (ve WebView Androidu `navigator.onLine` neplatí). */
  network?: NetworkWatch;
  /** Návrat aplikace do popředí. */
  onResume?: (callback: () => void) => () => void;
  /** Systémové tlačítko Zpět (Android). */
  onBack?: (callback: () => void) => () => void;
  /** Aplikace do pozadí (Zpět na úvodní obrazovce). */
  minimize?: () => Promise<void>;
  /** Zrcadlo fronty v souborech aplikace – data WebView smí systém (iOS) při nedostatku místa smazat. */
  backup?: DurableBackup;
  /** Připomenutí synchronizace: oznámení v daný čas, `null` = zrušit. */
  remindSync?: (at: Date | null) => Promise<void>;
  /** Požádá o povolení oznámení (po spárování); vrací, zda jsou povolená. */
  allowNotifications?: () => Promise<boolean>;
}
