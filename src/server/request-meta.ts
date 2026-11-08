import "server-only";

import { headers } from "next/headers";

import { deviceLabel, ipKeyOf } from "@/server/services/account-security";

/** IP klienta za reverzní proxy (Caddy nastaví X-Forwarded-For) jen jako HMAC a popis zařízení z User-Agent (fáze 67). */
export async function requestMeta() {
  const list = await headers();
  const ip = (list.get("x-forwarded-for")?.split(",")[0] ?? list.get("x-real-ip") ?? "").trim() || null;
  return { ipKey: ipKeyOf(ip), device: deviceLabel(list.get("user-agent")) };
}
