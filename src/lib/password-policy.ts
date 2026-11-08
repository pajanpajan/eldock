// Pravidla hesla uživatelů registrovaných firem (fáze 67). Čistá funkce – formuláře i služby.
// Podle doporučení NIST SP 800-63B: délka a odmítnutí běžných / odvoditelných hesel, bez nucených kombinací znaků.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/** Nejběžnější hesla a slova, ze kterých se hesla skládají (porovnává se bez číslic, znaků a diakritiky). */
const COMMON_WORDS = new Set([
  "heslo",
  "hesloheslo",
  "password",
  "passw",
  "eldock",
  "digitry",
  "qwertz",
  "qwerty",
  "asdfgh",
  "yxcvbn",
  "abcdef",
  "abcdefgh",
  "admin",
  "administrator",
  "letmein",
  "welcome",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "superman",
  "sunshine",
  "princess",
  "trustno",
  "changeme",
  "zmenit",
  "prihlaseni",
  "revize",
  "udrzba",
  "elektro",
  "rozvadec",
]);

const SEQUENCES = ["0123456789", "1234567890", "9876543210", "abcdefghijklmnopqrstuvwxyz", "qwertzuiop", "qwertyuiop", "asdfghjkl", "yxcvbnm"];

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nesplněná pravidla hesla (prázdné pole = heslo vyhovuje). */
export function passwordIssues(password: string, context: { email?: string | null; name?: string | null } = {}): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`Heslo musí mít aspoň ${PASSWORD_MIN_LENGTH} znaků.`);
  if (password.length > PASSWORD_MAX_LENGTH) issues.push(`Heslo může mít nejvýš ${PASSWORD_MAX_LENGTH} znaků.`);
  const folded = fold(password);
  const letters = folded.replace(/[^a-z]/g, "");
  if (/^(.)\1+$/.test(password) || (folded.length >= 4 && SEQUENCES.some((sequence) => sequence.includes(folded)))) {
    issues.push("Heslo nesmí být řada stejných nebo po sobě jdoucích znaků.");
  } else if (COMMON_WORDS.has(letters)) {
    issues.push("Heslo je příliš běžné – zvolte delší větu nebo kombinaci slov.");
  }
  const local = fold(context.email?.split("@")[0] ?? "");
  if (local.length >= 4 && folded.includes(local)) issues.push("Heslo nesmí obsahovat e-mail.");
  const names = fold(context.name ?? "")
    .split(/[^a-z]+/)
    .filter((part) => part.length >= 4);
  if (names.some((part) => folded.includes(part))) issues.push("Heslo nesmí obsahovat vaše jméno.");
  return issues;
}
