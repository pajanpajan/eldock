import { describe, expect, it } from "vitest";

import { DEVICE_SYNC_STATE } from "@/lib/status";
import {
  CLIENT_ID_PATTERN,
  PAIRING_ALPHABET,
  SYNC_MUTATION_LABELS,
  SYNC_PLATFORMS,
  SYNC_PLATFORM_LABELS,
  deviceSyncState,
  effectivePerformedAt,
  formatPairingCode,
  hoursSinceSync,
  normalizePairingCode,
  pairingCodeFrom,
  pairingUri,
} from "@/lib/sync";
import { SYNC_MUTATIONS } from "@/server/sync/mutations";

// Fáze 70: kód párování (Crockford Base32), obsah QR, stav synchronizace zařízení a čas provedení úpravy offline.

describe("kód párování", () => {
  it("8 znaků bez I, L, O, U; zobrazení po čtveřicích", () => {
    expect(PAIRING_ALPHABET).toHaveLength(32);
    expect(PAIRING_ALPHABET).not.toMatch(/[ILOU]/);
    const code = pairingCodeFrom(Uint8Array.from([0, 1, 31, 32, 255, 100, 10, 18]));
    // bajt & 31 → index abecedy (256 je násobek 32 → rovnoměrné rozdělení)
    expect(code).toBe("01Z0Z4AJ");
    expect(formatPairingCode("K7QX3MZP")).toBe("K7QX-3MZP");
    expect(() => pairingCodeFrom(new Uint8Array(4))).toThrow();
  });

  it("opsaný kód: malá písmena, mezery, pomlčky, O → 0, I / L → 1", () => {
    expect(normalizePairingCode(" k7qx-3mzp ")).toBe("K7QX3MZP");
    expect(normalizePairingCode("O0IL-ABCD")).toBe("0011ABCD");
    expect(normalizePairingCode("K7QX3MZ")).toBeNull();
    expect(normalizePairingCode("K7QX-3MZU")).toBeNull();
  });

  it("QR nese adresu serveru (cloud i server závodu) a kód", () => {
    expect(pairingUri("https://eldock.cz/", "K7QX-3MZP")).toBe("eldock://pair?server=https%3A%2F%2Feldock.cz&code=K7QX-3MZP");
    expect(pairingUri("http://192.168.1.20:3000", "AAAA-BBBB")).toContain("server=http%3A%2F%2F192.168.1.20%3A3000");
  });
});

describe("stav zařízení a čas provedení", () => {
  const now = new Date("2026-11-08T10:00:00Z");
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

  it("synchronizováno do 24 h, pak upozornění; 90 dní bez spojení = vypršelo", () => {
    expect(deviceSyncState({ lastSeenAt: now, lastPullAt: null }, now)).toBe("never");
    expect(deviceSyncState({ lastSeenAt: now, lastPullAt: hoursAgo(23) }, now)).toBe("ok");
    expect(deviceSyncState({ lastSeenAt: now, lastPullAt: hoursAgo(25) }, now)).toBe("stale");
    expect(deviceSyncState({ lastSeenAt: hoursAgo(91 * 24), lastPullAt: hoursAgo(91 * 24) }, now)).toBe("expired");
    expect(deviceSyncState({ revokedAt: now, lastSeenAt: now }, now)).toBe("revoked");
    expect(hoursSinceSync(hoursAgo(49.5).toISOString(), now)).toBe(49);
    expect(hoursSinceSync(null, now)).toBeNull();
    for (const state of ["never", "ok", "stale", "expired", "revoked"] as const) expect(DEVICE_SYNC_STATE[state].label.length).toBeGreaterThan(3);
  });

  it("čas z aplikace jen z posledních 30 dní a ne z budoucnosti", () => {
    expect(effectivePerformedAt("2026-11-07T06:30:00Z", now).toISOString()).toBe("2026-11-07T06:30:00.000Z");
    expect(effectivePerformedAt("2026-11-08T10:03:00Z", now)).toEqual(now);
    expect(effectivePerformedAt("2026-11-08T11:00:00Z", now)).toEqual(now);
    expect(effectivePerformedAt("2026-09-01T00:00:00Z", now)).toEqual(now);
    expect(effectivePerformedAt("včera", now)).toEqual(now);
    expect(effectivePerformedAt(null, now)).toEqual(now);
  });
});

describe("protokol", () => {
  it("každý druh úpravy má obsluhu a popisek, každá platforma popisek, id z aplikace mají formát", () => {
    expect(Object.keys(SYNC_MUTATIONS).sort()).toEqual(Object.keys(SYNC_MUTATION_LABELS).sort());
    for (const platform of SYNC_PLATFORMS) expect(SYNC_PLATFORM_LABELS[platform]).toBeTruthy();
    expect(CLIENT_ID_PATTERN.test("3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9b0a3e")).toBe(true);
    expect(CLIENT_ID_PATTERN.test("cmw81mulj0002pktxhelo6c7z")).toBe(true);
    expect(CLIENT_ID_PATTERN.test("kratke")).toBe(false);
    expect(CLIENT_ID_PATTERN.test("../../etc/passwd")).toBe(false);
  });
});
