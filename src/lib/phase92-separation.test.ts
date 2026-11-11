import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Fáze 92: dva oddělené produktové světy. Elektrikáři (`/panel-builder`, `/panel-builder/floorplan`) mají jen trenažér
// 2D půdorysu, tréninkové zakázky a taháky – nikdy průmyslovou správu závodů; výrobní závody (`/app`, `/plant/…`) mají
// jen průvodce závodem – nikdy bytové půdorysy ani Panel Builder.

const ROOT = path.join(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
/** Zdroj bez komentářů (komentáře smí vysvětlovat, co v kódu záměrně není). */
const read = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const ELECTRICIAN = [...files(path.join(ROOT, "app", "(pb)")), ...files(path.join(ROOT, "components", "panel-builder"))];
const INDUSTRY = [...files(path.join(ROOT, "app", "(app)")), ...files(path.join(ROOT, "components", "plant"))];
const PLANT_GUIDE = files(path.join(ROOT, "components", "plant"));
const TRAINERS = ["FloorplanSandboxTrainer", "FloorplanLiveChecklist", "FloorplanStartChoice", "PanelTrainerJobs", "PanelLiveChecklist"].map((name) => ELECTRICIAN.find((file) => path.basename(file).startsWith(name))!);

describe("fáze 92 – striktní oddělení světů", () => {
  it("svět elektrikářů nenačítá průvodce závodem ani nic ze Správy závodů", () => {
    for (const file of ELECTRICIAN) {
      const source = read(file);
      expect(source, path.relative(ROOT, file)).not.toMatch(/components\/plant\/|IndustrialPlantOnboarding|NightShiftMission|plant-onboarding/);
    }
  });

  it("trenažéry a taháky elektrikářů neodkazují do průmyslové části", () => {
    expect(TRAINERS.every(Boolean)).toBe(true);
    for (const file of TRAINERS) expect(read(file), path.basename(file)).not.toMatch(/["'`]\/(plant|app|studio|inspections|equipment)\b|závod/);
  });

  it("průmyslová část nenačítá trenažér půdorysu, tréninkové zakázky ani taháky Panel Builderu", () => {
    for (const file of INDUSTRY) {
      expect(read(file), path.relative(ROOT, file)).not.toMatch(/FloorplanSandboxTrainer|FloorplanLiveChecklist|PanelTrainerJobs|PanelLiveChecklist|floorplan-sandbox-preset|panel-trainer/);
    }
  });

  it("průvodce závodem neukazuje bytové půdorysy, byty ani domovní přístroje", () => {
    for (const file of [...PLANT_GUIDE, path.join(ROOT, "lib", "plant-onboarding.ts")]) {
      const source = read(file);
      expect(source, path.basename(file)).not.toMatch(/\/panel-builder|2D půdorys|bungalov|\bbyt\b|bytov|vypínač|zásuvk|Panel Builder/i);
    }
  });
});
