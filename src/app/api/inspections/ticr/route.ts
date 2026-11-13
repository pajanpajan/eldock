import { MONTH_PATTERN } from "@/lib/revision-signature";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPermission } from "@/server/permissions";
import { getTicrProfiles, getTicrReport } from "@/server/queries/ticr-report";
import { getAuthState } from "@/server/session";
import { monthlyCsv } from "@/server/services/revision-signing";

/** Fáze 108: měsíční výkaz revizí pod číslem osvědčení TIČR jako CSV (`?profile=&month=YYYY-MM`). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const profileId = url.searchParams.get("profile") ?? "";
  if (!MONTH_PATTERN.test(month) || !profileId) return Response.json({ error: "Zadejte profil technika a měsíc." }, { status: 400 });
  if ((await getAuthState()).revoked) return Response.json({ error: "Přihlášení vypršelo – přihlaste se znovu." }, { status: 401 });
  try {
    await assertPermission("recordInspection");
  } catch (error) {
    if (error instanceof WorkflowError) return Response.json({ error: error.message }, { status: 403 });
    throw error;
  }
  const profile = (await getTicrProfiles()).find((entry) => entry.id === profileId);
  if (!profile) return Response.json({ error: "Profil revizního technika nebyl nalezen." }, { status: 404 });
  const report = await getTicrReport(profile, month);
  const safe = profile.certificateNo.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "ticr";
  return new Response(monthlyCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vykaz-revizi-${safe}-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
