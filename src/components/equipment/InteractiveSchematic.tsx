"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Crosshair, Link2, Loader2, Maximize, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/StatusBadge";
import { InspectionStatusBadge } from "@/components/inspections/InspectionStatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { SchematicFormat } from "@/generated/prisma/enums";
import { formatDateShort } from "@/lib/format";
import { renderPdfPage } from "@/lib/pdf-client";
import { equipmentHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { deleteReferenceAction, saveReferenceAction } from "@/server/actions/schematic-references";
import type { SchematicReferenceView } from "@/server/queries/equipment";

interface Draft {
  id: string | null;
  page: number;
  x: number;
  y: number;
  designation: string;
  title: string;
  description: string;
  linkedEquipmentId: string;
}

function DrawingControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-lg border border-border bg-zinc-950/85 p-1 backdrop-blur">
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomIn(0.5)} aria-label="Přiblížit">
        <Plus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => zoomOut(0.5)} aria-label="Oddálit">
        <Minus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="touch-target" onClick={() => resetTransform()} aria-label="Celý list">
        <Maximize className="size-4" />
      </Button>
    </div>
  );
}

/**
 * Interaktivní výkres (CAE reference): stránka výkresu s klikacími štítky prvků (-Q1, -M1 …),
 * boční rozpis prvků a plovoucí karta s propojeným zařízením (stav, revize, červenky).
 * CAE / správce závodu může reference přidávat kliknutím do výkresu, upravovat a mazat.
 */
export function InteractiveSchematic({
  revision,
  references,
  linkable,
  canEdit,
}: {
  revision: { id: string; version: string; url: string; format: SchematicFormat; sheetCount: number };
  references: SchematicReferenceView[];
  linkable: { id: string; tag: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const pdf = revision.format === "PDF";
  const [page, setPage] = useState(references[0]?.page ?? 1);
  const [image, setImage] = useState<{ key: string; src: string; aspect: number; pageCount: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const key = `${revision.url}#${pdf ? page : 1}`;

  useEffect(() => {
    let cancelled = false;
    if (pdf) {
      renderPdfPage(revision.url, page, 1800)
        .then((rendered) => !cancelled && setImage({ key, src: rendered.src, aspect: rendered.width / rendered.height, pageCount: rendered.pageCount }))
        .catch(() => !cancelled && toast.error("Výkres se nepodařilo vykreslit."));
    } else {
      const img = new Image();
      img.onload = () => !cancelled && setImage({ key, src: revision.url, aspect: img.naturalWidth / img.naturalHeight || 1.414, pageCount: 1 });
      img.src = revision.url;
    }
    return () => {
      cancelled = true;
    };
  }, [key, pdf, page, revision.url]);

  const shown = image?.key === key ? image : null;
  const pageCount = shown?.pageCount ?? Math.max(1, revision.sheetCount);
  const onPage = references.filter((reference) => reference.page === page);
  const active = references.find((reference) => reference.id === activeId) ?? null;
  const pages = [...new Set(references.map((reference) => reference.page))];

  function openReference(reference: SchematicReferenceView) {
    setPage(reference.page);
    setActiveId(reference.id);
  }

  function onDrawingClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!editing || (event.target as Element).closest("[data-reference]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setDraft({ id: null, page, x, y, designation: "", title: "", description: "", linkedEquipmentId: "" });
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveReferenceAction({
        id: draft.id,
        revisionId: revision.id,
        page: draft.page,
        designation: draft.designation,
        title: draft.title,
        description: draft.description || null,
        x: draft.x,
        y: draft.y,
        linkedEquipmentId: draft.linkedEquipmentId || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reference ${result.data.designation} uložena.`);
      setDraft(null);
      router.refresh();
    });
  }

  function remove(reference: SchematicReferenceView) {
    startTransition(async () => {
      const result = await deleteReferenceAction({ id: reference.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reference ${reference.designation} odebrána.`);
      setActiveId(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]" data-testid="interactive-schematic">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {pdf ? (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Stránka výkresu">
              <Button variant="ghost" size="icon" className="touch-target" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Předchozí stránka">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-1 font-mono text-sm" data-testid="interactive-page">
                str. {page} / {pageCount}
              </span>
              <Button variant="ghost" size="icon" className="touch-target" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label="Další stránka">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {onPage.length ? `${onPage.length} ${onPage.length === 1 ? "prvek" : onPage.length < 5 ? "prvky" : "prvků"} na stránce` : "Na stránce nejsou žádné reference."}
          </span>
          {canEdit ? (
            <Button variant={editing ? "secondary" : "outline"} className="touch-target ml-auto gap-2" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
              <Crosshair className="size-4" />
              {editing ? "Hotovo" : "Upravit reference"}
            </Button>
          ) : null}
        </div>
        {editing ? <p className="text-sm text-primary">Klikněte do výkresu na místo prvku – otevře se formulář nové reference.</p> : null}

        <div className="relative overflow-hidden rounded-xl border border-border bg-white">
          <TransformWrapper key={key} maxScale={8} doubleClick={{ disabled: true }} wheel={{ step: 0.12 }} panning={{ excluded: ["reference-hotspot"] }}>
            <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
              <div className={cn("relative w-full", editing && "cursor-crosshair")} style={{ aspectRatio: shown?.aspect ?? 1.414 }} onClick={onDrawingClick} data-testid="interactive-drawing">
                {shown ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vykreslená stránka PDF (blob:) nebo SVG z /api/files
                  <img src={shown.src} alt={`Výkres ${revision.version}, stránka ${page}`} className="absolute inset-0 size-full" draggable={false} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                    <Loader2 className="size-6 animate-spin" aria-label="Vykresluji výkres" />
                  </div>
                )}
                {shown
                  ? onPage.map((reference) => (
                      <button
                        key={reference.id}
                        type="button"
                        data-reference={reference.designation}
                        onClick={() => openReference(reference)}
                        className={cn(
                          "reference-hotspot absolute -translate-x-[12%] -translate-y-[85%] rounded border-2 px-1 font-mono text-[clamp(9px,1.1vw,14px)] leading-tight font-bold shadow-md transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/60",
                          reference.linked ? "border-amber-500 bg-amber-300/90 text-zinc-950" : "border-sky-500 bg-sky-200/90 text-sky-950",
                          reference.id === activeId && "animate-pulse ring-4 ring-amber-400/60",
                        )}
                        style={{ left: `${reference.x}%`, top: `${reference.y}%` }}
                        aria-label={`${reference.designation} – ${reference.title}`}
                      >
                        {reference.designation}
                      </button>
                    ))
                  : null}
              </div>
            </TransformComponent>
            <DrawingControls />
          </TransformWrapper>
        </div>
      </div>

      <aside className="rounded-xl border border-border bg-card p-3" aria-labelledby="reference-list-title">
        <h3 id="reference-list-title" className="flex items-center gap-2 font-semibold">
          <Link2 className="size-4 text-primary" aria-hidden />
          Rozpis prvků ve schématu
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">Reference CAE · revize {revision.version}</p>
        {references.length ? (
          <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1" data-testid="reference-list">
            {pages.map((referencePage) => (
              <div key={referencePage}>
                {pdf ? <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Stránka {referencePage}</p> : null}
                <ul className="space-y-1">
                  {references
                    .filter((reference) => reference.page === referencePage)
                    .map((reference) => (
                      <li key={reference.id}>
                        <button
                          type="button"
                          onClick={() => openReference(reference)}
                          className={cn(
                            "touch-target flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                            reference.id === activeId && "bg-primary/10",
                          )}
                        >
                          <span className={cn("w-12 shrink-0 font-mono font-bold", reference.linked ? "text-amber-300" : "text-sky-300")}>{reference.designation}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block leading-snug">{reference.title}</span>
                            {reference.linked ? <span className="block truncate text-xs text-muted-foreground">→ {reference.linked.tag}</span> : null}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">K této revizi zatím nejsou definované reference{canEdit ? " – přidejte je přes „Upravit reference“." : "."}</p>
        )}
      </aside>

      <Sheet open={active !== null} onOpenChange={(open) => !open && setActiveId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="reference-card">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-black text-primary">{active.designation}</span>
                  {active.title}
                </SheetTitle>
                <SheetDescription>
                  Výkres {revision.version}
                  {pdf ? ` · stránka ${active.page}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                {active.description ? <p className="text-sm">{active.description}</p> : null}
                {active.linked ? (
                  <section className="space-y-3 rounded-xl border border-border p-3">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Propojené zařízení</p>
                    <p className="font-medium">{active.linked.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge kind="equipment" status={active.linked.status} />
                      <InspectionStatusBadge summary={active.linked.inspection} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Platná revize dokumentace: <span className="font-mono text-foreground">{active.linked.activeVersion ?? "–"}</span>
                    </p>
                    <div>
                      <p className="mb-1 text-sm text-muted-foreground">Historie změn (červenky)</p>
                      {active.linked.changeRequests.length ? (
                        <ul className="space-y-1.5 text-sm">
                          {active.linked.changeRequests.map((change) => (
                            <li key={change.id} className="flex flex-wrap items-center gap-2">
                              <span className="font-mono">{change.number}</span>
                              <StatusBadge kind="changeRequest" status={change.status} />
                              <span className="text-xs text-muted-foreground">{formatDateShort(change.submittedAt)}</span>
                              {change.note ? <span className="w-full truncate text-xs text-muted-foreground">{change.note}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Bez požadavků na změnu.</p>
                      )}
                    </div>
                    <Button asChild className="touch-target w-full gap-2">
                      <Link href={equipmentHref(active.linked.id)}>
                        Přejít na kartu zařízení {active.linked.tag}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </section>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">Prvek je součástí tohoto zařízení a nemá vlastní kartu.</p>
                )}
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="touch-target flex-1 gap-2"
                      onClick={() => {
                        setDraft({
                          id: active.id,
                          page: active.page,
                          x: active.x,
                          y: active.y,
                          designation: active.designation,
                          title: active.title,
                          description: active.description ?? "",
                          linkedEquipmentId: active.linked?.id ?? "",
                        });
                        setActiveId(null);
                      }}
                    >
                      <Pencil className="size-4" />
                      Upravit
                    </Button>
                    <Button variant="destructive" className="touch-target flex-1 gap-2" disabled={pending} onClick={() => remove(active)}>
                      <Trash2 className="size-4" />
                      Odebrat
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !pending && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Upravit referenci" : "Nová reference ve výkresu"}</DialogTitle>
            <DialogDescription>
              {pdf ? `Stránka ${draft?.page} · ` : ""}pozice {draft ? `${draft.x.toFixed(1)} % × ${draft.y.toFixed(1)} %` : ""}
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reference-designation">Označení</Label>
                  <Input id="reference-designation" value={draft.designation} onChange={(event) => setDraft({ ...draft, designation: event.target.value })} placeholder="-Q1" className="font-mono" maxLength={12} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference-title">Název prvku</Label>
                  <Input id="reference-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Hlavní jistič" maxLength={120} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference-description">Popis (nepovinné)</Label>
                <Textarea id="reference-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} maxLength={500} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference-linked">Propojené zařízení (karta)</Label>
                <select
                  id="reference-linked"
                  value={draft.linkedEquipmentId}
                  onChange={(event) => setDraft({ ...draft, linkedEquipmentId: event.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                >
                  <option value="">– bez vazby (součást zařízení) –</option>
                  {linkable.map((equipment) => (
                    <option key={equipment.id} value={equipment.id}>
                      {equipment.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="touch-target" onClick={() => setDraft(null)} disabled={pending}>
              Zrušit
            </Button>
            <Button className="touch-target gap-2" onClick={save} disabled={pending || !draft?.designation.trim() || !draft?.title.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Uložit referenci
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
