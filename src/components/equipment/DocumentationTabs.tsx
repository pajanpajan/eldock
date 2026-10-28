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

type TabValue = (typeof TABS)[number]["value"];

/** Záložky dokumentace; aktivní záložka je v URL (`?tab=`), aby přežila reload a šla sdílet. */
export function DocumentationTabs({ panels }: { panels: Record<TabValue, ReactNode> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = TABS.find((tab) => tab.value === searchParams.get("tab"))?.value ?? "schema";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={onChange} className="gap-4">
      <TabsList className="h-auto! w-full flex-wrap justify-start gap-1 bg-card p-1 sm:w-fit">
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className="touch-target flex-none gap-2 px-4 data-active:bg-primary data-active:text-primary-foreground">
            <Icon className="size-4" aria-hidden />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map(({ value }) => (
        <TabsContent key={value} value={value}>
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
