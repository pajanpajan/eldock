"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { inviteMessage } from "@/lib/tutorials";

/** Kopie textu i bez Clipboard API (http, starší prohlížeče) přes skryté textové pole. */
function copyFallback(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** Fáze 87: pozvánka s odkazem na /navody do schránky (pro WhatsApp, SMS nebo e-mail kolegovi elektrikáři). */
export function CopyInviteButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const message = inviteMessage(url);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(message);
      ok = true;
    } catch {
      ok = copyFallback(message);
    }
    if (!ok) return void toast.error("Pozvánku se nepodařilo zkopírovat – označte a zkopírujte text níže.");
    setCopied(true);
    toast.success("Pozvánka s odkazem je ve schránce – vložte ji do WhatsAppu, SMS nebo e-mailu.");
    window.setTimeout(() => setCopied(false), 4000);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="lg" onClick={copy} className="h-auto min-h-12 w-fit gap-2 px-5 py-2.5 text-left whitespace-normal" data-testid="copy-invite">
        {copied ? "✓ Pozvánka je ve schránce" : "📋 Zkopírovat pozvánku s odkazem pro kolegu elektrikáře"}
      </Button>
      <p className="max-w-3xl rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground" data-testid="invite-text">
        {message}
      </p>
    </div>
  );
}
