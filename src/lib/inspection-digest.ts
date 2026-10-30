// Souhrnné avízo lhůt revizí (e-mail pro vedoucího údržby a technického ředitele): zařízení po
// termínu, s koncem platnosti do 14 dnů a do 30 dnů. Čisté funkce – e-mail se skládá i bez serveru.

import { BRAND } from "@/lib/brand";
import { formatDate, plural } from "@/lib/format";

export type DigestBucket = "overdue" | "within14" | "within30";

export interface DigestItem {
  id: string;
  tag: string;
  name: string;
  location: string;
  validUntil: Date;
  /** Dny do konce platnosti (záporné = po termínu). */
  daysLeft: number;
}

export const DIGEST_BUCKETS: { key: DigestBucket; title: string; color: string }[] = [
  { key: "overdue", title: "Po termínu revize", color: "#dc2626" },
  { key: "within14", title: "Konec platnosti do 14 dnů", color: "#ea580c" },
  { key: "within30", title: "Konec platnosti do 30 dnů", color: "#ca8a04" },
];

export function digestBucket(daysLeft: number): DigestBucket | null {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 14) return "within14";
  if (daysLeft <= 30) return "within30";
  return null;
}

/** Rozdělí zařízení do skupin (nejnaléhavější nahoře); zařízení s delší lhůtou vypadnou. */
export function groupDigest(items: readonly DigestItem[]): Record<DigestBucket, DigestItem[]> {
  const groups: Record<DigestBucket, DigestItem[]> = { overdue: [], within14: [], within30: [] };
  for (const item of [...items].sort((a, b) => a.daysLeft - b.daysLeft || a.tag.localeCompare(b.tag))) {
    const bucket = digestBucket(item.daysLeft);
    if (bucket) groups[bucket].push(item);
  }
  return groups;
}

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export const daysLabel = (daysLeft: number) =>
  daysLeft < 0
    ? `${Math.abs(daysLeft)} ${plural(Math.abs(daysLeft), ["den", "dny", "dní"])} po termínu`
    : daysLeft === 0
      ? "končí dnes"
      : `zbývá ${daysLeft} ${plural(daysLeft, ["den", "dny", "dní"])}`;

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
  itemCount: number;
}

/** E-mail se souhrnem: HTML s inline styly (e-mailoví klienti neznají CSS třídy) a textová verze. */
export function buildDigestEmail({ plantName, items, origin, now }: { plantName: string; items: readonly DigestItem[]; origin: string; now: Date }): DigestEmail {
  const groups = groupDigest(items);
  const count = DIGEST_BUCKETS.reduce((sum, bucket) => sum + groups[bucket.key].length, 0);
  const plannerUrl = `${origin}/inspections/planner`;
  const subject = count
    ? `${BRAND.name}: ${count} ${plural(count, ["zařízení vyžaduje", "zařízení vyžadují", "zařízení vyžaduje"])} revizi – ${plantName}`
    : `${BRAND.name}: všechny revize v pořádku – ${plantName}`;

  const sections = DIGEST_BUCKETS.filter((bucket) => groups[bucket.key].length).map((bucket) => {
    const rows = groups[bucket.key]
      .map(
        (item) => `<tr>
  <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;font-family:monospace;font-weight:700"><a href="${esc(`${origin}/equipment/${item.id}`)}" style="color:#0f172a">${esc(item.tag)}</a></td>
  <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7">${esc(item.name.replace(`${item.tag} - `, ""))}<br><span style="color:#71717a;font-size:12px">${esc(item.location)}</span></td>
  <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;white-space:nowrap">${esc(formatDate(item.validUntil))}<br><span style="color:${bucket.color};font-size:12px;font-weight:700">${esc(daysLabel(item.daysLeft))}</span></td>
</tr>`,
      )
      .join("");
    return `<h2 style="margin:24px 0 8px;font-size:16px;color:${bucket.color}">${esc(bucket.title)} (${groups[bucket.key].length})</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>`;
  });

  const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
<div style="max-width:640px;margin:0 auto;background:#fff">
<div style="background:#09090b;padding:16px 24px;border-bottom:4px solid #facc15"><span style="color:#facc15;font-weight:800;font-size:20px">EL</span><span style="color:#fff;font-weight:800;font-size:20px">DOCK</span><span style="color:#a1a1aa;font-size:12px;margin-left:12px">${esc(BRAND.tagline)}</span></div>
<div style="padding:24px">
<p style="margin:0 0 4px;color:#71717a;font-size:13px">Souhrnné avízo lhůt revizí · ${esc(formatDate(now))}</p>
<h1 style="margin:0 0 12px;font-size:20px">${esc(plantName)}</h1>
<p style="margin:0">${
    count
      ? `Dobrý den, <strong>${count} ${plural(count, ["zařízení", "zařízení", "zařízení"])}</strong> je po termínu revize nebo jim platnost končí do 30 dnů. Naplánujte prosím revize, aby nedošlo k provozu bez platné revize.`
      : "Dobrý den, žádnému zařízení nekončí platnost revize v příštích 30 dnech."
  }</p>
${sections.join("\n")}
<p style="margin:28px 0 8px"><a href="${esc(plannerUrl)}" style="display:inline-block;background:#facc15;color:#09090b;font-weight:700;padding:12px 20px;border-radius:8px;text-decoration:none">Otevřít plánovač revizí</a></p>
<p style="margin:16px 0 0;color:#71717a;font-size:12px">Automatická zpráva systému ${esc(BRAND.name)} (${esc(BRAND.domain)}) pro vedoucího údržby a technického ředitele.</p>
</div></div></body></html>`;

  const textSections = DIGEST_BUCKETS.filter((bucket) => groups[bucket.key].length).map(
    (bucket) =>
      `${bucket.title.toUpperCase()} (${groups[bucket.key].length})\n` +
      groups[bucket.key].map((item) => `- ${item.tag} – ${item.name.replace(`${item.tag} - `, "")} (${item.location}): ${formatDate(item.validUntil)}, ${daysLabel(item.daysLeft)}\n  ${origin}/equipment/${item.id}`).join("\n"),
  );
  const text = [
    `Souhrnné avízo lhůt revizí – ${plantName} (${formatDate(now)})`,
    "",
    count ? `${count} zařízení vyžaduje pozornost.` : "Žádnému zařízení nekončí platnost revize v příštích 30 dnech.",
    "",
    ...textSections.flatMap((section) => [section, ""]),
    `Plánovač revizí: ${plannerUrl}`,
  ].join("\n");

  return { subject, html, text, itemCount: count };
}
