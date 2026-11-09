// Fáze 71: formuláře úprav z haly – uloží se do fronty (i bez signálu) a odešlou při synchronizaci. Server je
// provede stejnými pravidly jako web (oprávnění, stav záznamu, souběh přes `baseUpdatedAt`).

import { useState } from "react";
import { toast } from "sonner";

import { SAFETY_IMPACT, SUBSTANTIAL_MOD_WARNING } from "@/lib/legislation-2027";
import { CHANGE_REQUEST_PRIORITY } from "@/lib/status";
import type { SyncMutationType } from "@/lib/sync";
import { CHANGE_PRIORITIES, SAFETY_IMPACTS, type SyncMutationPayload } from "@/lib/sync-mutations";
import type { ChangeRequestRecord, EquipmentRecord, InspectionDefectRecord, MonitoredComponentRecord, TemporaryModificationRecord } from "@/sync-client";

import { photoAttachments, PhotoField } from "../media";
import { useSync } from "../sync";
import { Button, Dialog, Field, inputClass } from "../ui";

/** Uloží úpravu do fronty a naplánuje odeslání; vrací true, když se povedlo. */
function useQueue() {
  const { engine, scheduleSync, online } = useSync();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async <T extends SyncMutationType>(type: T, build: () => Promise<SyncMutationPayload<T>>, info: { label: string; equipmentId?: string | null; baseUpdatedAt?: string | null }) => {
    setBusy(true);
    setError(null);
    try {
      await engine.queue(type, await build(), info);
      toast.success(online ? `${info.label}: odesílám na server…` : `${info.label}: uloženo v zařízení, odešle se po připojení.`);
      scheduleSync();
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Úpravu se nepodařilo uložit.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { engine, busy, error, submit };
}

function Problem({ error }: { error: string | null }) {
  return error ? (
    <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
      {error}
    </p>
  ) : null;
}

const newId = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;

export function ChangeRequestDialog({ equipment, openRequest, onClose }: { equipment: EquipmentRecord; openRequest: ChangeRequestRecord | null; onClose: () => void }) {
  const { engine, busy, error, submit } = useQueue();
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<(typeof CHANGE_PRIORITIES)[number]>("NORMAL");
  const [safety, setSafety] = useState<(typeof SAFETY_IMPACTS)[number]>("NONE_1_TO_1");
  const [software, setSoftware] = useState(false);
  const [photos, setPhotos] = useState<Blob[]>([]);
  const send = async () => {
    if (!note.trim() && !photos.length) return void toast.error("Popište změnu nebo přidejte fotku.");
    const ok = await submit(
      "changeRequest.submit",
      async () => ({ id: newId("cr"), equipmentId: equipment.id, note: note.trim() || null, priority, safetyImpact: safety, requiresSoftwareUpdate: software, attachments: await photoAttachments(engine, photos) }),
      { label: `Zadání změny – ${equipment.tag}`, equipmentId: equipment.id },
    );
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      title={`Zadat změnu – ${equipment.tag}`}
      onClose={onClose}
      testId="change-request-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void send()} busy={busy} data-testid="change-request-submit">
            Uložit změnu
          </Button>
        </>
      }
    >
      {openRequest ? <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-200">Zařízení už má otevřený požadavek {openRequest.number} – nový zápis se k němu připojí jako komentář s fotkami.</p> : null}
      <Field label="Co se změnilo" hint="Např. „Vyměněn stykač -K4 za typ AF26“ nebo „Doplněn jistič -F7 pro nový okruh“.">
        <textarea className={inputClass} rows={4} value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} data-testid="change-request-note" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Priorita">
          <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
            {CHANGE_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {CHANGE_REQUEST_PRIORITY[value].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vliv na bezpečnost">
          <select className={inputClass} value={safety} onChange={(event) => setSafety(event.target.value as typeof safety)}>
            {SAFETY_IMPACTS.map((value) => (
              <option key={value} value={value}>
                {SAFETY_IMPACT[value].short}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {safety === "SUBSTANTIAL_SAFETY_MOD" ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{SUBSTANTIAL_MOD_WARNING}</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={software} onChange={(event) => setSoftware(event.target.checked)} className="size-4 accent-yellow-400" />
        Vyžaduje úpravu softwaru (PLC, měnič)
      </label>
      <PhotoField photos={photos} onChange={setPhotos} />
      <Problem error={error} />
    </Dialog>
  );
}

export function CommentDialog({ request, equipment, onClose }: { request: ChangeRequestRecord; equipment: EquipmentRecord; onClose: () => void }) {
  const { engine, busy, error, submit } = useQueue();
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const send = async () => {
    if (!comment.trim() && !photos.length) return void toast.error("Napište komentář nebo přidejte fotku.");
    const ok = await submit("changeRequest.comment", async () => ({ changeRequestId: request.id, comment: comment.trim() || null, attachments: await photoAttachments(engine, photos) }), { label: `Komentář k ${request.number}`, equipmentId: equipment.id });
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      title={`Komentář k ${request.number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void send()} busy={busy}>
            Uložit komentář
          </Button>
        </>
      }
    >
      <Field label="Komentář">
        <textarea className={inputClass} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={4000} />
      </Field>
      <PhotoField photos={photos} onChange={setPhotos} />
      <Problem error={error} />
    </Dialog>
  );
}

export function TemporaryModDialog({ equipment, onClose }: { equipment: EquipmentRecord; onClose: () => void }) {
  const { engine, busy, error, submit } = useQueue();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<7 | 14>(7);
  const [photos, setPhotos] = useState<Blob[]>([]);
  const send = async () => {
    if (!title.trim() || !description.trim()) return void toast.error("Vyplňte, co je provizorní a jak je zapojeno.");
    const ok = await submit(
      "temporaryMod.create",
      async () => {
        const [photo] = await photoAttachments(engine, photos);
        return { id: newId("tm"), equipmentId: equipment.id, title: title.trim(), description: description.trim(), days, photoUrl: photo?.url ?? null };
      },
      { label: `Nové provizorium – ${equipment.tag}`, equipmentId: equipment.id },
    );
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      title={`Nové provizorium – ${equipment.tag}`}
      onClose={onClose}
      testId="temporary-mod-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void send()} busy={busy} data-testid="temporary-mod-submit">
            Zapsat provizorium
          </Button>
        </>
      }
    >
      <Field label="Co je provizorní">
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Např. přemostění tepelné ochrany čerpadla" data-testid="temporary-mod-title" />
      </Field>
      <Field label="Popis zapojení a důvod">
        <textarea className={inputClass} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} data-testid="temporary-mod-description" />
      </Field>
      <Field label="Lhůta" hint="Provizorium po lhůtě se v aplikaci i na webu zobrazí červeně.">
        <select className={inputClass} value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 14)}>
          <option value={7}>7 dní</option>
          <option value={14}>14 dní</option>
        </select>
      </Field>
      <PhotoField photos={photos} onChange={setPhotos} max={1} label="Fotka" />
      <Problem error={error} />
    </Dialog>
  );
}

export function RestoreDialog({ mod, equipment, onClose }: { mod: TemporaryModificationRecord; equipment: EquipmentRecord; onClose: () => void }) {
  const { busy, error, submit } = useQueue();
  const [note, setNote] = useState("");
  const send = async () => {
    const ok = await submit("temporaryMod.restore", async () => ({ temporaryModId: mod.id, note: note.trim() || null }), { label: `Ukončení provizoria ${mod.number}`, equipmentId: equipment.id, baseUpdatedAt: mod.updatedAt });
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      title={`Ukončit provizorium ${mod.number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void send()} busy={busy}>
            Vráceno do stavu 1:1
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">Potvrzujete, že zapojení odpovídá platnému schématu (stav 1:1). Jiný konečný stav zapište jako změnu.</p>
      <Field label="Poznámka (volitelně)">
        <textarea className={inputClass} rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} />
      </Field>
      <Problem error={error} />
    </Dialog>
  );
}

export function ResolveDefectDialog({ defect, equipment, onClose }: { defect: InspectionDefectRecord; equipment: EquipmentRecord; onClose: () => void }) {
  const { engine, busy, error, submit } = useQueue();
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const send = async () => {
    if (!note.trim()) return void toast.error("Popište, jak byla závada odstraněna.");
    const ok = await submit(
      "defect.resolve",
      async () => {
        const [photo] = await photoAttachments(engine, photos);
        return { defectId: defect.id, note: note.trim(), photoUrl: photo?.url ?? null };
      },
      { label: `Odstranění závady – ${equipment.tag}`, equipmentId: equipment.id, baseUpdatedAt: defect.updatedAt },
    );
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      title="Odstranit závadu"
      onClose={onClose}
      testId="resolve-defect-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void send()} busy={busy} data-testid="resolve-defect-submit">
            Potvrdit odstranění
          </Button>
        </>
      }
    >
      <p className="rounded-lg border border-border bg-background p-3 text-sm">{defect.description}</p>
      <Field label="Jak byla odstraněna">
        <textarea className={inputClass} rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} data-testid="resolve-defect-note" />
      </Field>
      <PhotoField photos={photos} onChange={setPhotos} max={1} label="Fotka po opravě" />
      <Problem error={error} />
    </Dialog>
  );
}

export function ReplaceComponentDialog({ component, equipment, onClose }: { component: MonitoredComponentRecord; equipment: EquipmentRecord; onClose: () => void }) {
  const { busy, error, submit } = useQueue();
  const send = async () => {
    const ok = await submit("component.replace", async () => ({ componentId: component.id, equipmentId: equipment.id }), { label: `Výměna ${component.designation} – ${equipment.tag}`, equipmentId: equipment.id, baseUpdatedAt: component.updatedAt });
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      title={`Vyměnit ${component.designation}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void send()} busy={busy}>
            Kus vyměněn
          </Button>
        </>
      }
    >
      <p className="text-sm">
        {component.name} ({component.designation}) – vyměněno za nový kus. Počítadlo životnosti začne znovu od dnešního dne a náhradní díl se odepíše ze skladu
        {component.replacementStockCount ? ` (na skladě ${component.replacementStockCount} ks)` : " (na skladě není žádný – doplňte zásobu)"}.
      </p>
      <Problem error={error} />
    </Dialog>
  );
}

export function EquipmentPhotoDialog({ equipment, onClose }: { equipment: EquipmentRecord; onClose: () => void }) {
  const { engine, busy, error, submit } = useQueue();
  const [photos, setPhotos] = useState<Blob[]>([]);
  const send = async (remove = false) => {
    if (!remove && !photos.length) return void toast.error("Přidejte fotku.");
    const ok = await submit(
      "equipment.photo",
      async () => {
        const [photo] = remove ? [] : await photoAttachments(engine, photos);
        return { equipmentId: equipment.id, photoUrl: photo?.url ?? null };
      },
      { label: `${remove ? "Odebrání fotky" : "Fotka zařízení"} – ${equipment.tag}`, equipmentId: equipment.id, baseUpdatedAt: equipment.updatedAt },
    );
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      title={`Fotka zařízení ${equipment.tag}`}
      onClose={onClose}
      footer={
        <>
          {equipment.photoUrl ? (
            <Button variant="danger" onClick={() => void send(true)} busy={busy}>
              Odebrat fotku
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={() => void send()} busy={busy}>
            Uložit fotku
          </Button>
        </>
      }
    >
      <PhotoField photos={photos} onChange={setPhotos} max={1} label="Nová fotka" />
      <Problem error={error} />
    </Dialog>
  );
}
