"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, ShieldBan, ShieldCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { issuePasswordLinkAction, revokeUserSessionsAction, setUserDisabledAction, type PasswordLinkResult } from "@/server/actions/accounts";
import { removeEmployeeAction } from "@/server/actions/data-requests";

import { PasswordLinkNotice } from "./PasswordLinkNotice";

interface Props {
  userId: string;
  name: string;
  hasPassword: boolean;
  disabled: boolean;
  activeSessions: number;
  /** Vlastní účet správce – sám sebe nezablokuje. */
  self: boolean;
  /** Fáze 69: zaměstnance jde odebrat (anonymizace účtu). */
  removable?: boolean;
}

/** Fáze 67: akce správce firmy u zaměstnance – odkaz na heslo, blokace, odhlášení ze všech zařízení. */
export function AccountSecurityActions({ userId, name, hasPassword, disabled, activeSessions, self, removable = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<PasswordLinkResult | null>(null);
  const [removing, setRemoving] = useState(false);
  const [anonymize, setAnonymize] = useState(false);

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
        {!self && removable ? (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-red-300" disabled={pending} onClick={() => setRemoving((value) => !value)}>
            <UserMinus className="size-3.5" aria-hidden />
            Odebrat
          </Button>
        ) : null}
      </div>
      {removing ? (
        <div className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-xs" data-testid="remove-employee">
          <p>
            Odebrat {name} z firmy? Zruší se přihlášení, heslo, dvoufázové ověření a e-mail s telefonem. Záznamy, které zaměstnanec vytvořil (změny, revize, přílohy), zůstanou v dokumentaci firmy.
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={anonymize} onChange={(event) => setAnonymize(event.target.checked)} />
            Anonymizovat i jméno (v historii se zobrazí „Bývalý zaměstnanec“)
          </label>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                act(
                  () => removeEmployeeAction({ userId, anonymizeName: anonymize }),
                  () => {
                    setRemoving(false);
                    toast.success(`${name}: zaměstnanec odebrán.`);
                  },
                )
              }
            >
              Odebrat zaměstnance
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRemoving(false)}>
              Zpět
            </Button>
          </div>
        </div>
      ) : null}
      {link ? <PasswordLinkNotice result={link} onClose={() => setLink(null)} /> : null}
    </div>
  );
}
