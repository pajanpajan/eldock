// Fáze 73: výběr mostu podle prostředí – Electron (preload `window.eldock`), Capacitor (Android, iOS), prohlížeč.

import { Capacitor } from "@capacitor/core";

import { browserBridge } from "./browser";
import { electronBridge } from "./electron";
import { nativeBridge } from "./native";
import type { EldockBridge } from "./types";

export * from "./types";
export type { ElectronApi } from "./electron";

export const bridge: EldockBridge = typeof window !== "undefined" && window.eldock ? electronBridge(window.eldock) : Capacitor.isNativePlatform() ? nativeBridge() : browserBridge;

export const inElectron = bridge.kind === "windows";

/** Dotykové ovládání (mobilní aplikace nebo telefon v prohlížeči): bez automatického fokusu, fotky fotoaparátem. */
export const touchUi = bridge.mobile || (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches);
