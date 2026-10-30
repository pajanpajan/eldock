// QR štítek zařízení: kód štítku (`Equipment.qrToken`) je součástí odkazu. Po přegenerování
// nese starý fyzický štítek neplatný kód a detail zařízení na to upozorní.

/** Rozměry štítku pro průmyslové štítkovače (Brother DK-22205 a pod.), v milimetrech. */
export const LABEL_SIZE_MM = { width: 62, height: 29 } as const;

const TOKEN_BYTES = 5;

/** Nový kód štítku: 10 hex znaků velkými písmeny (stejný formát jako migrace). */
export function newQrToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Odkaz z QR štítku: přímo na detail zařízení, s kódem štítku. */
export function labelUrl(origin: string, equipmentId: string, token: string | null): string {
  const base = `${origin.replace(/\/$/, "")}/equipment/${encodeURIComponent(equipmentId)}`;
  return token ? `${base}?qr=${token}` : base;
}

/** Kód štítku pro čtení: skupiny po pěti znacích („A3F09-C11B2“). */
export const formatQrToken = (token: string) => token.match(/.{1,5}/g)?.join("-") ?? token;

export type LabelCheck = "none" | "valid" | "replaced";

/** Ověření štítku z URL (`?qr=`): bez kódu = běžná navigace, jiný kód = štítek byl přegenerován. */
export function checkLabel(scanned: string | string[] | undefined, current: string | null): LabelCheck {
  const value = Array.isArray(scanned) ? scanned[0] : scanned;
  if (!value) return "none";
  return current && value.toUpperCase() === current.toUpperCase() ? "valid" : "replaced";
}
