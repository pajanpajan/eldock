"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCommentAction } from "@/server/actions/workflow";

/** Komentář do timeline ticketu. */
export function CommentForm({ changeRequestId }: { changeRequestId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    startTransition(async () => {
      const result = await addCommentAction({ changeRequestId, comment });
      if (result.ok) {
        setComment("");
        toast.success("Komentář přidán.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Dotaz na technika, upřesnění, stav zpracování…"
        aria-label="Komentář"
        rows={3}
        maxLength={4000}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit(event);
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Ctrl + Enter odešle</span>
        <Button type="submit" className="touch-target gap-2" disabled={pending || !comment.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Přidat komentář
        </Button>
      </div>
    </form>
  );
}
