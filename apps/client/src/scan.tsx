// Fáze 73: skenování QR odkudkoli (přehled, spodní lišta telefonu, párování). Mobilní aplikace má nativní skener
// (offline), jinak dialog s kamerou ve WebView (jsQR) a ručním zadáním. Text štítku → zařízení, párování nebo hledání.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { parseScan, type EquipmentRecord } from "@/sync-client";

import type { Navigation } from "./App";
import { bridge } from "./bridge";
import { db } from "./db";
import { ScanDialog, type ScanHandler } from "./media";
import { equipmentSearchText, searchKey } from "./screens/equipment-state";

interface ScannerContextValue {
  /** Naskenuje štítek a předá text `handler`u (dialog s kamerou zůstane otevřený, dokud ho handler nepřijme). */
  scan: (handler: ScanHandler) => Promise<void>;
}

const ScannerContext = createContext<ScannerContextValue | null>(null);

export function ScannerProvider({ children }: { children: ReactNode }) {
  const [handler, setHandler] = useState<{ run: ScanHandler } | null>(null);
  const busy = useRef(false);

  const scan = useCallback(async (run: ScanHandler) => {
    if (busy.current) return;
    if (bridge.scanQr) {
      busy.current = true;
      try {
        const text = await bridge.scanQr();
        if (text) await run(text);
        return;
      } catch (problem) {
        // Nativní skener nejde (oprávnění, chyba fotoaparátu) – dialog s kamerou a ručním zadáním
        toast.error(problem instanceof Error ? problem.message : "Skener QR se nepodařilo spustit.");
      } finally {
        busy.current = false;
      }
    }
    setHandler({ run });
  }, []);

  const close = useCallback(() => setHandler(null), []);
  const onScan = useCallback(
    async (text: string) => {
      const accepted = handler ? await handler.run(text) : true;
      if (accepted) setHandler(null);
      return accepted;
    },
    [handler],
  );

  return (
    <ScannerContext.Provider value={{ scan }}>
      {children}
      <ScanDialog open={Boolean(handler)} onClose={close} onScan={onScan} />
    </ScannerContext.Provider>
  );
}

export function useScanner(): ScannerContextValue {
  const value = useContext(ScannerContext);
  if (!value) throw new Error("useScanner mimo ScannerProvider");
  return value;
}

/** Párovací odkaz z QR mimo obrazovku párování → Shell otevře párování (`eldock:pair-link`). */
export const PAIR_LINK_EVENT = "eldock:pair-link";

/**
 * Text štítku nebo čtečky → zařízení (QR štítek s ověřením, že ho zařízení zná), párování, nebo hledání podle
 * označení (jedna shoda = rovnou detail, jinak výsledky hledání na přehledu). `true` = vyřízeno (zavřít skener).
 */
export function useScanResolver(navigation: Navigation, onSearch?: (text: string) => void): ScanHandler {
  return useCallback(
    async (text: string) => {
      const scan = parseScan(text);
      if (scan.kind === "equipment") {
        const known = await db.records.get(["Equipment", scan.equipmentId]);
        if (!known) {
          toast.error("Zařízení ze štítku v datech tohoto zařízení není – patří jinému závodu, nebo ho váš účet nevidí. Zkuste synchronizovat.");
          return false;
        }
        navigation.open({ name: "equipment", id: scan.equipmentId, scannedToken: scan.qrToken });
        return true;
      }
      if (scan.kind === "pairing") {
        window.dispatchEvent(new CustomEvent(PAIR_LINK_EVENT, { detail: text }));
        return true;
      }
      const key = searchKey(scan.text);
      const equipment = (await db.records.where("entity").equals("Equipment").toArray()).map((record) => record.data as unknown as EquipmentRecord);
      const exact = equipment.filter((item) => searchKey(item.tag) === key);
      const matches = exact.length ? exact : equipment.filter((item) => equipmentSearchText(item).includes(key));
      if (matches.length === 1 && matches[0]) {
        navigation.open({ name: "equipment", id: matches[0].id });
        return true;
      }
      if (!matches.length) toast.warning(`Zařízení „${scan.text}“ nenalezeno.`);
      if (onSearch) onSearch(scan.text);
      else navigation.open({ name: "home", query: scan.text });
      return true;
    },
    [navigation, onSearch],
  );
}
