"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/** Globální hledání v katalogu (?q=) – odesílá se průběžně při psaní, výběr výrobce se zruší. */
export function CatalogSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }));
    }, 300);
  }

  return (
    <label className="relative block w-full max-w-xl">
      <span className="sr-only">Hledat v katalogu</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={query} onChange={(event) => update(event.target.value)} placeholder="Hledat napříč výrobci: S201 B16, DS301C, 5SY6, Tango zásuvka …" className="h-11 pl-9 pr-9" aria-label="Hledat v katalogu" />
      {pending ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Hledám" />
      ) : query ? (
        <button type="button" onClick={() => update("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Vymazat hledání">
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}
