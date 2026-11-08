import "server-only";

import { prisma } from "@/lib/prisma";
import { SYNC_POLICY, deviceSyncState, type DeviceSyncState } from "@/lib/sync";

// Fáze 70: spárované aplikace pro „Můj účet“ a Administraci → Zařízení.

export interface DeviceRow {
  id: string;
  name: string;
  platform: string;
  appVersion: string | null;
  createdAt: string;
  lastSeenAt: string;
  lastPullAt: string | null;
  lastPushAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  state: DeviceSyncState;
  user: { id: string; name: string } | null;
  /** Úpravy z aplikace za posledních 7 dní (provedené / odmítnuté). */
  applied: number;
  rejected: number;
}

const DEVICE_SELECT = { id: true, name: true, platform: true, appVersion: true, createdAt: true, lastSeenAt: true, lastPullAt: true, lastPushAt: true, revokedAt: true, revokedReason: true, user: { select: { id: true, name: true } } } as const;

async function withCounts(devices: Awaited<ReturnType<typeof loadDevices>>, now: Date): Promise<DeviceRow[]> {
  const ids = devices.map((device) => device.id);
  const counts = ids.length
    ? await prisma.syncMutation.groupBy({ by: ["deviceId", "status"], where: { deviceId: { in: ids }, receivedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, _count: { _all: true } })
    : [];
  const count = (deviceId: string, status: "APPLIED" | "REJECTED") => counts.find((row) => row.deviceId === deviceId && row.status === status)?._count._all ?? 0;
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    platform: device.platform,
    appVersion: device.appVersion,
    createdAt: device.createdAt.toISOString(),
    lastSeenAt: device.lastSeenAt.toISOString(),
    lastPullAt: device.lastPullAt?.toISOString() ?? null,
    lastPushAt: device.lastPushAt?.toISOString() ?? null,
    revokedAt: device.revokedAt?.toISOString() ?? null,
    revokedReason: device.revokedReason,
    state: deviceSyncState(device, now),
    user: device.user,
    applied: count(device.id, "APPLIED"),
    rejected: count(device.id, "REJECTED"),
  }));
}

function loadDevices(where: { userId?: string; companyId?: string; revokedAt?: null }) {
  return prisma.syncDevice.findMany({ where, orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { lastSeenAt: "desc" }], select: DEVICE_SELECT });
}

/** Aktivní aplikace přihlášeného uživatele („Můj účet“). */
export async function getMyDevices(userId: string) {
  const now = new Date();
  return withCounts(await loadDevices({ userId, revokedAt: null }), now);
}

/** Všechna zařízení firmy včetně odpojených (drží se `SYNC_POLICY.revokedDeviceDays` dní) – technický ředitel. */
export async function getCompanyDevices(companyId: string) {
  const now = new Date();
  const devices = await withCounts(await loadDevices({ companyId }), now);
  const rejected = await prisma.syncMutation.findMany({
    where: { status: "REJECTED", user: { companyId }, receivedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    orderBy: { receivedAt: "desc" },
    take: 20,
    select: { id: true, type: true, code: true, message: true, receivedAt: true, user: { select: { name: true } }, device: { select: { name: true } } },
  });
  return {
    devices,
    rejected: rejected.map((row) => ({ id: row.id, type: row.type, code: row.code, message: row.message, receivedAt: row.receivedAt.toISOString(), user: row.user.name, device: row.device?.name ?? null })),
    policy: { staleAfterHours: SYNC_POLICY.staleAfterHours, idleExpiryDays: SYNC_POLICY.idleExpiryDays },
  };
}
