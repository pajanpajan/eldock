// Fáze 71: fronta úprav z haly – čekající na odeslání, odmítnuté serverem (s důvodem, uživatel je zahodí
// a zadá znovu opravené), odeslané za posledních 7 dní a úpravy jiného uživatele (neodešlou se).

import { ArrowLeft, CheckCircle2, Clock, Send, Server, Trash2, UserX, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { formatDateTime } from "@/lib/format";
import { SYNC_MUTATION_LABELS } from "@/lib/sync";
import type { OutboxItem } from "@/sync-client";

import type { Navigation } from "../App";
import { useOutbox } from "../data";
import { useSync } from "../sync";
import { Button, Empty, Section } from "../ui";

export function QueueScreen({ navigation }: { navigation: Navigation }) {
  const { status, engine, syncNow, syncing, online } = useSync();
  const outbox = useOutbox() ?? [];
  const userId = status?.user?.id;
  const pending = outbox.filter((item) => item.status === "pending" && item.userId === userId);
  const accepted = outbox.filter((item) => item.status === "accepted" && item.userId === userId);
  const foreign = outbox.filter((item) => (item.status === "pending" || item.status === "accepted") && item.userId !== userId);
  const rejected = outbox.filter((item) => item.status === "rejected");
  const applied = outbox.filter((item) => item.status === "applied").reverse();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4" data-testid="queue-screen">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={navigation.back} aria-label="Zpět">
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Úpravy z aplikace</h1>
        <Button onClick={() => void syncNow()} busy={syncing} disabled={!pending.length}>
          <Send className="size-4" aria-hidden />
          Odeslat teď
        </Button>
      </div>
      {!online ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Zařízení je offline – úpravy zůstanou v zařízení a odešlou se po připojení k síti.</p> : null}

      <Section title={`Čeká na odeslání (${pending.length})`} icon={<Clock className="size-4 text-amber-400" aria-hidden />} testId="queue-pending">
        {pending.length ? <Items items={pending} onOpen={(id) => navigation.open({ name: "equipment", id })} /> : <Empty>Nic nečeká – vše je na serveru.</Empty>}
      </Section>

      {accepted.length ? (
        <Section title={`Na serveru závodu – čeká na cloud (${accepted.length})`} icon={<Server className="size-4 text-sky-400" aria-hidden />} testId="queue-accepted">
          <p className="text-sm text-muted-foreground">Server závodu úpravy převzal a ostatní zařízení v síti závodu je už vidí. Do cloudu je přepošle, jakmile se s ním spojí – výsledek se tu objeví po další synchronizaci.</p>
          <Items items={accepted} onOpen={(id) => navigation.open({ name: "equipment", id })} />
        </Section>
      ) : null}

      {rejected.length ? (
        <Section title={`Odmítnuto serverem (${rejected.length})`} icon={<XCircle className="size-4 text-red-400" aria-hidden />} testId="queue-rejected">
          <p className="text-sm text-muted-foreground">Server tyto úpravy neprovedl (pravidla jsou stejná jako na webu). Zahoďte je a zadejte znovu opravené.</p>
          <Items
            items={rejected}
            onOpen={(id) => navigation.open({ name: "equipment", id })}
            action={(item) => (
              <Button size="sm" variant="ghost" onClick={() => void engine.dismiss(item.id)} aria-label="Zahodit úpravu">
                <Trash2 className="size-4" aria-hidden />
                Zahodit
              </Button>
            )}
          />
        </Section>
      ) : null}

      {foreign.length ? (
        <Section title={`Úpravy jiného uživatele (${foreign.length})`} icon={<UserX className="size-4 text-muted-foreground" aria-hidden />}>
          <p className="text-sm text-muted-foreground">Zadal je jiný účet, který byl na tomto zařízení spárovaný dřív. Pod vaším jménem se neodešlou – odešlou se po spárování původním účtem.</p>
          <Items items={foreign} onOpen={(id) => navigation.open({ name: "equipment", id })} />
        </Section>
      ) : null}

      <Section title="Odesláno (posledních 7 dní)" icon={<CheckCircle2 className="size-4 text-emerald-400" aria-hidden />} testId="queue-applied">
        {applied.length ? <Items items={applied} onOpen={(id) => navigation.open({ name: "equipment", id })} /> : <Empty>Zatím nic.</Empty>}
      </Section>
    </div>
  );
}

function Items({ items, onOpen, action }: { items: OutboxItem[]; onOpen: (equipmentId: string) => void; action?: (item: OutboxItem) => ReactNode }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm" data-testid={`outbox-${item.status}`}>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => item.equipmentId && onOpen(item.equipmentId)} disabled={!item.equipmentId}>
            <span className="block font-medium">{item.label}</span>
            <span className="block text-xs text-muted-foreground">
              {SYNC_MUTATION_LABELS[item.type]} · zadáno {formatDateTime(item.performedAt)}
              {item.resolvedAt && item.status === "applied" ? ` · odesláno ${formatDateTime(item.resolvedAt)}` : ""}
              {item.result && typeof item.result.number === "string" ? ` · ${item.result.number}` : ""}
            </span>
            {item.message && item.status !== "applied" ? <span className="block text-xs text-red-300">{item.message}</span> : null}
          </button>
          {action?.(item)}
        </li>
      ))}
    </ul>
  );
}
