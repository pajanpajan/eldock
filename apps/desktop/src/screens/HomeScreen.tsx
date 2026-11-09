// Fáze 71: přehled – vyhledání zařízení (označení, název, výrobní číslo; čtečka čárových kódů píše sem),
// skenování QR štítku webkamerou, závody → budovy → patra a zařízení, která vyžadují pozornost.

import { AlertTriangle, Building2, ChevronRight, Layers, QrCode, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EQUIPMENT_TYPE_ICONS } from "@/lib/equipment-icons";
import { EQUIPMENT_TYPE_LABELS, formatCount } from "@/lib/format";
import { EQUIPMENT_STATUS, INSPECTION_STATE } from "@/lib/status";
import { cn } from "@/lib/utils";
import { parseScan, type EquipmentRecord, type FloorRecord } from "@/sync-client";

import type { Navigation } from "../App";
import { useAll } from "../data";
import { ScanDialog } from "../media";
import { Button, Empty, Section, Spinner, StatusBadge, inputClass } from "../ui";

import { byEquipment, equipmentFlags, equipmentSearchText, needsAttention, searchKey, type EquipmentFlags } from "./equipment-state";

const MAX_RESULTS = 200;

export function HomeScreen({ navigation }: { navigation: Navigation }) {
  const plants = useAll("Plant");
  const buildings = useAll("Building");
  const floors = useAll("Floor");
  const equipment = useAll("Equipment");
  const inspections = useAll("InspectionRecord");
  const defects = useAll("InspectionDefect");
  const mods = useAll("TemporaryModification");
  const [query, setQuery] = useState("");
  const [floorId, setFloorId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const flags = useMemo(() => {
    const now = new Date();
    const inspectionsBy = byEquipment(inspections);
    const defectsBy = byEquipment(defects);
    const modsBy = byEquipment(mods);
    return new Map((equipment ?? []).map((item) => [item.id, equipmentFlags(inspectionsBy.get(item.id) ?? [], defectsBy.get(item.id) ?? [], modsBy.get(item.id) ?? [], now)]));
  }, [equipment, inspections, defects, mods]);

  const floorById = useMemo(() => new Map((floors ?? []).map((floor) => [floor.id, floor])), [floors]);
  const buildingById = useMemo(() => new Map((buildings ?? []).map((building) => [building.id, building])), [buildings]);
  const locationOf = (item: EquipmentRecord) => {
    const floor = floorById.get(item.floorId);
    const building = floor ? buildingById.get(floor.buildingId) : undefined;
    return [building?.name, floor?.name].filter(Boolean).join(" · ");
  };

  const selectedFloor = floorId ? floorById.get(floorId) : undefined;
  const floorTitle = selectedFloor ? [buildingById.get(selectedFloor.buildingId)?.name, selectedFloor.name].filter(Boolean).join(" · ") : "";
  const sorted = useMemo(() => [...(equipment ?? [])].sort((a, b) => a.tag.localeCompare(b.tag, "cs", { numeric: true })), [equipment]);
  const key = searchKey(query.trim());
  const results = key ? sorted.filter((item) => equipmentSearchText(item).includes(key)) : floorId ? sorted.filter((item) => item.floorId === floorId) : [];
  const attention = sorted.filter((item) => {
    const itemFlags = flags.get(item.id);
    return itemFlags ? needsAttention(itemFlags) : false;
  });

  const openScan = (text: string) => {
    const scan = parseScan(text);
    if (scan.kind === "equipment") {
      const known = equipment?.some((item) => item.id === scan.equipmentId);
      if (!known) {
        toast.error("Zařízení ze štítku v datech tohoto zařízení není – patří jinému závodu, nebo ho váš účet nevidí. Zkuste synchronizovat.");
        return false;
      }
      navigation.open({ name: "equipment", id: scan.equipmentId, scannedToken: scan.qrToken });
      return true;
    }
    if (scan.kind === "pairing") {
      toast.info("To je kód pro spárování aplikace – otevřete Nastavení → Spárovat znovu.");
      return false;
    }
    const exact = sorted.filter((item) => searchKey(item.tag) === searchKey(scan.text));
    const matches = exact.length ? exact : sorted.filter((item) => equipmentSearchText(item).includes(searchKey(scan.text)));
    if (matches.length === 1) {
      navigation.open({ name: "equipment", id: matches[0].id });
      return true;
    }
    setQuery(scan.text);
    if (!matches.length) toast.warning(`Zařízení „${scan.text}“ nenalezeno.`);
    return false;
  };

  if (!equipment || !plants || !buildings || !floors) {
    return (
      <div className="p-6">
        <Spinner label="Načítám data závodu…" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 lg:flex-row">
      <aside className="space-y-3 lg:w-72 lg:shrink-0">
        {plants.length ? null : <Empty>Data závodu zatím nejsou stažená – připojte se k síti a synchronizujte.</Empty>}
        {[...plants]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((plant) => (
            <nav key={plant.id} className="space-y-2 rounded-xl border border-border bg-card p-3" aria-label={plant.name}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="size-4 text-primary" aria-hidden />
                {plant.name}
              </p>
              {buildings
                .filter((building) => building.plantId === plant.id)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
                .map((building) => (
                  <div key={building.id} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{building.name}</p>
                    {floors
                      .filter((floor) => floor.buildingId === building.id)
                      .sort((a, b) => a.level - b.level)
                      .map((floor) => (
                        <FloorButton key={floor.id} floor={floor} active={floor.id === floorId && !key} count={equipment.filter((item) => item.floorId === floor.id).length} onClick={() => {
                          setQuery("");
                          setFloorId(floor.id);
                        }} />
                      ))}
                  </div>
                ))}
            </nav>
          ))}
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) openScan(query);
          }}
        >
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              className={cn(inputClass, "h-12 pl-9 text-base")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hledat zařízení – označení, název, výrobní číslo… nebo naskenujte štítek čtečkou"
              aria-label="Hledat zařízení"
              autoFocus
              data-testid="search-input"
            />
          </label>
          <Button size="lg" onClick={() => setScanning(true)} data-testid="scan-open">
            <QrCode className="size-5" aria-hidden />
            Skenovat QR
          </Button>
        </form>

        {key || floorId ? (
          <Section title={key ? `Výsledky hledání (${results.length})` : floorTitle} icon={<Search className="size-4 text-primary" aria-hidden />}>
            {results.length ? <EquipmentList items={results.slice(0, MAX_RESULTS)} flags={flags} locationOf={locationOf} onOpen={(id) => navigation.open({ name: "equipment", id })} /> : <Empty>Žádné zařízení.</Empty>}
            {results.length > MAX_RESULTS ? <p className="text-xs text-muted-foreground">Zobrazeno prvních {MAX_RESULTS} – zpřesněte hledání.</p> : null}
          </Section>
        ) : null}

        <Section title={`Vyžaduje pozornost (${attention.length})`} icon={<AlertTriangle className="size-4 text-amber-400" aria-hidden />} testId="attention">
          {attention.length ? (
            <EquipmentList items={attention} flags={flags} locationOf={locationOf} onOpen={(id) => navigation.open({ name: "equipment", id })} />
          ) : (
            <Empty>Žádné zařízení s propadlou revizí, závadou nebo provizoriem po termínu.</Empty>
          )}
        </Section>
        <p className="text-xs text-muted-foreground">
          V zařízení: {formatCount(equipment.length, ["zařízení", "zařízení", "zařízení"])} ve {formatCount(floors.length, ["patře", "patrech", "patrech"])}.
        </p>
      </div>

      <ScanDialog
        open={scanning}
        onClose={() => setScanning(false)}
        onScan={(text) => {
          if (openScan(text)) setScanning(false);
        }}
      />
    </div>
  );
}

function FloorButton({ floor, active, count, onClick }: { floor: FloorRecord; active: boolean; count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm", active ? "bg-primary/15 text-primary" : "hover:bg-muted")} data-testid={`floor-${floor.id}`}>
      <span className="flex items-center gap-2">
        <Layers className="size-3.5" aria-hidden />
        {floor.name}
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

export function EquipmentList({ items, flags, locationOf, onOpen }: { items: EquipmentRecord[]; flags: Map<string, EquipmentFlags>; locationOf: (item: EquipmentRecord) => string; onOpen: (id: string) => void }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border" data-testid="equipment-list">
      {items.map((item) => {
        const Icon = EQUIPMENT_TYPE_ICONS[item.type];
        const itemFlags = flags.get(item.id);
        return (
          <li key={item.id}>
            <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60" onClick={() => onOpen(item.id)} data-testid={`equipment-${item.id}`}>
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono font-semibold">{item.tag}</span>
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {EQUIPMENT_TYPE_LABELS[item.type]} · {locationOf(item)}
                </span>
              </span>
              <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                {item.status !== "ACTIVE" ? <StatusBadge style={EQUIPMENT_STATUS[item.status]} /> : null}
                {itemFlags && itemFlags.inspection !== "VALID" && itemFlags.inspection !== "MISSING" ? <StatusBadge style={INSPECTION_STATE[itemFlags.inspection]} /> : null}
                {itemFlags?.openDefects ? <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">{formatCount(itemFlags.openDefects, ["závada", "závady", "závad"])}</span> : null}
                {itemFlags?.activeMods ? <span className={cn("rounded-full border px-2 py-0.5 text-xs", itemFlags.overdueMods ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300")}>{formatCount(itemFlags.activeMods, ["provizorium", "provizoria", "provizorií"])}</span> : null}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
