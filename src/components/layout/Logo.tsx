import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Značka Eldock (EL + DOCK): pevný průmyslový dok – portál nad nakládací rampou s výstražným
 * černo-žlutým pruhem, uvnitř blesk a podlahový rastr. Čisté SVG, bez externích souborů.
 */
export function LogoMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} style={style} aria-hidden>
      {/* fill = záloha bez CSS aplikace (video v Remotionu); v aplikaci barvu určuje třída */}
      <rect x="1.5" y="1.5" width="29" height="29" rx="6" fill="oklch(0.852 0.199 91.936)" className="fill-primary" />
      {/* portál doku */}
      <path d="M7 23V9.5h18V23" fill="none" stroke="#09090b" strokeWidth="2.6" strokeLinejoin="round" />
      {/* blesk */}
      <path d="M17.6 11.5 12.8 17.4h3.3l-1.4 4.2 4.9-6.1h-3.3z" fill="#09090b" />
      {/* rampa s výstražným pruhem */}
      <rect x="4.5" y="23" width="23" height="4" rx="1" fill="#09090b" />
      <path d="M8 27l2.4-4M12.5 27l2.4-4M17 27l2.4-4M21.5 27l2.4-4" stroke="oklch(0.852 0.199 91.936)" strokeWidth="1.3" />
    </svg>
  );
}

/** Logo do hlavičky a na přihlášení; `withTagline` přidá podtitul (od šířky tabletu). */
export function Logo({ className, withTagline = false }: { className?: string; withTagline?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="block text-lg font-extrabold tracking-tight">
          <span className="text-primary">EL</span>DOCK
        </span>
        {withTagline ? <span className="mt-0.5 hidden text-[11px] font-medium text-muted-foreground md:block">{BRAND.tagline}</span> : null}
      </span>
    </span>
  );
}
