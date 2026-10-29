import { afterEach, describe, expect, it, vi } from "vitest";

import { accessPassword, checkAccessPassword, isAuthBypassed, safeNextPath, signAuthToken, verifyAuthToken } from "./auth";

const secret = "test-secret";
const now = Date.UTC(2026, 9, 29, 8, 0, 0);

describe("auth token", () => {
  it("podepíše a ověří token s id účtu", async () => {
    const token = await signAuthToken("acc-dvorak", { now, secret, ttl: 3600 });
    expect(token).toMatch(/^acc-dvorak\.\d+\.[A-Za-z0-9_-]+$/);
    expect(await verifyAuthToken(token, { now, secret })).toEqual({ userId: "acc-dvorak", expires: now / 1000 + 3600 });
  });

  it("odmítne prošlý, pozměněný nebo cizím tajemstvím podepsaný token", async () => {
    const token = await signAuthToken("acc-dvorak", { now, secret, ttl: 60 });
    expect(await verifyAuthToken(token, { now: now + 61_000, secret })).toBeNull();
    expect(await verifyAuthToken(token.replace("acc-dvorak", "acc-krejci"), { now, secret })).toBeNull();
    expect(await verifyAuthToken(token, { now, secret: "jine" })).toBeNull();
    expect(await verifyAuthToken("nesmysl", { now, secret })).toBeNull();
    expect(await verifyAuthToken(undefined, { now, secret })).toBeNull();
  });

  it("porovná heslo a pustí jen interní cíl přesměrování", async () => {
    expect(await checkAccessPassword("eldock2026", "eldock2026")).toBe(true);
    expect(await checkAccessPassword("eldock2025", "eldock2026")).toBe(false);
    expect(safeNextPath("/equipment/eq-rm1")).toBe("/equipment/eq-rm1");
    expect(safeNextPath("//evil.example")).toBeUndefined();
    expect(safeNextPath("https://evil.example")).toBeUndefined();
    expect(safeNextPath("/login")).toBeUndefined();
  });
});

describe("proměnné prostředí ELDOCK_* (fallback DIGITRY_*)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ELDOCK_ má přednost, DIGITRY_ funguje jako záloha, jinak výchozí heslo", () => {
    vi.stubEnv("ELDOCK_ACCESS_PASSWORD", "");
    vi.stubEnv("DIGITRY_ACCESS_PASSWORD", "");
    expect(accessPassword()).toBe("eldock2026");
    vi.stubEnv("DIGITRY_ACCESS_PASSWORD", "stare-heslo");
    expect(accessPassword()).toBe("stare-heslo");
    vi.stubEnv("ELDOCK_ACCESS_PASSWORD", "nove-heslo");
    expect(accessPassword()).toBe("nove-heslo");
    vi.stubEnv("DIGITRY_BYPASS_AUTH", "1");
    expect(isAuthBypassed()).toBe(true);
  });
});
