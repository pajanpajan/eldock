import { cn } from "@/lib/utils";

/** Logo Digitry: značka z jističe a rozvodnice + nápis. Čisté SVG, bez externích souborů. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect x="1.5" y="1.5" width="29" height="29" rx="7" className="fill-primary" />
        <path
          d="M9 8v16M9 8h5.5a8 8 0 0 1 0 16H9"
          fill="none"
          stroke="oklch(0.141 0.005 285.823)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23.5" cy="8.5" r="2" fill="oklch(0.141 0.005 285.823)" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">
        Digitry<span className="text-primary">.</span>
      </span>
    </span>
  );
}
