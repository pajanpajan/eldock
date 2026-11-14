// Fáze 116: Červenky (polní zákresy a požadavky na změnu) jednoho stroje / rozváděče – stav pro údržbu podle požadavku
// na změnu a předání k překreslení (firemní projektant / ELDOCK Pool). Čisté funkce (záložka ✏️ Červenky, testy).

export type RedlineStage = "WAITING" | "INTERNAL" | "POOL" | "REVIEW" | "APPROVED" | "CANCELLED";

export interface RedlineInput {
  status: "SUBMITTED" | "IN_PROGRESS" | "WAITING_APPROVAL" | "APPROVED" | "CANCELLED";
  assigneeName: string | null;
  task: { mode: string; status: string; claimedBy: string | null; internalName: string | null } | null;
  /** Verze, do které byla změna schválena (platná revize vzniklá z požadavku). */
  approvedVersion: string | null;
}

export const REDLINE_STAGE_TONE: Record<RedlineStage, string> = {
  WAITING: "border-amber-400/60 bg-amber-400/10 text-amber-100",
  INTERNAL: "border-sky-400/60 bg-sky-400/10 text-sky-100",
  POOL: "border-violet-400/60 bg-violet-400/10 text-violet-100",
  REVIEW: "border-orange-400/60 bg-orange-400/10 text-orange-100",
  APPROVED: "border-emerald-500/60 bg-emerald-500/10 text-emerald-100",
  CANCELLED: "border-border bg-muted text-muted-foreground",
};

/** Stav Červenky: Čeká na překreslení → Přiřazeno internímu projektantovi / V ELDOCK Poolu → ke schválení → Schváleno do vX.Y. */
export function redlineStage(input: RedlineInput): { stage: RedlineStage; label: string } {
  if (input.status === "CANCELLED") return { stage: "CANCELLED", label: "Stornováno" };
  if (input.status === "APPROVED") return { stage: "APPROVED", label: input.approvedVersion ? `Schváleno do ${input.approvedVersion}` : "Schváleno" };
  if (input.status === "WAITING_APPROVAL") return { stage: "REVIEW", label: "Nová verze schématu čeká na schválení údržbou" };
  const task = input.task && input.task.status !== "CANCELLED" ? input.task : null;
  if (task?.mode === "POOL") return { stage: "POOL", label: task.claimedBy ? `V ELDOCK Poolu – překresluje ${task.claimedBy}` : "V ELDOCK Poolu – čeká na přijetí projektantem" };
  if (task?.mode === "INTERNAL_DESIGNER" && task.internalName) return { stage: "INTERNAL", label: `Přiřazeno internímu projektantovi (${task.internalName})` };
  if (input.status === "IN_PROGRESS" && input.assigneeName) return { stage: "INTERNAL", label: `Přiřazeno internímu projektantovi (${input.assigneeName})` };
  return { stage: "WAITING", label: "Čeká na překreslení" };
}

/** Lze ještě předat k překreslení (otevřený požadavek bez přijatého úkolu v Poolu). */
export const canRouteRedline = (input: Pick<RedlineInput, "status" | "task">) =>
  (input.status === "SUBMITTED" || input.status === "IN_PROGRESS") && !(input.task && input.task.mode === "POOL" && input.task.status !== "OPEN" && input.task.status !== "CANCELLED");

export const isOpenRedline = (status: RedlineInput["status"]) => status === "SUBMITTED" || status === "IN_PROGRESS" || status === "WAITING_APPROVAL";
