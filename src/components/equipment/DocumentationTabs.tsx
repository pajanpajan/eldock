"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, CalendarClock, FileBadge, FileText, History, ListTree, type LucideIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TabValue = "schema" | "bom" | "3d" | "history" | "passport" | "inspections" | "diagnostics";

const TABS: readonly { value: TabValue; label: string; icon: LucideIcon | null }[] = [
  { value: "schema", label: "Schéma", icon: FileText },
  { value: "bom", label: "Kusovník", icon: ListTree },
  { value: "3d", label: "3D rozváděč", icon: Box },
  { value: "history", label: "Historie změn", icon: History },
  { value: "passport", label: "Pasport & Shoda (61439)", icon: FileBadge },
  { value: "inspections", label: "Revize & Lhůtník", icon: CalendarClock },
  { value: "diagnostics", label: "🔍 Diagnostika & Spoje (Údržba)", icon: null },
];

interface Props {
  /** Obsah záložek; záložka bez panelu se nezobrazí (lehká karta spotřebiče). */
  panels: Partial<Record<TabValue, ReactNode>>;
  defaultTab?: TabValue;
  labels?: Partial<Record<TabValue, string>>;
}

/** Záložky dokumentace; aktivní záložka je v URL (`?tab=`), aby přežila reload a šla sdílet. */
export function DocumentationTabs({ panels, defaultTab = "schema", labels }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = TABS.filter((tab) => tab.value in panels);
  const current = tabs.find((tab) => tab.value === searchParams.get("tab"))?.value ?? defaultTab;

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    // List knihy patří jen k záložce Schéma.
    if (value !== "schema") {
      params.delete("sheet");
      params.delete("col");
    }
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={onChange} className="gap-4">
      <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 bg-card p-1 sm:w-fit">
        {tabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className="touch-target flex-none gap-2 px-4 data-active:bg-primary data-active:text-primary-foreground">
            {Icon ? <Icon className="size-4" aria-hidden /> : null}
            {labels?.[value] ?? label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({ value }) => (
        <TabsContent key={value} value={value}>
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
