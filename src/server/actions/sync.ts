"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { pairingUri } from "@/lib/sync";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { requestOrigin } from "@/server/request-url";
import { createPairingCode, revokeDevice } from "@/server/services/sync";
import { getAuthState, getCurrentAccount } from "@/server/session";

import type { ActionResult } from "./workflow";

// Fáze 70: párování a odpojení aplikací (Windows, iOS, Android) – „Můj účet“ a Administrace → Zařízení.

const id = z.string().min(1).max(64);

async function run<T>(action: () => Promise<T>, fallback: string, paths: string[]): Promise<ActionResult<T>> {
  try {
    const data = await action();
    for (const path of paths) revalidatePath(path);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: fallback };
  }
}

async function signedInMember() {
  const state = await getAuthState();
  if (!state.user?.companyId) throw new WorkflowError("FORBIDDEN", "Aplikace pro Windows, iOS a Android jsou pro účty registrovaných firem – přihlaste se účtem své firmy.");
  return { ...state.user, companyId: state.user.companyId };
}

/** Kód párování (10 minut) a obsah QR s adresou tohoto serveru. */
export async function createPairingCodeAction() {
  return run(
    async () => {
      const user = await signedInMember();
      const { code, expiresAt } = await createPairingCode(prisma, { userId: user.id });
      const server = await requestOrigin();
      return { code, expiresAt: expiresAt.toISOString(), server, uri: pairingUri(server, code) };
    },
    "Kód párování se nepodařilo vytvořit.",
    [],
  );
}

/** Odpojí vlastní zařízení. */
export async function revokeMyDeviceAction(deviceId: string) {
  return run(
    async () => {
      const user = await signedInMember();
      return revokeDevice(prisma, { deviceId: id.parse(deviceId), actorId: user.id, companyId: user.companyId, admin: false, reason: "odpojeno v Můj účet" });
    },
    "Zařízení se nepodařilo odpojit.",
    ["/ucet", "/admin/devices"],
  );
}

/** Technický ředitel odpojí kterékoli zařízení firmy (ztracený telefon, odchod zaměstnance). */
export async function revokeCompanyDeviceAction(deviceId: string) {
  return run(
    async () => {
      const account = await getCurrentAccount();
      if (!account.can("manageUsers") || !account.user.companyId) throw new WorkflowError("FORBIDDEN", "Zařízení firmy odpojuje technický ředitel registrované firmy.");
      return revokeDevice(prisma, { deviceId: id.parse(deviceId), actorId: account.user.id, companyId: account.user.companyId, admin: true, reason: "odpojeno správcem firmy" });
    },
    "Zařízení se nepodařilo odpojit.",
    ["/ucet", "/admin/devices"],
  );
}

/**
 * Fáze 72: kód pro server závodu (10 minut, jednou) – jen správce firmy. Server závodu ho zadá ve své správě spolu
 * s adresou tohoto serveru a dál se synchronizuje jako zařízení `PLANT_SERVER`.
 */
export async function createPlantServerPairingAction() {
  return run(
    async () => {
      const account = await getCurrentAccount();
      if (!account.can("manageUsers") || !account.user.companyId) throw new WorkflowError("FORBIDDEN", "Server závodu páruje jen technický ředitel nebo správce registrované firmy.");
      const { code, expiresAt } = await createPairingCode(prisma, { userId: account.user.id, purpose: "PLANT_SERVER" });
      return { code, expiresAt: expiresAt.toISOString(), server: await requestOrigin() };
    },
    "Kód pro server závodu se nepodařilo vytvořit.",
    [],
  );
}
