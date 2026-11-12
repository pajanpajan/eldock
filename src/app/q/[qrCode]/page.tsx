import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EldockQr } from "@/components/qr/EldockQrLabel";
import { QrPairEquipmentForm } from "@/components/qr/QrPairEquipmentForm";
import { QrPairForm } from "@/components/qr/QrPairForm";
import { prisma } from "@/lib/prisma";
import { purposeLabel } from "@/lib/qr-label-registry";
import { DOC_STATE_LABEL, czDate, nextVersion } from "@/lib/switchboard-versions";
import { getPanelCompany } from "@/server/panel-session";
import { getSignedInUser } from "@/server/session";
import { getQrCard, type QrCard } from "@/server/queries/switchboard-versions";

export async function generateMetadata({ params }: PageProps<"/q/[qrCode]">): Promise<Metadata> {
  const card = await getQrCard((await params).qrCode);
  // Karty štítků nejsou pro vyhledávače (dokumentace konkrétních rozváděčů)
  return { title: card ? `Štítek ${card.label.serialCode}${card.project ? ` – ${card.project.code}` : ""}` : "Štítek nenalezen", robots: { index: false, follow: false } };
}

/**
 * Fáze 103: veřejná karta QR štítku ELDOCK (https://eldock.cz/q/EL-000001) – po naskenování u rozváděče: platná
 * uzamčená verze dokumentace (2 dokumenty k prohlížení a tisku do PDF), historie verzí s NEAKTUÁLNÍMI a odemknutí
 * k úpravě pro firmu výrobce. Nespárovaný štítek firma spáruje s rozváděčem. Jméno zákazníka a místo instalace vidí
 * jen přihlášená firma výrobce (sériová čísla jdou po sobě – karta nesmí prozradit osobní údaje).
 */
export default async function QrCardPage({ params }: PageProps<"/q/[qrCode]">) {
  const card = await getQrCard((await params).qrCode);
  if (!card) notFound();
  const company = await getPanelCompany();
  const { label, project } = card;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6" data-testid="qr-card" data-serial={label.serialCode}>
      <div className="flex items-center gap-3">
        <div className="size-20 shrink-0 rounded-md bg-white p-1.5">
          <EldockQr code={label.serialCode} />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xl font-black tracking-tight" data-testid="qr-serial">
            🏷️ {label.serialCode}
          </p>
          <p className="text-xs text-muted-foreground">{purposeLabel(label.purpose)}</p>
        </div>
      </div>
      {project ? <ProjectCard card={card} owner={company?.id === project.companyId} /> : card.equipment ? <EquipmentCard equipment={card.equipment} /> : <UnpairedCard card={card} companyId={company?.id ?? null} />}
      <p className="mt-auto pt-6 text-xs text-muted-foreground">
        Globálně unikátní štítek z registru ELDOCK – každé sériové číslo se vydá jen jednou. Dokumentace vydaných verzí je uzamčená a neměnná; tisk do PDF přes „Uložit jako PDF“ v prohlížeči.
      </p>
    </main>
  );
}

function ProjectCard({ card, owner }: { card: QrCard; owner: boolean }) {
  const project = card.project!;
  const serial = card.label.serialCode;
  const current = project.versions.find((row) => row.status === "LOCKED_PUBLISHED") ?? null;
  const older = project.versions.filter((row) => row !== current);
  const next = nextVersion(project.versions).version;
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold" data-testid="qr-project">
          ⚡ Rozváděč <span className="font-mono text-primary">{project.code}</span>
          {project.boardCode ? ` · ${project.boardCode}` : ""} – {project.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Výrobce rozváděče: {project.company?.companyName ?? card.label.companyName}
          {owner && project.customerName ? ` · Zákazník: ${project.customerName}` : ""}
          {owner && project.installationSite ? ` · 📍 ${project.installationSite}` : ""}
        </p>
      </div>

      {current ? (
        <p className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 p-4 text-base text-emerald-100" data-testid="qr-current">
          🔒 <strong>Schválená platná dokumentace – Verze {current.version}</strong> (Ověřeno revizním technikem {current.inspectorName} dne {czDate(current.measuredAt)})
        </p>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm" data-testid="qr-no-version">
          Dokumentace rozváděče se připravuje – zatím nebyla vydaná žádná schválená verze.
        </p>
      )}
      {current && project.docState !== "LOCKED_PUBLISHED" ? (
        <p className="rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-sm text-amber-100" data-testid="qr-pending-change">
          🛠️ Na rozváděči se připravuje změna – Verze {next} ({project.docState === "PENDING_INSPECTION" ? DOC_STATE_LABEL.PENDING_INSPECTION.toLowerCase() : "rozpracovaná změna"}). Do schválení platí Verze {current.version}.
        </p>
      ) : null}

      {current ? (
        <div className="grid gap-2">
          <Link href={`/q/${serial}/v/${current.version}`} className="rounded-xl border border-border bg-card p-4 text-base font-medium hover:border-primary" data-testid="qr-doc-pdf">
            📄 Kompletní PDF dokumentace rozváděče + Kusová zkouška (Verze {current.version} – AKTUÁLNÍ)
          </Link>
          {current.hasFloorplan ? (
            <Link href={`/q/${serial}/v/${current.version}/pudorys`} className="rounded-xl border border-border bg-card p-4 text-base font-medium hover:border-primary" data-testid="qr-doc-floorplan">
              📐 Prováděcí 2D půdorys a kabelové trasy (Verze {current.version} – AKTUÁLNÍ)
            </Link>
          ) : null}
        </div>
      ) : null}

      {older.length ? (
        <details className="rounded-xl border border-border bg-card p-4" data-testid="qr-history">
          <summary className="cursor-pointer font-medium">Historie verzí rozváděče ({older.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {older.map((row) => (
              <li key={row.version} className="flex flex-wrap items-center gap-2" data-testid="qr-history-row" data-version={row.version}>
                <span>
                  Verze {row.version} ze dne {czDate(row.publishedAt)} – <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">⚠️ NEAKTUÁLNÍ{row.supersededByVersion ? ` – nahrazeno verzí ${row.supersededByVersion}` : ""}</span>
                </span>
                <Link href={`/q/${serial}/v/${row.version}`} className="underline">
                  📄 dokumentace
                </Link>
                {row.hasFloorplan ? (
                  <Link href={`/q/${serial}/v/${row.version}/pudorys`} className="underline">
                    📐 půdorys
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="rounded-xl border border-border p-4">
        <Link
          href={`/panel-builder/${project.id}/documentation?revize=1#revizni-technik`}
          className="inline-flex min-h-11 items-center rounded-lg border border-amber-400/70 px-4 text-sm font-semibold text-amber-100 hover:bg-amber-400/10"
          data-testid="qr-unlock"
        >
          🔓 Odemknout rozváděč k úpravě / Založit novou revizi
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          Pro firmu výrobce rozváděče po přihlášení do AI Panel Builderu: přepojení nebo nový jistič = rozpracovaná Verze {next}, po nové kusové zkoušce a potvrzení revizním technikem se znovu uzamkne.
        </p>
      </div>
    </>
  );
}

/** Štítek spárovaný se zařízením Správy závodů – karta zařízení je jen pro přihlášenou údržbu závodu. */
function EquipmentCard({ equipment }: { equipment: NonNullable<QrCard["equipment"]> }) {
  return (
    <div className="space-y-3" data-testid="qr-equipment">
      <h1 className="text-2xl font-semibold">
        ⚙️ <span className="font-mono text-primary">{equipment.tag}</span> – {equipment.name}
      </h1>
      <p className="text-sm text-muted-foreground">{equipment.floor.building.plant.name}</p>
      <Link href={`/equipment/${equipment.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
        Otevřít kartu zařízení (dokumentace, revize, Červenky) – přihlášení údržby závodu
      </Link>
    </div>
  );
}

type Owner = { id: string; ico: string; email: string };
const ownsLabel = (label: QrCard["label"], company: Owner | null) => Boolean(company && (label.batchCompanyId === company.id || (label.batchIco && label.batchIco === company.ico) || (label.batchEmail && label.batchEmail === company.email)));

async function UnpairedCard({ card, companyId }: { card: QrCard; companyId: string | null }) {
  const { label } = card;
  const company = companyId ? await prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { id: true, ico: true, email: true } }) : null;
  const owns = ownsLabel(label, company);
  const projects = owns && company ? await prisma.panelBoardProject.findMany({ where: { companyId: company.id, qrSerial: null }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, code: true, name: true } }) : [];
  // Uživatel registrované firmy Správy závodů spáruje štítek se strojem, spotřebičem nebo rozváděčem svého závodu
  const plantUser = await getSignedInUser();
  const plantCompany = plantUser?.companyId ? await prisma.registeredCompany.findUnique({ where: { id: plantUser.companyId }, select: { id: true, ico: true, email: true, plantId: true } }) : null;
  const plantOwns = Boolean(plantCompany?.plantId) && ownsLabel(label, plantCompany);
  const equipment = plantOwns && plantCompany?.plantId ? await prisma.equipment.findMany({ where: { floor: { building: { plantId: plantCompany.plantId } } }, orderBy: { tag: "asc" }, take: 500, select: { id: true, tag: true, name: true } }) : [];
  return (
    <div className="space-y-3" data-testid="qr-unpaired">
      <h1 className="text-2xl font-semibold">Štítek {label.serialCode} – zatím nespárovaný</h1>
      <p className="text-sm text-muted-foreground">
        Štítek patří do série firmy <strong className="text-foreground">{label.companyName}</strong>. Po spárování s rozváděčem se tu po naskenování zobrazí jeho uzamčená schválená dokumentace.
      </p>
      {plantOwns ? <QrPairEquipmentForm code={label.serialCode} equipment={equipment} /> : null}
      {owns ? (
        <QrPairForm code={label.serialCode} projects={projects} />
      ) : plantOwns ? null : company ? (
        <p className="text-sm text-amber-200">Štítek patří jiné firmě – spárovat ho může jen {label.companyName}.</p>
      ) : (
        <Link href={`/panel-builder/auth?next=${encodeURIComponent(`/q/${label.serialCode}`)}`} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" data-testid="qr-pair-login">
          Přihlásit firmu a spárovat štítek s rozváděčem
        </Link>
      )}
    </div>
  );
}
