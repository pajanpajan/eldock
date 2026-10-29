import { describe, expect, it } from "vitest";

import { checkAccessPassword, safeNextPath, signAuthToken, verifyAuthToken } from "./auth";

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
    expect(await checkAccessPassword("digitry2026", "digitry2026")).toBe(true);
    expect(await checkAccessPassword("digitry2025", "digitry2026")).toBe(false);
    expect(safeNextPath("/equipment/eq-rm1")).toBe("/equipment/eq-rm1");
    expect(safeNextPath("//evil.example")).toBeUndefined();
    expect(safeNextPath("https://evil.example")).toBeUndefined();
    expect(safeNextPath("/login")).toBeUndefined();
  });
});
