"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { offlineLabel } from "@/lib/offline-sync-queue";

import { offlineQueue, sendQueued, useOfflineCount } from "./offline-queue";

/**
 * Fáze 112: indikátor „📡 Offline režim – X záznamů čeká na odeslání“ v rohu obrazovky a automatická synchronizace
 * fronty po obnovení připojení (`online`) – na všech stránkách Správy závodů.
 */
export function OfflineQueueHost() {
  const router = useRouter();
  const count = useOfflineCount();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const queue = offlineQueue();
    let before = queue.count();
    const unsubscribe = queue.subscribe((next) => {
      if (before > 0 && next === 0) {
        toast.success("Připojení obnoveno – všechny záznamy z offline fronty jsou odeslané.");
        router.refresh();
      }
      before = next;
    });
    const stop = queue.startAutoSync(sendQueued);
    return () => {
      unsubscribe();
      stop();
    };
  }, [router]);

  if (!count) return null;
  return (
    <div className="fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-amber-500/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-amber-200 shadow-lg" role="status" data-testid="offline-indicator" data-count={count}>
      <span>{offlineLabel(count)}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void offlineQueue()
            .flush(sendQueued)
            .then((result) => {
              if (result.remaining) toast.warning("Stále bez připojení – záznamy počkají ve frontě.");
            })
            .finally(() => setBusy(false));
        }}
        className="flex items-center gap-1 rounded-full border border-amber-500/50 px-2 py-0.5 text-xs hover:bg-amber-500/15"
        data-testid="offline-flush"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CloudUpload className="size-3.5" aria-hidden />} Odeslat teď
      </button>
    </div>
  );
}
