"use client";

import { CONSENT_COOKIE, parseConsent, readCookie } from "@/lib/consent";
import type { TelemetryInput, TelemetryType } from "@/lib/telemetry";

// Fáze 102: odeslání události telemetrie z prohlížeče (sendBeacon / keepalive fetch, chyba sítě nic neruší). Bez
// souhlasu s analytikou se do prohlížeče nic nezapisuje ani nečte (jen cookie volby souhlasu) – událost odejde bez id.

const VISITOR_KEY = "eldock_vid";

const randomId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, "");

/** Pseudonymní id prohlížeče – jen se souhlasem s analytikou (jinak undefined, nic se neukládá). */
function visitorId(): string | undefined {
  const consent = parseConsent(readCookie(document.cookie, CONSENT_COOKIE));
  if (!consent?.analytics) return undefined;
  try {
    const stored = window.localStorage.getItem(VISITOR_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
    const fresh = randomId();
    window.localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    return undefined;
  }
}

/** Odvolaný souhlas s analytikou: smazat pseudonymní id. */
export function forgetVisitor() {
  try {
    window.localStorage.removeItem(VISITOR_KEY);
  } catch {
    // bez úložiště není co mazat
  }
}

/** Doména odkazující stránky (bez cesty a dotazu) – jen z jiného webu. */
function referrerOrigin(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const url = new URL(document.referrer);
    return url.origin === location.origin ? undefined : url.origin;
  } catch {
    return undefined;
  }
}

/** Událost produktové telemetrie (`page_view` posílá AnalyticsProvider sám při každém přechodu stránky). */
export function track(type: TelemetryType, props?: Record<string, string | number | boolean>, extra: Partial<Pick<TelemetryInput, "landing">> = {}) {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(location.search);
    const utm = { source: params.get("utm_source") ?? undefined, medium: params.get("utm_medium") ?? undefined, campaign: params.get("utm_campaign") ?? undefined };
    const payload: TelemetryInput = {
      type,
      path: location.pathname.slice(0, 300) || "/",
      ...(referrerOrigin() ? { referrer: referrerOrigin() } : {}),
      ...(utm.source || utm.medium || utm.campaign ? { utm } : {}),
      ...(props ? { props } : {}),
      ...extra,
    };
    const id = visitorId();
    if (id) payload.visitorId = id;
    const body = JSON.stringify(payload);
    const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }));
    if (!sent) void fetch("/api/telemetry", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  } catch {
    // telemetrie nikdy nesmí rozbít aplikaci
  }
}
