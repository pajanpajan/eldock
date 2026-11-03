import { notFound } from "next/navigation";

import { canAccessPlant } from "@/server/queries/plant";

/** Závod jen pro oprávněné: registrovaná firma vidí svůj závod, obchodní demo jen demo závody (fáze 41). */
export default async function PlantLayout({ children, params }: LayoutProps<"/plant/[plantId]">) {
  if (!(await canAccessPlant((await params).plantId))) notFound();
  return children;
}
