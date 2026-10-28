"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, CalendarClock, FileBadge, FileText, History, ListTree } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "schema", label: "Schéma", icon: FileText },
  { value: "bom", label: "Kusovník", icon: ListTree },
  { value: "3d", label: "3D rozváděč", icon: Box },
  { value: "history", label: "Historie změn", icon: History },
  { value: "passport", label: "Pasport & Shoda (61439)", icon: FileBadge },
  { value: "inspections", label: "Revize & Lhůtník", icon: CalendarClock },
] as const;

export type TabValue = (typeof TABS)[number]["value"];

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
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={onChange} className="gap-4">
      <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 bg-card p-1 sm:w-fit">
        {tabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className="touch-target flex-none gap-2 px-4 data-active:bg-primary data-active:text-primary-foreground">
            <Icon className="size-4" aria-hidden />
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
