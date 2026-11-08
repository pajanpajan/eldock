"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, ShieldBan, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { issuePasswordLinkAction, revokeUserSessionsAction, setUserDisabledAction, type PasswordLinkResult } from "@/server/actions/accounts";

import { PasswordLinkNotice } from "./PasswordLinkNotice";

interface Props {
  userId: string;
  name: string;
  hasPassword: boolean;
  disabled: boolean;
  activeSessions: number;
  /** Vlastní účet správce – sám sebe nezablokuje. */
  self: boolean;
}

/** Fáze 67: akce správce firmy u zaměstnance – odkaz na heslo, blokace, odhlášení ze všech zařízení. */
export function AccountSecurityActions({ userId, name, hasPassword, disabled, activeSessions, self }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<PasswordLinkResult | null>(null);

  function act<T>(action: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, success: (data: T) => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      success(result.data);
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-56 flex-col gap-1.5" data-testid={`account-actions-${userId}`}>
      <div className="flex flex-wrap gap-1.5">
        {!disabled ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={() => act(() => issuePasswordLinkAction(userId), (data) => setLink(data))}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <KeyRound className="size-3.5" aria-hidden />}
            {hasPassword ? "Odkaz na nové heslo" : "Poslat pozvánku znovu"}
          </Button>
        ) : null}
        {activeSessions > 0 && !self ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={pending}
            onClick={() => act(() => revokeUserSessionsAction(userId), (data) => toast.success(`${name}: odhlášeno ze zařízení (${data.count}).`))}
          >
            <LogOut className="size-3.5" aria-hidden />
            Odhlásit všude
          </Button>
        ) : null}
        {!self ? (
          <Button
            type="button"
            variant={disabled ? "outline" : "ghost"}
            size="sm"
            className="gap-1.5"
            disabled={pending}
            onClick={() => {
              if (!disabled && !window.confirm(`Zablokovat účet ${name}? Přihlášení přestane platit a zaměstnanec se nepřihlásí, dokud účet neodblokujete.`)) return;
              act(() => setUserDisabledAction(userId, !disabled), () => toast.success(disabled ? `${name}: účet odblokován.` : `${name}: účet zablokován a odhlášen.`));
            }}
          >
            {disabled ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldBan className="size-3.5" aria-hidden />}
            {disabled ? "Odblokovat" : "Zablokovat"}
          </Button>
        ) : null}
      </div>
      {link ? <PasswordLinkNotice result={link} onClose={() => setLink(null)} /> : null}
    </div>
  );
}
