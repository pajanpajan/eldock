import "server-only";

import { headers } from "next/headers";

/** Veřejný původ aplikace podle hlaviček požadavku (za Caddy https://eldock.cz, v hale i přes IP). */
export async function requestOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
