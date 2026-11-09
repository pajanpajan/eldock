"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Server } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPlantServerPairingAction } from "@/server/actions/sync";

const CARD = "space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5";

/**
 * Fáze 72: Administrace → Zařízení – spárování serveru závodu (závod s interní sítí bez internetu). Kód zadá správce
 * ve správě serveru závodu; server se pak synchronizuje s cloudem a obslouží aplikace v hale.
 */
export function PlantServerCard() {
  const [pending, startTransition] = useTransition();
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string; server: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = pairing ? Math.max(0, Math.round((new Date(pairing.expiresAt).getTime() - now) / 1000)) : 0;

  useEffect(() => {
    if (!pairing) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [pairing]);

  const start = () =>
    startTransition(async () => {
      const result = await createPlantServerPairingAction();
      if (!result.ok) return void toast.error(result.error);
      setNow(Date.now());
      setPairing(result.data);
    });

  return (
    <section aria-labelledby="plant-server" className={CARD} data-testid="plant-server-card">
      <h2 id="plant-server" className="flex items-center gap-2 text-lg font-semibold">
        <Server className="size-5 text-primary" aria-hidden />
        Server závodu
      </h2>
      <p className="text-sm text-muted-foreground">
        Pro závod s interní sítí bez internetu: server závodu běží na počítači v síti závodu (Eldock pro Windows spuštěný jako server), aplikace v hale se synchronizují s ním a on s cloudem, kdykoli má spojení – aspoň jednou denně. Úpravy z haly přepošle jménem techniků, kteří je zadali.
      </p>
      {pairing ? (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm" data-testid="plant-server-pairing">
          <p>Ve správě serveru závodu (na serveru otevřete http://localhost:8787) zvolte „Spárovat s cloudem“ a zadejte:</p>
          <p className="font-mono text-xs break-all text-muted-foreground" data-testid="plant-server-cloud">
            {pairing.server}
          </p>
          <p className="font-mono text-2xl font-semibold tracking-widest" data-testid="plant-server-code">
            {pairing.code}
          </p>
          <p className={cn("text-xs", secondsLeft ? "text-muted-foreground" : "text-red-400")}>
            {secondsLeft ? `Kód platí ještě ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} a jde použít jen jednou.` : "Kód vypršel – vytvořte nový."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={start}>
              Nový kód
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPairing(null)}>
              Zavřít
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" className="gap-2" disabled={pending} onClick={start} data-testid="plant-server-pair-start">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Server className="size-4" aria-hidden />}
          Spárovat server závodu
        </Button>
      )}
    </section>
  );
}
