"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";

import { CONTACT_CATEGORIES, QUICK_ACTIONS, contextFromPath } from "@/lib/contact";
import { cn } from "@/lib/utils";

import { CONTACT_OPEN_EVENT, type ContactOpenRequest } from "./contact-events";
import { ContactFeedbackModal } from "./ContactFeedbackModal";

// Fáze 107: plovoucí tlačítko „💬 Nápověda, Chyby & Kontakt“ vpravo dole na každé stránce (hlavní layout). Po najetí
// nebo kliknutí nabídne rychlé akce (chyba, tip, schůzka, spolupráce) nebo rovnou hlavní formulář; v editorech
// (2D půdorys, kroky rozváděče) je to kompaktní pilulka nad lištou „Další krok“, aby nepřekážela při kreslení.

/** Editor s vlastní spodní lištou a plátnem – kompaktní pilulka. */
export function isEditorPath(pathname: string) {
  const context = contextFromPath(pathname);
  return context.module === "floorplan" || (context.module === "panel-builder" && !!context.projectId);
}

/**
 * Kde plovoucí tlačítko není: stránka /kontakt (formulář je na ní celý), velín a prezentace na projektoru (/prezentace má
 * v liště odkaz „Kontakt & Spolupráce“).
 */
export const isContactHiddenPath = (pathname: string) => pathname === "/kontakt" || pathname === "/prezentace" || pathname === "/superadmin" || pathname.startsWith("/superadmin/");

export function GlobalContactWidget() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [request, setRequest] = useState<ContactOpenRequest & { key: number }>({ key: 0 });
  const wrapper = useRef<HTMLDivElement>(null);

  const show = useCallback((next: ContactOpenRequest) => {
    setRequest((current) => ({ ...next, key: current.key + 1 }));
    setMenu(false);
    setOpen(true);
  }, []);

  // „Nahlásit chybu“ v editorech a odkazy otevírají modal událostí okna
  useEffect(() => {
    const listener = (event: Event) => show((event as CustomEvent<ContactOpenRequest>).detail ?? {});
    window.addEventListener(CONTACT_OPEN_EVENT, listener);
    return () => window.removeEventListener(CONTACT_OPEN_EVENT, listener);
  }, [show]);

  // Nabídka se zavře klepnutím mimo ni (dotyková zařízení) nebo klávesou Esc
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrapper.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const hidden = isContactHiddenPath(pathname);
  const compact = isEditorPath(pathname);

  return (
    <>
      {hidden ? null : (
        <div
          ref={wrapper}
          // Na mobilu nad pevnými spodními lištami (žádanka o změnu, hromadná revize, schválení) – od šířky sm vpravo dole;
          // dokud je vidět lišta cookies, nad ní (proměnná --consent-banner-h z CookieConsentBanner)
          className={cn("no-print fixed right-3 z-40 flex flex-col items-end gap-2 print:hidden", compact ? "bottom-[calc(var(--consent-banner-h,0px)_+_6rem)]" : "bottom-[calc(var(--consent-banner-h,0px)_+_5rem)] sm:right-5 sm:bottom-[calc(var(--consent-banner-h,0px)_+_1.25rem)]")}
          // Najetí jen myší – klepnutí prstem vyvolá i „mouseenter“ a nabídka by se přeskočila rovnou na formulář
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setMenu(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setMenu(false);
          }}
          data-testid="contact-fab-wrap"
          data-compact={compact ? "true" : "false"}
        >
          {menu ? (
            <div role="menu" aria-label="Nápověda, chyby a kontakt" className="flex w-72 flex-col gap-1 rounded-2xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur" data-testid="contact-fab-menu">
              {QUICK_ACTIONS.map((id) => {
                const category = CONTACT_CATEGORIES.find((item) => item.id === id)!;
                return (
                  <button key={id} type="button" role="menuitem" onClick={() => show({ category: id })} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" data-testid={`contact-quick-${id}`}>
                    {category.short}
                  </button>
                );
              })}
              <button type="button" role="menuitem" onClick={() => show({})} className="rounded-lg border border-primary/40 px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-primary/10" data-testid="contact-open-form">
                ✉️ Otevřít formulář (všech 7 kategorií)
              </button>
            </div>
          ) : null}
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="Nápověda, Chyby & Kontakt"
            title="Nápověda, Chyby & Kontakt"
            // Nabídka otevřená (najetím myší) → klik rovnou otevře hlavní formulář; jinak klik nabídku ukáže
            onClick={() => (menu ? show({}) : setMenu(true))}
            className={cn(
              "flex items-center gap-2 rounded-full border border-primary/50 bg-zinc-950/90 font-semibold text-foreground shadow-xl shadow-black/40 backdrop-blur transition-colors hover:border-primary hover:bg-zinc-900",
              compact ? "size-11 justify-center text-lg" : "size-12 justify-center text-xl sm:size-auto sm:px-4 sm:py-2.5 sm:text-sm",
            )}
            data-testid="contact-fab"
          >
            {compact ? (
              <span aria-hidden>💬</span>
            ) : (
              <>
                <span className="sm:hidden" aria-hidden>
                  💬
                </span>
                <MessageCircleQuestion className="hidden size-4 text-primary sm:block" aria-hidden />
                <span className="hidden sm:inline">💬 Nápověda, Chyby & Kontakt</span>
              </>
            )}
          </button>
        </div>
      )}
      {open ? <ContactFeedbackModal open={open} onOpenChange={setOpen} request={request} /> : null}
    </>
  );
}
