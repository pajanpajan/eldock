import { describe, expect, it } from "vitest";

import { findPlcSignal, phaseReport, traceConnection, wireLabel } from "./panel-diagnostics";
import { buildPanelModel, parseXref, xref } from "./panel-model";

const model = buildPanelModel({
  tag: "R-CNC-04",
  name: "R-CNC-04 - Rozváděč CNC pracoviště",
  ratedCurrent: "125 A",
  plantCode: "JBC",
  buildingCode: "A",
  floorCode: "1NP",
  feeds: [{ tag: "CNC-04", name: "CNC-04 - Obráběcí centrum DMG", type: "CNC_MACHINE" }],
  revision: { version: "v1.2", date: "2025-06-01", author: "Ing. Tomáš Krejčí" },
});

describe("buildPanelModel", () => {
  it("je deterministický a označuje dle ISO/IEC 81346", () => {
    expect(buildPanelModel({ tag: "R-CNC-04", name: "x", ratedCurrent: "125 A", plantCode: "JBC", buildingCode: "A", floorCode: "1NP" }).phaseLoad).toEqual(
      buildPanelModel({ tag: "R-CNC-04", name: "x", ratedCurrent: "125 A", plantCode: "JBC", buildingCode: "A", floorCode: "1NP" }).phaseLoad,
    );
    expect(model.refs.full).toBe("=JBC+A1NP-R-CNC-04");
    expect(model.sheets).toHaveLength(6);
    expect(model.sheets[4]).toMatchObject({ number: 5, scale: "1:5", pageRef: "=JBC/+A1NP/-R-CNC-04/5" });
    expect(model.devices.map((device) => device.tag)).toEqual(expect.arrayContaining(["-Q1", "-F1", "-F2", "-F3", "-F12", "-K1", "-X1"]));
    expect(model.feeders).toHaveLength(10);
    expect(model.feeders[0]).toMatchObject({ device: "-F3", phases: ["L1", "L2", "L3"], target: { tag: "CNC-04" } });
  });

  it("má kabel -W1 se žilami BK, BN, GY, GNYE k motoru -M1", () => {
    const cores = model.wires.filter((wire) => wire.cable?.tag === "-W1").map((wire) => [wire.from.pin, wire.cable!.core, wire.to.device]);
    expect(cores).toEqual([
      ["U", "BK", "-M1"],
      ["V", "BN", "-M1"],
      ["W", "GY", "-M1"],
      ["PE", "GNYE", "-M1"],
    ]);
  });

  it("křížové odkazy /list.sloupec", () => {
    expect(xref(4, 6)).toBe("/4.6");
    expect(parseXref("/3.4")).toEqual({ sheet: 3, column: 4 });
    expect(parseXref("3.9x")).toBeNull();
  });
});

describe("diagnostika", () => {
  it("propípávač najde svorku X1:U, X2:5, vodič 18, pomocný kontakt -Q1:13 a přístroj -S1", () => {
    const u = traceConnection(model, "x1:u");
    expect(u.map((hit) => wireLabel(hit.wire))).toEqual(["-Q3:2 → -X1:U", "-X1:U → -M1:U1"]);
    expect(u[1]).toMatchObject({ xref: "/3.5", wire: { potential: "L1", cable: { tag: "-W1", core: "BK" } } });
    expect(traceConnection(model, "X2:5").map((hit) => wireLabel(hit.wire))).toEqual(["-X2:5 → -K1:DI0", "-S1:14 → -X2:5"]);
    expect(traceConnection(model, "18")).toHaveLength(1);
    expect(traceConnection(model, "-Q1:13")[0]).toMatchObject({ matched: "from", xref: "/4.3" });
    expect(traceConnection(model, "-S1")).toHaveLength(2);
    expect(traceConnection(model, "W1")).toHaveLength(4);
    expect(traceConnection(model, "nesmysl!")).toEqual([]);
  });

  it("hledač PLC: adresa, kanál, slot, signál i popis", () => {
    expect(findPlcSignal(model, "1.00")[0]).toMatchObject({ channel: "DO0", kind: "Relay", endDevice: ">-Q3:A1" });
    expect(findPlcSignal(model, "DI0")[0]).toMatchObject({ signal: "ENDSTOP_UP", terminal: "X0.0", card: "-K1", endDevice: ">+1.10.3/>-S1", kind: "Sink", column: 2 });
    expect(findPlcSignal(model, "do2")[0].signal).toBe("ALARM_ON_1");
    expect(findPlcSignal(model, "ALARM_ON_1")[0].channel).toBe("DO2");
    expect(findPlcSignal(model, "Endstop UP")[0].channel).toBe("DI0");
    expect(findPlcSignal(model, "001.001.001.001")).toHaveLength(8);
    expect(findPlcSignal(model, "AI0")[0].kind).toBe("4-20mA");
  });

  it("kalkulačka fází doporučí nejméně zatíženou fázi a přičte nový okruh", () => {
    const report = phaseReport(model);
    expect(report.rows.map((row) => row.phase)).toEqual(["L1", "L2", "L3", "N"]);
    expect(report.lightest).toBe("L3");
    expect(report.recommendation).toMatch(/^💡 Nejmenší zatížení je na fázi L3 \(rezerva [\d,]+ A\)\. Nový jednofázový okruh připojte na L3\.$/);
    const withExtra = phaseReport(model, 10);
    expect(withExtra.rows[2].amps).toBeCloseTo(report.rows[2].amps + 10, 1);
    expect(withExtra.thermal.internalC).toBeGreaterThanOrEqual(report.thermal.internalC);
    expect(report.thermal.advice).toMatch(/^(✅|⚠️|🔥)/);
  });
});
