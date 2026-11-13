import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { labelSetsOf, operatorProfileOf, paymentAccount as paymentAccountOf } from "@/server/services/operator";

// Fáze 112: údaje provozovatele a sady QR štítků pro stránky (jednou za požadavek, globální klient Prisma).

/** Provozovatel pro patičku, faktury, VOP a zásady. */
export const getOperatorProfile = cache(() => operatorProfileOf(prisma));

/** Sady QR štítků k objednání (ceník z velínu). */
export const getLabelSets = cache(() => labelSetsOf(prisma));

/** Účet pro QR platbu a zálohové faktury (IBAN z velínu, jinak z prostředí / výchozí). */
export const paymentAccount = cache(() => paymentAccountOf(prisma));
