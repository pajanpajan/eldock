"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TabValue = "schema" | "bom" | "redlines" | "3d" | "history" | "docs" | "software" | "passport" | "inspections" | "diagnostics";

// Fáze 116: lišta záložek je první věc pod hlavičkou stroje / rozváděče (identifikační pruh až pod ní).
const TABS: readonly { value: TabValue; label: string }[] = [
  { value: "schema", label: "📐 Schéma" },
  { value: "bom", label: "📋 Kusovník & Životnost" },
  { value: "redlines", label: "✏️ Červenky" },
  { value: "3d", label: "🧊 3D rozváděč" },
  { value: "history", label: "🕒 Historie změn" },
  { value: "passport", label: "🛡️ Pasport & Shoda (61439)" },
  { value: "inspections", label: "📅 Revize & Lhůtník" },
  { value: "docs", label: "📚 Návody & Datasheety" },
  { value: "software", label: "💾 Software & Zálohy PLC" },
  { value: "diagnostics", label: "🔍 Diagnostika & Spoje (Údržba)" },
];

interface Props {
  /** Obsah záložek; záložka bez panelu se nezobrazí (lehká karta spotřebiče). */
  panels: Partial<Record<TabValue, ReactNode>>;
  defaultTab?: TabValue;
  labels?: Partial<Record<TabValue, string>>;
  /** Fáze 116: mezi lištou záložek a obsahem (upozornění, kompaktní identifikační pruh). */
  beforeContent?: ReactNode;
}

/** Záložky dokumentace; aktivní záložka je v URL (`?tab=`), aby přežila reload a šla sdílet. */
export function DocumentationTabs({ panels, defaultTab = "schema", labels, beforeContent }: Props) {
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
    <Tabs value={current} onValueChange={onChange} className="gap-3">
      {/* Jeden řádek i na noteboocích 1280–1440 px: vodorovný posun místo zalomení do dvou řádků (fáze 48) */}
      <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" data-testid="equipment-tabs">
        <TabsList className="h-auto! w-max flex-nowrap justify-start gap-1 bg-card p-1">
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="touch-target flex-none gap-1.5 px-3 whitespace-nowrap data-active:bg-primary data-active:text-primary-foreground" data-tab={value}>
              {labels?.[value] ?? label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {beforeContent}
      {tabs.map(({ value }) => (
        <TabsContent key={value} value={value}>
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
