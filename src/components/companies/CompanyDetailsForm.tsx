"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateCompanyDetailsAction } from "@/server/actions/companies";

import { CompanyFields, type CompanyForm } from "./CompanyFields";

/** „Firemní údaje do razítka“: úprava kdykoli, propíše se do všech listů dokumentace rozváděčů firmy. */
export function CompanyDetailsForm({ initial }: { initial: CompanyForm }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [invalid, setInvalid] = useState<string | undefined>();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateCompanyDetailsAction(value);
          if (!result.ok) {
            setInvalid(result.field);
            return void toast.error(result.error);
          }
          setInvalid(undefined);
          toast.success("Firemní údaje uloženy – propíší se do razítka a dokumentace.");
          router.refresh();
        });
      }}
    >
      <CompanyFields idPrefix="pb-company" value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} invalidField={invalid} />
      <Button type="submit" className="touch-target gap-2" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />} Uložit firemní údaje
      </Button>
    </form>
  );
}
