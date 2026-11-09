// Fáze 71: detail zařízení offline – údaje a fotka, revize, závady, provizoria, požadavky na změnu s historií,
// dokumentace (otevření souboru z mezipaměti), sledované součástky a kusovník; úpravy podle oprávnění účtu.

import { ArrowLeft, BookOpen, Camera, ClipboardList, Cog, FileText, History, Image as ImageIcon, MessageSquarePlus, PencilLine, ShieldAlert, Timer, TriangleAlert, Wrench } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { defectState } from "@/lib/defects";
import { categoryLabel } from "@/lib/equipment-documents";
import { COMPLIANCE_CATEGORY_LABELS, EQUIPMENT_TYPE_LABELS, INSPECTION_TYPE_LABELS, formatDate, formatDateTime } from "@/lib/format";
import { formatQrToken } from "@/lib/qr-label";
import { CHANGE_REQUEST_EVENT, CHANGE_REQUEST_STATUS, DEFECT_SEVERITY, DEFECT_STATE, EQUIPMENT_STATUS, INSPECTION_RESULT, INSPECTION_STATE, TEMP_MOD_OVERDUE, TEMP_MOD_STATUS } from "@/lib/status";
import type { SyncMutationType } from "@/lib/sync";
import { canMutate } from "@/lib/sync-mutations";
import { tempModCountdown } from "@/lib/temporary-mod";
import { OPEN_STATUSES } from "@/lib/workflow/state-machine";
import { labelState, type ChangeRequestRecord } from "@/sync-client";

import type { Navigation } from "../App";
import { bridge } from "../bridge";
import { useAll, useChildren, useFileUrl, useOutbox, useRecord } from "../data";
import { useSync } from "../sync";
import { Button, Empty, Fact, Section, Spinner, StatusBadge } from "../ui";

import { ChangeRequestDialog, CommentDialog, EquipmentPhotoDialog, ReplaceComponentDialog, ResolveDefectDialog, RestoreDialog, TemporaryModDialog } from "./actions";
import { equipmentFlags, latestInspection } from "./equipment-state";

type Action =
  | { kind: "change" }
  | { kind: "comment"; request: ChangeRequestRecord }
  | { kind: "tempMod" }
  | { kind: "restore"; id: string }
  | { kind: "defect"; id: string }
  | { kind: "component"; id: string }
  | { kind: "photo" };

const byDateDesc = <T,>(key: keyof T) => (a: T, b: T) => String(b[key]).localeCompare(String(a[key]));

/** Otevře dokument z mezipaměti (offline) nebo ho stáhne; výchozí aplikace Windows. */
function useOpenFile() {
  const { engine } = useSync();
  return async (url: string, name: string) => {
    const blob = await engine.fileBlob(url);
    if (!blob) return void toast.error("Soubor v zařízení není – připojte se k síti a synchronizujte.");
    const extension = url.split("?")[0]?.split(".").pop() ?? "";
    const fileName = /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${name}${extension ? `.${extension}` : ""}`;
    const problem = await bridge.openFile(fileName, await blob.arrayBuffer());
    if (problem) toast.error(`Soubor se nepodařilo otevřít: ${problem}`);
  };
}

function FileButton({ url, name, label = "Otevřít" }: { url: string; name: string; label?: string }) {
  const open = useOpenFile();
  const [busy, setBusy] = useState(false);
  if (!url) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      busy={busy}
      onClick={() => {
        setBusy(true);
        void open(url, name).finally(() => setBusy(false));
      }}
    >
      <FileText className="size-4" aria-hidden />
      {label}
    </Button>
  );
}

function Photo({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  const src = useFileUrl(url);
  if (!url) return null;
  return src ? <img src={src} alt={alt} className={className} /> : <div className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className ?? ""}`}>Fotka není v zařízení</div>;
}

export function EquipmentScreen({ id, scannedToken, navigation }: { id: string; scannedToken: string | null; navigation: Navigation }) {
  const { status } = useSync();
  const equipment = useRecord("Equipment", id);
  const floor = useRecord("Floor", equipment?.floorId);
  const building = useRecord("Building", floor?.buildingId);
  const plant = useRecord("Plant", building?.plantId);
  const inspections = useChildren("InspectionRecord", id);
  const defects = useChildren("InspectionDefect", id);
  const mods = useChildren("TemporaryModification", id);
  const requests = useChildren("ChangeRequest", id);
  const revisions = useChildren("DocumentRevision", id);
  const compliance = useChildren("ComplianceDocument", id);
  const documents = useChildren("EquipmentDocument", id);
  const software = useChildren("SoftwareBackup", id);
  const components = useChildren("MonitoredComponent", id);
  const users = useAll("User");
  const outbox = useOutbox();
  const [action, setAction] = useState<Action | null>(null);

  const permissions = status?.user?.permissions ?? [];
  const can = (type: SyncMutationType) => canMutate(type, permissions);
  const userName = useMemo(() => new Map((users ?? []).map((user) => [user.id, user.name])), [users]);
  const activeRevision = revisions?.find((revision) => revision.status === "ACTIVE") ?? null;
  const pending = (outbox ?? []).filter((item) => item.equipmentId === id && item.status !== "applied");

  if (equipment === undefined) return <div className="p-6"><Spinner label="Načítám…" /></div>;
  if (equipment === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Button variant="ghost" onClick={navigation.back}>
          <ArrowLeft className="size-4" aria-hidden />
          Zpět
        </Button>
        <Empty>Zařízení v tomto zařízení není – patří jinému závodu, váš účet ho nevidí, nebo bylo smazáno.</Empty>
      </div>
    );
  }

  const flags = equipmentFlags(inspections ?? [], defects ?? [], mods ?? []);
  const latest = latestInspection(inspections ?? []);
  const label = scannedToken ? labelState(scannedToken, equipment.qrToken) : "none";
  const openRequest = (requests ?? []).find((request) => (OPEN_STATUSES as readonly string[]).includes(request.status)) ?? null;
  const location = [plant?.name, building?.name, floor?.name].filter(Boolean).join(" › ");

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4" data-testid="equipment-detail">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" onClick={navigation.back} aria-label="Zpět">
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{location}</p>
          <h1 className="flex flex-wrap items-baseline gap-x-3 text-2xl font-semibold">
            <span className="font-mono" data-testid="equipment-tag">{equipment.tag}</span>
            <span className="text-lg font-normal">{equipment.name}</span>
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border px-2 py-0.5 text-xs">{EQUIPMENT_TYPE_LABELS[equipment.type]}</span>
            <StatusBadge style={EQUIPMENT_STATUS[equipment.status]} />
            <StatusBadge style={INSPECTION_STATE[flags.inspection]} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("changeRequest.submit") ? (
            <Button onClick={() => setAction({ kind: "change" })} data-testid="action-change">
              <PencilLine className="size-4" aria-hidden />
              Zadat změnu
            </Button>
          ) : null}
          {can("temporaryMod.create") ? (
            <Button variant="outline" onClick={() => setAction({ kind: "tempMod" })} data-testid="action-temp-mod">
              <Timer className="size-4" aria-hidden />
              Provizorium
            </Button>
          ) : null}
          {can("equipment.photo") ? (
            <Button variant="outline" onClick={() => setAction({ kind: "photo" })}>
              <Camera className="size-4" aria-hidden />
              Fotka
            </Button>
          ) : null}
        </div>
      </div>

      {label === "replaced" ? (
        <p className="flex gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200" data-testid="label-replaced">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          Tento QR štítek už neplatí – štítek zařízení byl přegenerován{equipment.qrToken ? ` (platný kód ${formatQrToken(equipment.qrToken)})` : ""}. Starý štítek vyměňte.
        </p>
      ) : null}

      {pending.length ? (
        <Section title="Úpravy z tohoto zařízení" icon={<History className="size-4 text-primary" aria-hidden />} testId="pending-for-equipment">
          <ul className="space-y-2">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span>
                  {item.label}
                  <span className="block text-xs text-muted-foreground">zadáno {formatDateTime(item.performedAt)}</span>
                </span>
                {item.status === "rejected" ? (
                  <span className="max-w-md text-xs text-red-300">Odmítnuto: {item.message}</span>
                ) : item.status === "accepted" ? (
                  <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">Na serveru závodu – čeká na cloud</span>
                ) : (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">Čeká na odeslání</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Údaje" icon={<ClipboardList className="size-4 text-primary" aria-hidden />}>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact label="Výrobce" value={equipment.manufacturer} />
            <Fact label="Typ / model" value={equipment.model} />
            <Fact label="Výrobní číslo" value={equipment.serialNumber} />
            <Fact label="Inventární číslo" value={equipment.inventoryNumber} />
            <Fact label="Rok instalace" value={equipment.yearInstalled} />
            <Fact label="Napětí" value={equipment.ratedVoltage} />
            <Fact label="Proud" value={equipment.ratedCurrent} />
            <Fact label="Krytí" value={equipment.ipRating} />
            <Fact label="Třída ochrany" value={equipment.protectionClass} />
            <Fact label="Zóna" value={equipment.assignedZone} />
            <Fact label="Napájení z" value={equipment.fedFromCircuit} />
            <Fact label="Interval revizí" value={`${equipment.inspectionIntervalMonths} měsíců`} />
          </dl>
          {equipment.description ? <p className="text-sm text-muted-foreground">{equipment.description}</p> : null}
        </Section>
        <Section title="Fotka" icon={<ImageIcon className="size-4 text-primary" aria-hidden />}>
          {equipment.photoUrl ? <Photo url={equipment.photoUrl} alt={`Fotka ${equipment.tag}`} className="aspect-video w-full rounded-lg border border-border object-cover" /> : <Empty>Bez fotky.</Empty>}
        </Section>
      </div>

      <Section title="Závady z revizí" icon={<TriangleAlert className="size-4 text-red-400" aria-hidden />} testId="defects">
        {defects?.length ? (
          <ul className="space-y-2">
            {[...defects]
              .sort((a, b) => Number(a.status === "RESOLVED") - Number(b.status === "RESOLVED") || a.deadline.localeCompare(b.deadline))
              .map((defect) => {
                const state = defectState({ status: defect.status, deadline: new Date(defect.deadline) });
                return (
                  <li key={defect.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <p>{defect.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge style={DEFECT_STATE[state.state]} />
                        <StatusBadge style={DEFECT_SEVERITY[defect.severity]} />
                        <span className="text-xs text-muted-foreground">termín {formatDate(defect.deadline)}</span>
                      </div>
                      {defect.status === "RESOLVED" ? <p className="text-xs text-muted-foreground">Odstraněno {defect.resolvedAt ? formatDate(defect.resolvedAt) : ""}{defect.resolvedBy ? ` – ${defect.resolvedBy}` : ""}{defect.resolutionNote ? `: ${defect.resolutionNote}` : ""}</p> : null}
                    </div>
                    {defect.status !== "RESOLVED" && can("defect.resolve") ? (
                      <Button size="sm" variant="outline" onClick={() => setAction({ kind: "defect", id: defect.id })} data-testid={`resolve-${defect.id}`}>
                        <Wrench className="size-4" aria-hidden />
                        Odstranit
                      </Button>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        ) : (
          <Empty>Žádné závady.</Empty>
        )}
      </Section>

      <Section title="Provizoria" icon={<Timer className="size-4 text-amber-400" aria-hidden />} testId="temporary-mods">
        {mods?.length ? (
          <ul className="space-y-2">
            {[...mods].sort(byDateDesc("createdAt")).map((mod) => {
              const countdown = tempModCountdown(new Date(mod.expiresAt));
              const active = mod.status === "ACTIVE";
              return (
                <li key={mod.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">
                      {mod.number} · {mod.title}
                    </p>
                    <p className="text-muted-foreground">{mod.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge style={active && countdown.overdue ? TEMP_MOD_OVERDUE : TEMP_MOD_STATUS[mod.status]} />
                      {active ? <span className="text-xs text-muted-foreground">{countdown.overdue ? `${-countdown.daysLeft} dní po termínu` : `zbývá ${countdown.daysLeft} dní`} · do {formatDate(mod.expiresAt)}</span> : null}
                      <span className="text-xs text-muted-foreground">{mod.createdByName}</span>
                    </div>
                  </div>
                  {active && can("temporaryMod.restore") ? (
                    <Button size="sm" variant="outline" onClick={() => setAction({ kind: "restore", id: mod.id })}>
                      Ukončit 1:1
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Žádná provizoria.</Empty>
        )}
      </Section>

      <Section title="Požadavky na změnu" icon={<PencilLine className="size-4 text-primary" aria-hidden />} testId="change-requests">
        {requests?.length ? (
          <ul className="space-y-3">
            {[...requests].sort(byDateDesc("submittedAt")).map((request) => (
              <ChangeRequestItem key={request.id} request={request} userName={userName} canComment={can("changeRequest.comment") && (OPEN_STATUSES as readonly string[]).includes(request.status)} onComment={() => setAction({ kind: "comment", request })} />
            ))}
          </ul>
        ) : (
          <Empty>Žádné požadavky na změnu.</Empty>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Revize" icon={<ShieldAlert className="size-4 text-emerald-400" aria-hidden />} testId="inspections">
          {inspections?.length ? (
            <ul className="space-y-2">
              {[...inspections].sort(byDateDesc("inspectionDate")).map((record) => (
                <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="min-w-0">
                    {INSPECTION_TYPE_LABELS[record.type]} {formatDate(record.inspectionDate)} · č. {record.reportNumber}
                    <span className="block text-xs text-muted-foreground">
                      platí do {formatDate(record.validUntil)} · {record.inspectorName}
                      {record.id === latest?.id ? " · poslední" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge style={INSPECTION_RESULT[record.result]} />
                    <FileButton url={record.reportUrl} name={`zprava-${record.reportNumber}`} label="Zpráva" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Bez revizí.</Empty>
          )}
        </Section>

        <Section title="Dokumentace" icon={<BookOpen className="size-4 text-primary" aria-hidden />} testId="documents">
          <ul className="space-y-2 text-sm">
            {activeRevision ? (
              <DocRow title={`Schéma ${activeRevision.version} – ${activeRevision.title}`} detail={activeRevision.approvedAt ? `schváleno ${formatDate(activeRevision.approvedAt)}` : "platná revize"}>
                <FileButton url={activeRevision.schematicUrl} name={`schema-${equipment.tag}-${activeRevision.version}`} />
              </DocRow>
            ) : null}
            {(compliance ?? []).map((document) => (
              <DocRow key={document.id} title={document.title} detail={`${COMPLIANCE_CATEGORY_LABELS[document.category]?.label ?? document.category} · ${document.documentNumber} · ${formatDate(document.issuedAt)}`}>
                <FileButton url={document.fileUrl} name={document.title} />
              </DocRow>
            ))}
            {(documents ?? []).map((document) => (
              <DocRow key={document.id} title={document.title} detail={[categoryLabel(document.category), document.manufacturer, document.modelNumber, document.version].filter(Boolean).join(" · ")}>
                <FileButton url={document.fileUrl} name={document.fileName} />
              </DocRow>
            ))}
            {(software ?? []).map((backup) => (
              <DocRow key={backup.id} title={`Záloha SW ${backup.targetUnit} v${backup.major}.${backup.minor}`} detail={[backup.platform, backup.firmwareVersion, backup.isSafetyRelated ? "bezpečnostní" : null, backup.changeSummary].filter(Boolean).join(" · ")}>
                <FileButton url={backup.fileUrl} name={backup.fileName} />
              </DocRow>
            ))}
            {!activeRevision && !compliance?.length && !documents?.length && !software?.length ? <Empty>Bez dokumentace.</Empty> : null}
          </ul>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Sledované součástky" icon={<Cog className="size-4 text-primary" aria-hidden />}>
          {components?.length ? (
            <ul className="space-y-2 text-sm">
              {components.map((component) => (
                <li key={component.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span>
                    <span className="font-mono">{component.designation}</span> {component.name}
                    <span className="block text-xs text-muted-foreground">
                      instalováno {formatDate(component.installedAt)} · na skladě {component.replacementStockCount} ks
                    </span>
                  </span>
                  {can("component.replace") ? (
                    <Button size="sm" variant="outline" onClick={() => setAction({ kind: "component", id: component.id })}>
                      Vyměnit kus
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Bez sledovaných součástek.</Empty>
          )}
        </Section>
        <BomSection revisionId={activeRevision?.id ?? null} />
      </div>

      {action?.kind === "change" ? <ChangeRequestDialog equipment={equipment} openRequest={openRequest} onClose={() => setAction(null)} /> : null}
      {action?.kind === "comment" ? <CommentDialog request={action.request} equipment={equipment} onClose={() => setAction(null)} /> : null}
      {action?.kind === "tempMod" ? <TemporaryModDialog equipment={equipment} onClose={() => setAction(null)} /> : null}
      {action?.kind === "photo" ? <EquipmentPhotoDialog equipment={equipment} onClose={() => setAction(null)} /> : null}
      {action?.kind === "restore" ? withRecord(mods?.find((mod) => mod.id === action.id), (mod) => <RestoreDialog mod={mod} equipment={equipment} onClose={() => setAction(null)} />) : null}
      {action?.kind === "defect" ? withRecord(defects?.find((defect) => defect.id === action.id), (defect) => <ResolveDefectDialog defect={defect} equipment={equipment} onClose={() => setAction(null)} />) : null}
      {action?.kind === "component" ? withRecord(components?.find((component) => component.id === action.id), (component) => <ReplaceComponentDialog component={component} equipment={equipment} onClose={() => setAction(null)} />) : null}
    </div>
  );
}

const withRecord = <T,>(record: T | undefined, render: (record: T) => ReactNode) => (record ? render(record) : null);

function DocRow({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <span className="min-w-0">
        {title}
        {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {children}
    </li>
  );
}

function ChangeRequestItem({ request, userName, canComment, onComment }: { request: ChangeRequestRecord; userName: Map<string, string>; canComment: boolean; onComment: () => void }) {
  const events = useChildren("ChangeRequestEvent", request.id);
  const attachments = useChildren("Attachment", request.id);
  return (
    <li className="space-y-2 rounded-lg border border-border px-3 py-2 text-sm" data-testid={`change-request-${request.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold">{request.number}</span>
          <StatusBadge style={CHANGE_REQUEST_STATUS[request.status]} />
          <span className="text-xs text-muted-foreground">
            {formatDateTime(request.submittedAt)} · {userName.get(request.reporterId) ?? "technik"}
          </span>
        </span>
        {canComment ? (
          <Button size="sm" variant="outline" onClick={onComment}>
            <MessageSquarePlus className="size-4" aria-hidden />
            Komentář
          </Button>
        ) : null}
      </div>
      {request.note ? <p className="whitespace-pre-line">{request.note}</p> : null}
      {attachments?.length ? (
        <div className="flex flex-wrap gap-2">
          {attachments
            .filter((attachment) => attachment.type === "PHOTO")
            .map((attachment) => (
              <Photo key={attachment.id} url={attachment.url} alt={attachment.caption ?? attachment.fileName ?? "Příloha"} className="size-20 rounded-md border border-border object-cover" />
            ))}
        </div>
      ) : null}
      {events?.length ? (
        <ul className="space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
          {[...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((event) => (
            <li key={event.id}>
              {formatDateTime(event.createdAt)} · {CHANGE_REQUEST_EVENT[event.type]?.label ?? event.type} · {userName.get(event.actorId) ?? ""}
              {event.comment ? <span className="block whitespace-pre-line text-foreground/80">{event.comment}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function BomSection({ revisionId }: { revisionId: string | null }) {
  const items = useChildren("BomItem", revisionId);
  return (
    <Section title="Kusovník" icon={<ClipboardList className="size-4 text-primary" aria-hidden />}>
      {items?.length ? (
        <div className="max-h-80 overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Poz.</th>
                <th className="px-2 py-1">Označení</th>
                <th className="px-2 py-1">Popis</th>
                <th className="px-2 py-1">Výrobce / obj. č.</th>
                <th className="px-2 py-1 text-right">Množství</th>
              </tr>
            </thead>
            <tbody>
              {[...items].sort((a, b) => a.position - b.position).map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-2 py-1">{item.position}</td>
                  <td className="px-2 py-1 font-mono">{item.designation}</td>
                  <td className="px-2 py-1">{item.description}</td>
                  <td className="px-2 py-1">{[item.manufacturer, item.partNumber].filter(Boolean).join(" · ")}</td>
                  <td className="px-2 py-1 text-right">
                    {item.quantity} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Bez kusovníku.</Empty>
      )}
    </Section>
  );
}
