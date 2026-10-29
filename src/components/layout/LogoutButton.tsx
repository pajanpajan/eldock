import { Lock } from "lucide-react";

import { logout } from "@/server/actions/auth";

/** Odhlásit (Zamknout) – formulář se Server Action, funguje i bez JavaScriptu. */
export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="touch-target flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Odhlásit (Zamknout)"
      >
        <Lock className="size-4" aria-hidden />
        <span className="hidden lg:inline">Odhlásit (Zamknout)</span>
      </button>
    </form>
  );
}
