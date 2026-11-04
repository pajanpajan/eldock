"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, History, Loader2, Plus, RotateCcw, ShieldCheck, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SoftwareBackupStatus } from "@/generated/prisma/enums";
import { formatFileSize } from "@/lib/equipment-documents";
import { formatDate } from "@/lib/format";
import { SOFTWARE_PLATFORMS, formatSoftwareVersion, groupBackupsByUnit, nextSoftwareVersion, type VersionBump } from "@/lib/software-backups";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { activateSoftwareBackupAction, createSoftwareBackupAction } from "@/server/actions/equipment-knowledge";

import { downloadHref } from "./PdfViewer";

export interface BackupRow {
  id: string;
  targetUnit: string;
  platform: string;
  major: number;
  minor: number;
  status: SoftwareBackupStatus;
  firmwareVersion: string | null;
  isSafetyRelated: boolean;
  safetyChecksum: string | null;
  changeSummary: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
  author: string | null;
  changeRequest: { id: string; number: string } | null;
}

export interface ChangeOption {
  id: string;
  number: string;
  requiresSoftwareUpdate: boolean;
  hasBackup: boolean;
}

const ACCEPT = ".zip,.7z,.rar,.zap16,.zap17,.zap18,.zap19,.s7p,.acd,.xml,.json,.par,.bin,.hex,.csv,.pdf";
const NEW_UNIT = "__new__";

function ChangeLink({ change, ticketBase }: { change: BackupRow["changeRequest"]; ticketBase: string | null }) {
  if (!change) return null;
  return ticketBase ? (
    <a href={`${ticketBase}${change.id}`} className="font-mono text-primary underline-offset-4 hover:underline">
      {change.number}
    </a>
  ) : (
    <span className="font-mono">{change.number}</span>
  );
}

/**
 * „💾 Software & Zálohy PLC“: řídicí uzly stroje, aktuální platná záloha (ACTIVE) se Safety CRC,
 * historie starších verzí s rollbackem a nahrání nové verze (Minor +0.1 / Major +1.0).
 */
export function SoftwareBackups({
  equipmentId,
  backups,
  changes,
  canUpload,
  ticketBase,
}: {
  equipmentId: string;
  backups: BackupRow[];
  changes: ChangeOption[];
  canUpload: boolean;
  /** Odkaz na ticket CAE (jen pro CAE projektanta), jinak jen číslo změny. */
  ticketBase: string | null;
}) {
  const router = useRouter();
  const groups = useMemo(() => groupBackupsByUnit(backups), [backups]);
  const waiting = changes.filter((change) => change.requiresSoftwareUpdate && !change.hasBackup);
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<string>(groups[0]?.unit ?? NEW_UNIT);
  const [newUnit, setNewUnit] = useState("");
  const [bump, setBump] = useState<VersionBump>("minor");
  const [safety, setSafety] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [rolling, startRollback] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const targetUnit = unit === NEW_UNIT ? newUnit.trim() : unit;
  const next = nextSoftwareVersion(backups.filter((backup) => backup.targetUnit === targetUnit), bump);
  const current = groups.find((group) => group.unit === targetUnit)?.active ?? null;

  function openDialog(forUnit?: string) {
    setUnit(forUnit ?? groups[0]?.unit ?? NEW_UNIT);
    setSafety(forUnit ? !!groups.find((group) => group.unit === forUnit)?.active?.isSafetyRelated : false);
    setOpen(true);
  }

  async function submit(form: FormData) {
    if (!file) return void toast.error("Vyberte soubor zálohy.");
    if (!targetUnit) return void toast.error("Zadejte řídicí uzel stroje.");
    setBusy(true);
    try {
      const uploaded = await uploadFile("software", file);
      const result = await createSoftwareBackupAction({
        equipmentId,
        targetUnit,
        platform: String(form.get("platform") ?? ""),
        bump,
        firmwareVersion: String(form.get("firmware") ?? "") || null,
        isSafetyRelated: safety,
        safetyChecksum: safety ? String(form.get("checksum") ?? "") : null,
        changeSummary: String(form.get("summary") ?? ""),
        changeRequestId: String(form.get("change") ?? "") || null,
        fileUrl: uploaded.url,
        fileName: file.name,
        fileSizeBytes: file.size,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Záloha ${targetUnit} ${result.data.version} je aktuálně ve stroji, předchozí verze archivována.`);
      setOpen(false);
      setFile(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zálohu se nepodařilo nahrát.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Software a zálohy PLC" className="space-y-4" data-testid="software-backups">
      {waiting.length ? (
        <p className="flex items-start gap-2 rounded-xl border border-orange-500/50 bg-orange-500/10 p-3 text-sm text-orange-200" role="alert" data-testid="software-waiting">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          ⚠️ Čeká na nahrání aktualizované zálohy SW: {waiting.map((change) => change.number).join(", ")} (zásah zahrnoval úpravu řídicího SW / parametrů).
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {groups.length} {groups.length === 1 ? "řídicí uzel" : groups.length >= 2 && groups.length <= 4 ? "řídicí uzly" : "řídicích uzlů"} · {backups.length} záloh · bezpečnostní programy s kontrolním součtem dle Nařízení (EU) 2023/1230
        </p>
        {canUpload ? (
          <Button className="touch-target ml-auto gap-2" onClick={() => openDialog()}>
            <Plus className="size-4" aria-hidden /> Nahrát novou verzi zálohy SW / parametrů
          </Button>
        ) : null}
      </div>

      {groups.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map((group) => (
            <article key={group.unit} className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="software-unit" data-unit={group.unit}>
              <h3 className="flex items-center gap-2 font-semibold">💾 {group.unit}</h3>
              {group.active ? (
                <div className="space-y-2 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3" data-testid="software-active">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 font-mono text-sm font-bold text-emerald-950">{formatSoftwareVersion(group.active)}</span>
                    <span className="text-sm font-semibold text-emerald-200">Aktuální platná záloha v provozu</span>
                    {group.active.isSafetyRelated ? (
                      <span className="flex items-center gap-1 rounded-full border border-amber-400/70 bg-amber-400/10 px-2 py-0.5 font-mono text-xs text-amber-200" data-testid="software-crc">
                        <ShieldCheck className="size-3.5" aria-hidden /> Safety {group.active.safetyChecksum}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm">{group.active.changeSummary}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(group.active.createdAt)}
                    {group.active.author ? ` · ${group.active.author}` : ""} · {group.active.platform}
                    {group.active.firmwareVersion ? ` · FW ${group.active.firmwareVersion}` : ""} · {formatFileSize(group.active.fileSizeBytes)}
                    {group.active.changeRequest ? (
                      <>
                        {" · změna "}
                        <ChangeLink change={group.active.changeRequest} ticketBase={ticketBase} />
                      </>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5" asChild>
                      <a href={downloadHref(group.active.fileUrl)} download={group.active.fileName}>
                        <Download className="size-3.5" aria-hidden /> ⬇️ Stáhnout zálohu
                      </a>
                    </Button>
                    {canUpload ? (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openDialog(group.unit)}>
                        <Upload className="size-3.5" aria-hidden /> Nová verze
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Uzel nemá aktivní zálohu.</p>
              )}
              {group.history.length ? (
                <details className="rounded-xl border border-border p-3" data-testid="software-history">
                  <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium select-none">
                    <History className="size-4" aria-hidden /> Historie a archiv starších verzí ({group.history.map(formatSoftwareVersion).join(", ")})
                  </summary>
                  <ol className="mt-3 space-y-2 border-l border-border pl-4">
                    {group.history.map((backup) => (
                      <li key={backup.id} className="relative space-y-1 text-sm" data-testid="software-archived">
                        <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-muted-foreground" aria-hidden />
                        <p className="flex flex-wrap items-center gap-2">
                          <b className="font-mono">{formatSoftwareVersion(backup)}</b>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(backup.createdAt)}
                            {backup.author ? ` · ${backup.author}` : ""} · {backup.platform}
                            {backup.firmwareVersion ? ` · FW ${backup.firmwareVersion}` : ""}
                          </span>
                          {backup.isSafetyRelated && backup.safetyChecksum ? <span className="font-mono text-xs text-amber-200">Safety {backup.safetyChecksum}</span> : null}
                        </p>
                        <p className="text-muted-foreground">
                          {backup.changeSummary}
                          {backup.changeRequest ? (
                            <>
                              {" · "}
                              <ChangeLink change={backup.changeRequest} ticketBase={ticketBase} />
                            </>
                          ) : null}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
                            <a href={downloadHref(backup.fileUrl)} download={backup.fileName}>
                              <Download className="size-3.5" aria-hidden /> Stáhnout
                            </a>
                          </Button>
                          {canUpload ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              disabled={rolling}
                              onClick={() => {
                                if (!window.confirm(`Nastavit ${group.unit} ${formatSoftwareVersion(backup)} jako aktuálně ve stroji (rollback)?`)) return;
                                startRollback(async () => {
                                  const result = await activateSoftwareBackupAction(backup.id);
                                  if (!result.ok) return void toast.error(result.error);
                                  toast.success(`${group.unit}: aktivní ${result.data.version} (rollback).`);
                                  router.refresh();
                                });
                              }}
                            >
                              <RotateCcw className="size-3.5" aria-hidden /> Nastavit jako aktivní
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Zatím žádné zálohy řídicího SW. Nahrajte zálohu PLC, HMI nebo parametrů měniče.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nová verze zálohy SW / parametrů</DialogTitle>
            <DialogDescription>Dosavadní aktivní záloha uzlu se archivuje (rollback zůstane možný). Soubor do 50 MB.</DialogDescription>
          </DialogHeader>
          <form action={submit} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sw-unit">Řídicí uzel stroje</Label>
              <select id="sw-unit" className="h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" value={unit} onChange={(event) => setUnit(event.target.value)}>
                {groups.map((group) => (
                  <option key={group.unit} value={group.unit}>
                    {group.unit}
                  </option>
                ))}
                <option value={NEW_UNIT}>➕ Nový řídicí uzel…</option>
              </select>
              {unit === NEW_UNIT ? <Input value={newUnit} onChange={(event) => setNewUnit(event.target.value)} maxLength={120} placeholder="např. PLC -A1 (Siemens S7-1500)" aria-label="Název nového uzlu" /> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sw-platform">Platforma</Label>
              <Input id="sw-platform" name="platform" list="sw-platforms" required maxLength={80} defaultValue={current?.platform ?? ""} placeholder="TIA Portal V19" />
              <datalist id="sw-platforms">
                {SOFTWARE_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Skok verze">
              {(
                [
                  ["minor", "Minor +0.1", "parametry, časovače"],
                  ["major", "Major +1.0", "nová revize programu"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={bump === value}
                  onClick={() => setBump(value)}
                  className={cn("rounded-lg border-2 p-2 text-left text-sm", bump === value ? "border-primary bg-primary/10" : "border-border")}
                >
                  <b>{label}</b>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="sw-next-version">
              {current ? `${formatSoftwareVersion(current)} → ` : "První záloha uzlu: "}
              <b className="font-mono text-foreground">{formatSoftwareVersion(next)}</b>
            </p>
            <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label="Soubor zálohy" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" className="h-12 gap-2" onClick={() => input.current?.click()}>
              <Upload className="size-4" aria-hidden /> {file ? `${file.name} (${formatFileSize(file.size)})` : "Vybrat soubor zálohy (.zap19, .zip, .par …)"}
            </Button>
            <div className="grid gap-1.5">
              <Label htmlFor="sw-summary">Popis změny v programu / parametrech (povinné)</Label>
              <textarea id="sw-summary" name="summary" required minLength={5} maxLength={2000} rows={3} className="rounded-md border border-input bg-transparent p-2 text-sm dark:bg-input/30" placeholder="Co a proč se změnilo" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sw-fw">Verze firmwaru (Cyber Resilience Act)</Label>
              <Input id="sw-fw" name="firmware" maxLength={40} defaultValue={current?.firmwareVersion ?? ""} placeholder="např. V3.1" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={safety} onChange={(event) => setSafety(event.target.checked)} />
              Bezpečnostní program (Safety PLC / F-CPU)
            </label>
            {safety ? (
              <div className="grid gap-1.5">
                <Label htmlFor="sw-crc">Safety Checksum (CRC / F-Signature)</Label>
                <Input id="sw-crc" name="checksum" required maxLength={60} placeholder="CRC: 0x8F4A-2C91" />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="sw-change">Změnové řízení (Červenka)</Label>
              <select id="sw-change" name="change" className="h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" defaultValue={waiting[0]?.id ?? ""}>
                <option value="">bez vazby</option>
                {changes.map((change) => (
                  <option key={change.id} value={change.id}>
                    {change.number}
                    {change.requiresSoftwareUpdate && !change.hasBackup ? " – čeká na zálohu SW" : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="touch-target gap-2" disabled={busy || !file}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} Uložit jako {formatSoftwareVersion(next)} (ACTIVE)
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
