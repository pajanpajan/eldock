import { redirect } from "next/navigation";

// Fáze 111: česká adresa rychlé revize ze zadání – `/rychla-revize` vede na `/inspections/rapid` (i s parametry).
export default async function RychlaRevizePage({ searchParams }: PageProps<"/rychla-revize">) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const query = params.toString();
  redirect(query ? `/inspections/rapid?${query}` : "/inspections/rapid");
}
