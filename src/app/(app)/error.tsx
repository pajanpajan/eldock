"use client";

import { useEffect } from "react";
import { OctagonAlert } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      className="my-auto"
      icon={OctagonAlert}
      title="Něco se pokazilo"
      description="Stránku se nepodařilo načíst. Zkuste to prosím znovu."
      action={
        <Button className="touch-target" onClick={() => retry()}>
          Zkusit znovu
        </Button>
      }
    />
  );
}
