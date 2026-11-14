"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOCAL_BACKUP_INFO } from "@/lib/platform-settings";
import { clearBackupStorageAction, clearSmtpSettingsAction, saveBackupStorageAction, saveSmtpSettingsAction, testSmtpAction } from "@/server/actions/superadmin";
import type { PublicPlatformSettings } from "@/server/services/platform-settings";

/**
 * Fáze 113: ⚙️ Nastavení SMTP & Cloud záloh (R2/S3) ve velínu – údaje zadá majitel webem, hesla a klíče se uloží
 * šifrovaně a zpět se nezobrazují. Proměnné prostředí serveru (`ELDOCK_SMTP_URL`, `ELDOCK_BACKUP_S3_*`) mají přednost.
 */
export function PlatformSettingsForm({
  settings,
  backup,
  defaultTestTo,
  backupButton,
}: {
  settings: PublicPlatformSettings;
  backup: { offsite: { endpoint: string; bucket: string; prefix: string } | null; keepLocal: number; dir: string; time: string; encrypted: boolean };
  defaultTestTo: string;
  backupButton: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [smtp, setSmtp] = useState({
    host: settings.smtp?.host ?? "",
    port: String(settings.smtp?.port ?? 465),
    secure: settings.smtp?.secure ?? true,
    user: settings.smtp?.user ?? "",
    password: "",
    from: settings.smtp?.from ?? "ELDOCK <info@eldock.cz>",
  });
  const [testTo, setTestTo] = useState(defaultTestTo);
  const [storage, setStorage] = useState({
    endpoint: settings.storage?.endpoint ?? "",
    region: settings.storage?.region ?? "auto",
    bucket: settings.storage?.bucket ?? "",
    accessKeyId: settings.storage?.accessKeyId ?? "",
    secretAccessKey: "",
    prefix: settings.storage?.prefix ?? "eldock",
    pathStyle: settings.storage?.pathStyle ?? false,
    backupKey: "",
  });

  const run = (task: () => Promise<void>) => startTransition(task);

  const field = (label: string, input: React.ReactNode, hint?: string) => (
    <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {label}
      {input}
      {hint ? <span className="text-[11px]">{hint}</span> : null}
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="platform-settings">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Odesílání e-mailů SMTP">
        <h2 className="text-lg font-semibold">📧 Odesílání e-mailů (SMTP)</h2>
        <p className="text-sm text-muted-foreground">
          Obnova hesla, notifikace revizí, měsíční reporty a newsletter. {settings.envSmtp ? <b className="text-amber-200">Na serveru je nastavené ELDOCK_SMTP_URL – má přednost před velínem.</b> : settings.smtp ? <b className="text-emerald-300">✅ SMTP z velínu je aktivní.</b> : "Zatím nenastaveno – e-maily se jen zapisují do logu."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("Server SMTP", <Input value={smtp.host} placeholder="smtp.seznam.cz" onChange={(event) => setSmtp({ ...smtp, host: event.target.value })} data-testid="smtp-host" />)}
          {field("Port", <Input value={smtp.port} inputMode="numeric" onChange={(event) => setSmtp({ ...smtp, port: event.target.value })} data-testid="smtp-port" />, "465 = SSL/TLS, 587 = STARTTLS")}
          {field("Uživatel", <Input value={smtp.user} autoComplete="off" placeholder="info@eldock.cz" onChange={(event) => setSmtp({ ...smtp, user: event.target.value })} data-testid="smtp-user" />)}
          {field("Heslo", <Input type="password" value={smtp.password} autoComplete="new-password" placeholder={settings.smtp?.passwordSet ? "•••••• uloženo – prázdné = ponechat" : "heslo k poštovní schránce"} onChange={(event) => setSmtp({ ...smtp, password: event.target.value })} data-testid="smtp-password" />)}
          {field("Odesílatel", <Input value={smtp.from} onChange={(event) => setSmtp({ ...smtp, from: event.target.value })} data-testid="smtp-from" />)}
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" className="size-4 accent-amber-400" checked={smtp.secure} onChange={(event) => setSmtp({ ...smtp, secure: event.target.checked })} data-testid="smtp-secure" />
            SSL/TLS (port 465)
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await saveSmtpSettingsAction({ ...smtp, port: Number(smtp.port), password: smtp.password || undefined });
                if (!result.ok) return void toast.error(result.error);
                setSmtp((current) => ({ ...current, password: "" }));
                toast.success(`SMTP uloženo (${result.data.host}:${result.data.port}) – otestujte ho zkušebním e-mailem.`);
                router.refresh();
              })
            }
            data-testid="smtp-save"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />} Uložit SMTP
          </Button>
          <Input value={testTo} onChange={(event) => setTestTo(event.target.value)} className="w-56" aria-label="E-mail pro zkušební zprávu" data-testid="smtp-test-to" />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await testSmtpAction(testTo);
                if (!result.ok) return void toast.error(result.error, { duration: 10_000 });
                toast.success(`✅ Zkušební e-mail odeslán na ${result.data.to} (${result.data.via === "env" ? "SMTP z prostředí serveru" : "SMTP z velínu"}).`);
              })
            }
            data-testid="smtp-test"
          >
            <Mail className="size-4" aria-hidden /> Otestovat SMTP
          </Button>
          {settings.smtp ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-red-300"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (!window.confirm("Odebrat SMTP z velínu? E-maily se budou jen zapisovat do logu (pokud SMTP nedává prostředí serveru).")) return;
                  const result = await clearSmtpSettingsAction();
                  if (!result.ok) return void toast.error(result.error);
                  setSmtp((current) => ({ ...current, host: "", user: "", password: "" }));
                  toast.success("SMTP odebráno z velínu.");
                  router.refresh();
                })
              }
              data-testid="smtp-clear"
            >
              <Trash2 className="size-4" aria-hidden /> Odebrat SMTP
            </Button>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Zálohy mimo server">
        <h2 className="text-lg font-semibold">☁️ Cloud zálohy (Cloudflare R2 / S3)</h2>
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" data-testid="backup-local-info">
          {backup.offsite ? `☁️ Zálohy mimo server: ${backup.offsite.endpoint}/${backup.offsite.bucket}/${backup.offsite.prefix} · místní snímky ${backup.keepLocal} dní` : `${LOCAL_BACKUP_INFO} – denně v ${backup.time}, posledních ${backup.keepLocal} dní v ${backup.dir}.`}
        </p>
        {settings.envStorage ? <p className="text-sm text-amber-200">Na serveru je nastavené ELDOCK_BACKUP_S3_* – má přednost před velínem.</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("Adresa úložiště (endpoint)", <Input value={storage.endpoint} placeholder="https://<účet>.r2.cloudflarestorage.com" onChange={(event) => setStorage({ ...storage, endpoint: event.target.value })} data-testid="s3-endpoint" />)}
          {field("Bucket", <Input value={storage.bucket} placeholder="eldock-zalohy" onChange={(event) => setStorage({ ...storage, bucket: event.target.value })} data-testid="s3-bucket" />)}
          {field("Access Key ID", <Input value={storage.accessKeyId} autoComplete="off" onChange={(event) => setStorage({ ...storage, accessKeyId: event.target.value })} data-testid="s3-access" />)}
          {field("Secret Access Key", <Input type="password" value={storage.secretAccessKey} autoComplete="new-password" placeholder={settings.storage?.secretSet ? "•••••• uloženo – prázdné = ponechat" : ""} onChange={(event) => setStorage({ ...storage, secretAccessKey: event.target.value })} data-testid="s3-secret" />)}
          {field("Region", <Input value={storage.region} onChange={(event) => setStorage({ ...storage, region: event.target.value })} data-testid="s3-region" />, "Cloudflare R2: auto")}
          {field("Složka (prefix)", <Input value={storage.prefix} onChange={(event) => setStorage({ ...storage, prefix: event.target.value })} data-testid="s3-prefix" />)}
          {field(
            "Heslo šifrování záloh (min. 16 znaků)",
            <Input type="password" value={storage.backupKey} autoComplete="new-password" placeholder={settings.storage?.backupKeySet || backup.encrypted ? "•••••• nastaveno – prázdné = ponechat" : "mimo server jdou jen šifrované zálohy"} onChange={(event) => setStorage({ ...storage, backupKey: event.target.value })} data-testid="s3-backup-key" />,
            "Heslo si uložte i mimo ELDOCK – bez něj zálohu z cloudu neobnovíte.",
          )}
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" className="size-4 accent-amber-400" checked={storage.pathStyle} onChange={(event) => setStorage({ ...storage, pathStyle: event.target.checked })} data-testid="s3-path-style" />
            Path-style adresy (MinIO)
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await saveBackupStorageAction({ ...storage, secretAccessKey: storage.secretAccessKey || undefined, backupKey: storage.backupKey || undefined });
                if (!result.ok) return void toast.error(result.error);
                setStorage((current) => ({ ...current, secretAccessKey: "", backupKey: "" }));
                toast.success(`Úložiště záloh uloženo (bucket ${result.data.bucket}) – další záloha půjde i mimo server.`);
                router.refresh();
              })
            }
            data-testid="s3-save"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />} Uložit úložiště
          </Button>
          {settings.storage ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-red-300"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (!window.confirm("Odebrat úložiště záloh z velínu? Zálohy poběží dál místně na serveru.")) return;
                  const result = await clearBackupStorageAction();
                  if (!result.ok) return void toast.error(result.error);
                  toast.success("Úložiště odebráno – zálohy dál místně na serveru.");
                  router.refresh();
                })
              }
              data-testid="s3-clear"
            >
              <Trash2 className="size-4" aria-hidden /> Odebrat
            </Button>
          ) : null}
          {backupButton}
        </div>
      </section>
    </div>
  );
}
