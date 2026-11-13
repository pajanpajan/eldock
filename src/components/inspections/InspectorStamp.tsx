import { stampLines } from "@/lib/revision-signature";

/** Fáze 108: grafický otisk kulatého razítka revizního technika s číslem osvědčení TIČR (náhled i protokol). */
export function InspectorStamp({
  profile,
  size = 132,
  className,
}: {
  profile: { name: string; certificateNo: string; certificateScope?: string | null; authorizationNo?: string | null; company?: string | null };
  size?: number;
  className?: string;
}) {
  const stamp = stampLines(profile);
  const lines = [stamp.name, stamp.certificate, stamp.scope, stamp.authorization].filter((line): line is string => Boolean(line));
  const clip = (line: string) => (line.length > 30 ? `${line.slice(0, 29)}…` : line);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={`Razítko revizního technika ${profile.name}, ${stamp.certificate}`} data-testid="inspector-stamp">
      <g fill="none" stroke="#1d4ed8">
        <circle cx="60" cy="60" r="56" strokeWidth="2.6" />
        <circle cx="60" cy="60" r="48" strokeWidth="1" />
      </g>
      <text x="60" y="30" fontSize="8" fontWeight="700" letterSpacing="1" fill="#1d4ed8" textAnchor="middle">
        {stamp.title}
      </text>
      {lines.map((line, index) => (
        <text key={`${index}-${line}`} x="60" y={50 + index * 13} fontSize={index === 0 ? 9 : 7} fontWeight={index === 0 ? 700 : 500} fill="#1d4ed8" textAnchor="middle">
          {clip(line)}
        </text>
      ))}
      {stamp.company ? (
        <text x="60" y="100" fontSize="6" fill="#1d4ed8" textAnchor="middle">
          {clip(stamp.company)}
        </text>
      ) : null}
    </svg>
  );
}
