"use client";

import { useEffect } from "react";

import type { ContactCategory, ContactDiagnostics } from "@/lib/contact";

// Fáze 107: otevření kontaktního modalu odkudkoli (plovoucí tlačítko, „Nahlásit chybu“ v editorech, odkazy) bez
// sdíleného kontextu Reactu – událost okna, kterou poslouchá `GlobalContactWidget` v hlavním layoutu.

export const CONTACT_OPEN_EVENT = "eldock:contact-open";

export interface ContactOpenRequest {
  category?: ContactCategory;
  /** Diagnostika, kterou zná jen otevírající místo (projekt, modul, krok průvodce). */
  context?: Partial<Pick<ContactDiagnostics, "module" | "projectId" | "wizardPhase">>;
}

export function openContactModal(request: ContactOpenRequest = {}) {
  window.dispatchEvent(new CustomEvent<ContactOpenRequest>(CONTACT_OPEN_EVENT, { detail: request }));
}

/** Kontext stránky, který editor průběžně hlásí (2D půdorys: id půdorysu a aktivní fáze průvodce). */
let pageContext: ContactOpenRequest["context"] = {};

export const contactPageContext = () => pageContext;

/** Editor zapíše svůj kontext, dokud je na stránce (diagnostika zprávy z plovoucího tlačítka). */
export function useContactPageContext(context: NonNullable<ContactOpenRequest["context"]>) {
  const { module, projectId, wizardPhase } = context;
  useEffect(() => {
    pageContext = { module, projectId, wizardPhase };
    return () => {
      pageContext = {};
    };
  }, [module, projectId, wizardPhase]);
}
