import { describe, expect, it } from "vitest";

import { buildDigestEmail, daysLabel, digestBucket, groupDigest, type DigestItem } from "./inspection-digest";

const item = (tag: string, daysLeft: number): DigestItem => ({
  id: `eq-${tag.toLowerCase()}`,
  tag,
  name: `${tag} - Zařízení <${tag}>`,
  location: "Hala A › 1. NP",
  validUntil: new Date("2026-11-15T00:00:00Z"),
  daysLeft,
});

describe("souhrnné avízo lhůt", () => {
  it("rozdělí zařízení podle lhůty", () => {
    expect(digestBucket(-1)).toBe("overdue");
    expect(digestBucket(0)).toBe("within14");
    expect(digestBucket(14)).toBe("within14");
    expect(digestBucket(30)).toBe("within30");
    expect(digestBucket(31)).toBeNull();
    const groups = groupDigest([item("B", 20), item("A", -5), item("C", 3), item("D", 90), item("E", -30)]);
    expect(groups.overdue.map((entry) => entry.tag)).toEqual(["E", "A"]);
    expect(groups.within14.map((entry) => entry.tag)).toEqual(["C"]);
    expect(groups.within30.map((entry) => entry.tag)).toEqual(["B"]);
  });

  it("popisky dnů skloňuje česky", () => {
    expect(daysLabel(-1)).toBe("1 den po termínu");
    expect(daysLabel(0)).toBe("končí dnes");
    expect(daysLabel(3)).toBe("zbývá 3 dny");
    expect(daysLabel(12)).toBe("zbývá 12 dní");
  });

  it("e-mail obsahuje prokliky do plánovače a escapuje text", () => {
    const email = buildDigestEmail({ plantName: "Závod Jablonec", items: [item("RH1", -2), item("SP-1", 10), item("X", 120)], origin: "https://eldock.cz", now: new Date("2026-10-30T08:00:00Z") });
    expect(email.itemCount).toBe(2);
    expect(email.subject).toContain("2 zařízení vyžadují revizi – Závod Jablonec");
    expect(email.html).toContain('href="https://eldock.cz/inspections/planner"');
    expect(email.html).toContain('href="https://eldock.cz/equipment/eq-rh1"');
    expect(email.html).toContain("Zařízení &lt;RH1&gt;");
    expect(email.html).not.toContain("eq-x");
    expect(email.text).toContain("Plánovač revizí: https://eldock.cz/inspections/planner");
  });

  it("bez ohrožených zařízení pošle klidovou zprávu", () => {
    const email = buildDigestEmail({ plantName: "Závod", items: [item("A", 200)], origin: "https://eldock.cz", now: new Date() });
    expect(email.itemCount).toBe(0);
    expect(email.subject).toContain("všechny revize v pořádku");
  });
});
