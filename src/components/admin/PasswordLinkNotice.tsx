"use client";

import { useState } from "react";
import { Check, Copy, Mail, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import type { PasswordLinkResult } from "@/server/actions/accounts";

/** Fáze 67: odkaz na nastavení hesla pro zaměstnance – kopírování, platnost a zda odešel e-mailem. */
export function PasswordLinkNotice({ result, onClose }: { result: PasswordLinkResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div role="status" className="space-y-2 rounded-xl border border-primary/50 bg-primary/10 p-4 text-sm" data-testid="password-link">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">
          {result.kind === "INVITE" ? "Pozvánka" : "Odkaz na nové heslo"} pro {result.email} – platí do {formatDateTime(result.expiresAt)}
        </p>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Zavřít">
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="flex gap-2">
        <Input readOnly value={result.link} onFocus={(event) => event.currentTarget.select()} className="h-10 font-mono text-xs" aria-label="Odkaz na nastavení hesla" data-testid="password-link-url" />
        <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Zkopírováno" : "Kopírovat"}
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Mail className="size-3.5" aria-hidden />
        {result.emailed
          ? "Odkaz odešel e-mailem. Kdo ho zná, nastaví heslo – nepředávejte ho dál."
          : "E-mail se neodeslal (server nemá nastavené SMTP) – předejte odkaz zaměstnanci osobně nebo bezpečnou zprávou. Kdo odkaz zná, nastaví heslo."}
      </p>
    </div>
  );
}
