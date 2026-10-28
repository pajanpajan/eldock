"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toCsv } from "@/lib/csv";

/** Tisk Knihy revizí (`@media print`, třída `.print-report`) a export CSV pro Excel. */
export function AuditReportActions({ csvRows, fileName }: { csvRows: string[][]; fileName: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([toCsv(csvRows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button size="lg" className="touch-target gap-2" onClick={() => window.print()}>
        🖨️ Tisk oficiální Knihy revizí závodu (PDF)
      </Button>
      <Button size="lg" variant="outline" className="touch-target gap-2" onClick={download}>
        <FileDown className="size-4" aria-hidden />
        Export CSV
      </Button>
    </div>
  );
}
