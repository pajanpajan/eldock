import { cn } from "@/lib/utils";

import { getStatusStyle, type StatusRef } from "./StatusBadge";

type Props = StatusRef & {
  className?: string;
  /** Pulzující kruh kolem tečky (varovný stav). */
  pulse?: boolean;
};

/** Malá stavová tečka; popisek stavu je v `title` a pro čtečky v `aria-label`. */
export function StatusDot({ className, pulse, ...ref }: Props) {
  const style = getStatusStyle(ref as StatusRef);
  return (
    <span
      role="img"
      aria-label={style.label}
      title={style.label}
      className={cn("relative inline-flex size-2.5 shrink-0", className)}
    >
      {pulse ? (
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", style.dot)} />
      ) : null}
      <span className={cn("relative inline-flex size-full rounded-full", style.dot)} />
    </span>
  );
}
