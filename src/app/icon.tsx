import { brandIcon } from "@/lib/brand-icon";

// Favicon a ikony pro manifest PWA: /icon/32, /icon/192, /icon/512, /icon/maskable.
const SIZES = { "32": 32, "192": 192, "512": 512, maskable: 512 } as const;

export function generateImageMetadata() {
  return Object.entries(SIZES).map(([id, size]) => ({ id, size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const key = String(await id) as keyof typeof SIZES;
  return brandIcon(SIZES[key] ?? 32, { padded: key === "maskable" });
}
