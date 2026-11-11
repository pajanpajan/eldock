"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CABLE_STATUS } from "@/lib/cable-sizing";
import { PC_HEIGHT, PC_WIDTH } from "@/lib/mock-graphics/pcschematic";
import { MISSION_BACKUPS, MISSION_BUILDINGS, MISSION_LOGBOOK, MISSION_MACHINE, MISSION_PANEL, MISSION_SECONDS, MISSION_TASKS, missionAssessment, missionSimulation, type MissionTaskId } from "@/lib/plant-onboarding";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const strokeLength = (points: readonly Point[]) => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);

/**
 * Fáze 92: 90s interaktivní mise „Noční porucha linky“ pro údržbu nad vzorovým závodem. Nic neukládá – ukazuje skutečné
 * výpočty Eldocku: kniha PCSCHEMATIC rozváděče (`renderPanelSheetSvg`), klasifikace zásahu dle Nařízení (EU) 2023/1230
 * podle F-Signature zálohy a simulátor připojení nového stroje (`simulateAddedLoad`).
 */
export function NightShiftMission({ canAudit, canBuild, onBuild }: { canAudit: boolean; canBuild: boolean; onBuild: () => void }) {
  const [done, setDone] = useState<Record<MissionTaskId, boolean>>({ locate: false, redline: false, backup: false, simulate: false });
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const current = MISSION_TASKS.find((task) => !done[task.id])?.id ?? null;
  const count = MISSION_TASKS.filter((task) => done[task.id]).length;
  const complete = (id: MissionTaskId) =>
    setDone((value) => {
      const next = { ...value, [id]: true };
      if (MISSION_TASKS.every((task) => next[task.id])) setFinishedAt((at) => at ?? Date.now());
      return next;
    });

  useEffect(() => {
    if (finishedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [finishedAt]);
  const seconds = Math.floor(((finishedAt ?? now) - started) / 1000);

  return (
    <div className="flex flex-col gap-3" data-testid="onboarding-mission" data-done={count} data-current={current ?? "done"}>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm">
        <span className="font-semibold">🚨 Noční směna · {MISSION_MACHINE.building}</span>
        <span className={cn("ml-auto rounded-full px-2.5 py-0.5 font-mono text-xs tabular-nums", seconds > MISSION_SECONDS ? "bg-amber-400/15 text-amber-200" : "bg-red-500/15 text-red-200")} data-testid="mission-clock">
          ⏱ {clock(seconds)} / {clock(MISSION_SECONDS)}
        </span>
        <span className="font-mono text-xs">{count}/4</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ol className="flex flex-col gap-1.5">
          {MISSION_TASKS.map((task) => (
            <li key={task.id} className={cn("rounded-lg border p-2 text-xs", current === task.id ? "border-red-400/70 bg-red-500/10" : done[task.id] ? "border-emerald-500/40" : "border-border text-muted-foreground")} data-testid={`mission-task-${task.step}`} data-state={done[task.id] ? "done" : current === task.id ? "current" : "todo"}>
              <p className="flex items-center gap-1.5 font-semibold">
                {done[task.id] ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-label="splněno" /> : <Circle className="size-4 shrink-0" aria-label="čeká" />}
                Úkol {task.step}/4 · {task.time}
              </p>
              <p className="mt-0.5 font-medium">{task.title}</p>
              {current === task.id ? <p className="mt-1 leading-snug text-muted-foreground">{task.instruction}</p> : null}
            </li>
          ))}
        </ol>
        <div className="min-w-0 rounded-xl border border-border bg-background/60 p-3">
          {current === "locate" ? <LocateScreen onDone={() => complete("locate")} /> : null}
          {current === "redline" ? <RedlineScreen onDone={() => complete("redline")} /> : null}
          {current === "backup" ? <BackupScreen onDone={() => complete("backup")} /> : null}
          {current === "simulate" ? <SimulateScreen canAudit={canAudit} onDone={() => complete("simulate")} /> : null}
          {current === null ? (
            <div className="flex flex-col items-start gap-3 text-sm" data-testid="mission-finished">
              <p className="text-lg font-semibold">🏁 Mise splněna za {clock(seconds)}</p>
              <p className="text-muted-foreground">
                Stroj jste našli z mapy nebo QR kódu, změnu zakreslili do schématu (ranní směna i CAE projektant ji vidí), zálohu PLC máte s vyhodnocením dle Nařízení (EU) 2023/1230 a víte, že nový 60kW stroj potřebuje kontrolu přívodu. Kniha revizí je připravená pro TIČR / SÚIP.
              </p>
              {canBuild ? (
                <Button type="button" onClick={onBuild} data-testid="mission-build">
                  🏗️ Teď postavit náš vlastní závod a první stroj
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LocateScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">2D mapa závodu – {MISSION_MACHINE.building} hlásí výpadek</p>
      <svg viewBox="0 0 100 92" className="w-full rounded-lg border border-border bg-zinc-950" role="img" aria-label="Mapa vzorového závodu" data-testid="mission-map">
        <rect x="1" y="1" width="98" height="90" fill="none" stroke="#3f3f46" strokeWidth="0.6" strokeDasharray="2 1.5" />
        {MISSION_BUILDINGS.map((building) => (
          <g key={building.id}>
            <rect x={building.x} y={building.y} width={building.w} height={building.h} rx="1.2" fill={building.alarm ? "rgba(239,68,68,0.12)" : "rgba(63,63,70,0.45)"} stroke={building.alarm ? "#ef4444" : "#52525b"} strokeWidth={building.alarm ? 0.9 : 0.5}>
              {building.alarm ? <animate attributeName="stroke-opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite" /> : null}
            </rect>
            <text x={building.x + 1.5} y={building.y + 4} fontSize="2.6" fill="#e4e4e7" fontWeight={700}>
              {building.code} · {building.name}
            </text>
          </g>
        ))}
        {/* Vypadlý stroj v lisovně – pulz je jen dekorace (klikací plocha se nehýbe), klik = otevře kartu stroje */}
        <circle cx="26" cy="30" r="4.5" fill="#ef4444" opacity="0.35" pointerEvents="none">
          <animate attributeName="r" values="3.6;6;3.6" dur="1s" repeatCount="indefinite" />
        </circle>
        <g role="button" tabIndex={0} aria-label={`Rozváděč ${MISSION_MACHINE.board} a stroj ${MISSION_MACHINE.tag} – výpadek`} onClick={onDone} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onDone()} className="cursor-pointer" data-testid="mission-machine-pin">
          <circle cx="26" cy="30" r="3.8" fill="#ef4444" />
          <text x="26" y="31" fontSize="2.6" textAnchor="middle" fill="#fff" fontWeight={800}>
            !
          </text>
          <text x="26" y="38" fontSize="2.4" textAnchor="middle" fill="#fecaca" fontWeight={700}>
            {MISSION_MACHINE.board} → {MISSION_MACHINE.tag}
          </text>
        </g>
      </svg>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onDone} data-testid="mission-scan-qr">
          <Smartphone className="size-4" aria-hidden /> 📱 Simulovat načtení QR kódu mobilem
        </Button>
        <span className="text-xs text-muted-foreground">QR štítek na rozváděči otevře kartu stroje i bez přihlašování k PC v hale.</span>
      </div>
    </div>
  );
}

function RedlineScreen({ onDone }: { onDone: () => void }) {
  const [sheet, setSheet] = useState<string | null>(null);
  const [pen, setPen] = useState(false);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [live, setLive] = useState<Point[] | null>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const [sent, setSent] = useState(false);

  // Kniha PCSCHEMATIC rozváděče lisu (list 3 – silové schéma motorového vývodu) – stejný generátor jako karta zařízení
  useEffect(() => {
    let alive = true;
    void Promise.all([import("@/lib/panel-model"), import("@/lib/mock-graphics/pcschematic")]).then(([model, render]) => {
      if (alive) setSheet(render.renderPanelSheetSvg(model.buildPanelModel(MISSION_PANEL), 3));
    });
    return () => {
      alive = false;
    };
  }, []);

  const at = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = overlay.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * PC_WIDTH, y: ((event.clientY - rect.top) / rect.height) * PC_HEIGHT };
  };
  const finish = () => {
    const stroke = live;
    setLive(null);
    if (!stroke || stroke.length < 2) return;
    setStrokes((value) => [...value, stroke]);
    if (strokeLength(stroke) >= 60 && !sent) {
      setSent(true);
      window.setTimeout(onDone, 1200);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b>
          {MISSION_MACHINE.tag} · {MISSION_MACHINE.name}
        </b>
        <span className="text-xs text-red-300">{MISSION_MACHINE.fault}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="rounded-md bg-primary px-2 py-1 font-semibold text-primary-foreground">Schéma</span>
        <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">Kusovník</span>
        <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">💾 Software & Zálohy PLC</span>
        <Button type="button" size="sm" variant={pen ? "default" : "outline"} className={cn("ml-auto h-7 gap-1 text-xs", pen ? "bg-red-600 text-white hover:bg-red-500" : "border-red-500/70 text-red-200")} onClick={() => setPen((value) => !value)} aria-pressed={pen} data-testid="mission-redline">
          ✏️ Červenka
        </Button>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border bg-white" style={{ aspectRatio: `${PC_WIDTH} / ${PC_HEIGHT}` }}>
        {sheet ? (
          // Vlastní SVG z čisté funkce (vzorová data mise, texty escapované generátorem)
          <div className="absolute inset-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: sheet }} data-testid="mission-sheet" />
        ) : (
          <p className="flex h-full items-center justify-center gap-2 text-sm text-zinc-600">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Načítám schéma {MISSION_MACHINE.board}…
          </p>
        )}
        <svg
          ref={overlay}
          viewBox={`0 0 ${PC_WIDTH} ${PC_HEIGHT}`}
          preserveAspectRatio="none"
          className={cn("absolute inset-0 size-full touch-none", pen ? "cursor-crosshair" : "pointer-events-none")}
          onPointerDown={(event) => {
            if (!pen) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setLive([at(event)]);
          }}
          onPointerMove={(event) => {
            if (!live) return;
            const point = at(event);
            setLive((value) => (value ? [...value, point] : value));
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          data-testid="mission-canvas"
        >
          {[...strokes, ...(live ? [live] : [])].map((stroke, index) => (
            <polyline key={index} points={stroke.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#dc2626" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      </div>
      {sent ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm" data-testid="mission-redline-sent">
          📨 Červenka uložena ke stroji {MISSION_MACHINE.tag} – ranní směna ji uvidí na kartě stroje a CAE projektant dostane požadavek na úpravu výkresu.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{pen ? "Zakreslete červeně do výkresu, co jste přepojili (např. zakroužkujte svorku -X1:14)." : "Zapněte ✏️ Červenka a kreslete přímo do schématu."}</p>
      )}
    </div>
  );
}

function BackupScreen({ onDone }: { onDone: () => void }) {
  const assessment = useMemo(() => missionAssessment(), []);
  return (
    <div className="flex flex-col gap-2 text-sm" data-testid="mission-backups">
      <p className="font-semibold">💾 Software & Zálohy PLC – {MISSION_MACHINE.tag}</p>
      <ul className="flex flex-col gap-1">
        {MISSION_BACKUPS.map((backup) => (
          <li key={`${backup.unit}-${backup.version}`} className="rounded-lg border border-border px-2 py-1.5 text-xs">
            <span className="font-mono font-semibold">{backup.version}</span> · {backup.unit} · {backup.platform} · {backup.date} · {backup.author}
            <span className="block text-muted-foreground">
              {backup.summary}
              {backup.checksum ? ` · ${backup.checksum}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className={cn("rounded-lg border-2 px-3 py-2", assessment.substantial ? "border-red-500 bg-red-500/10" : "border-emerald-500 bg-emerald-500/10")} data-testid="mission-assessment" data-level={assessment.level}>
        <p className="font-semibold">Hlídač legislativy – Nařízení (EU) 2023/1230: {assessment.label}</p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          {assessment.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      <Button type="button" className="w-fit" onClick={onDone} data-testid="mission-backup-ok">
        ✓ Zkontrolováno – zásah není podstatnou změnou stroje
      </Button>
    </div>
  );
}

function SimulateScreen({ canAudit, onDone }: { canAudit: boolean; onDone: () => void }) {
  const [simulation, setSimulation] = useState<ReturnType<typeof missionSimulation> | null>(null);
  const [book, setBook] = useState(false);
  // Hotovo, až je spuštěný simulátor i otevřená Kniha revizí – jednorázově z kliknutí (časomíra mise překresluje každých 500 ms)
  const finish = () => window.setTimeout(onDone, 1500);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="mission-simulator">
        <p className="font-semibold">🧪 Simulátor zátěže – nový lis 60 kW do rozváděče {MISSION_MACHINE.board}</p>
        {simulation ? (
          <>
            <p className="text-xs text-muted-foreground">Přírůstek {simulation.addedA.toLocaleString("cs-CZ")} A (3 × 400 V, cos φ 0,9) kaskádou kabel → hlavní rozváděč → trafostanice (soudobost 0,8).</p>
            <ul className="flex flex-col gap-1" data-testid="mission-simulation">
              {simulation.rows.map((row) => (
                <li key={row.id} className={cn("rounded-md border px-2 py-1 text-xs", row.status === "CRITICAL" ? "border-red-500/60 bg-red-500/10" : row.status === "WARNING" ? "border-amber-400/60 bg-amber-400/10" : "border-emerald-500/40")} data-status={row.status}>
                  {CABLE_STATUS[row.status].emoji} <b>{row.label}</b> · {row.beforeA.toLocaleString("cs-CZ")} A → {row.afterA.toLocaleString("cs-CZ")} A z {row.capacityA.toLocaleString("cs-CZ")} A ({row.afterPercent.toLocaleString("cs-CZ")} %)
                  {row.recommendedMm2 ? ` · doporučený průřez ${row.recommendedMm2} mm²` : ""}
                </li>
              ))}
            </ul>
            <p className="text-xs font-semibold">{simulation.ok ? "✅ Stávající trasa nový stroj unese." : "⚠️ Stávající trasa nový stroj neunese – posilte přívod nebo stroj napojte z jiného rozváděče."}</p>
          </>
        ) : (
          <Button
            type="button"
            className="w-fit"
            onClick={() => {
              setSimulation(missionSimulation(60));
              if (book) finish();
            }}
            data-testid="mission-simulate"
          >
            Simulovat připojení 60kW stroje jedním klikem
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        {book ? (
          <>
            <p className="font-semibold">📗 Kniha revizí – připravená pro kontrolu TIČR / SÚIP</p>
            <table className="w-full text-left text-xs" data-testid="mission-logbook">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Zařízení</th>
                  <th className="py-1 pr-2">Revize</th>
                  <th className="py-1 pr-2">Poslední / příští</th>
                  <th className="py-1">Stav</th>
                </tr>
              </thead>
              <tbody>
                {MISSION_LOGBOOK.map((row) => (
                  <tr key={row.tag} className="border-t border-border">
                    <td className="py-1 pr-2">
                      <b className="font-mono">{row.tag}</b> {row.name}
                    </td>
                    <td className="py-1 pr-2">{row.kind}</td>
                    <td className="py-1 pr-2">
                      {row.last} / {row.next}
                    </td>
                    <td className={cn("py-1", row.state === "Platná" ? "text-emerald-300" : "text-amber-200")}>{row.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canAudit ? (
              <Link href="/inspections/audit-report" className="w-fit text-xs text-primary underline-offset-2 hover:underline">
                Otevřít Knihu revizí vašeho závodu →
              </Link>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => {
              setBook(true);
              if (simulation) finish();
            }}
            data-testid="mission-logbook-open"
          >
            📗 Otevřít Knihu revizí
          </Button>
        )}
      </div>
    </div>
  );
}
