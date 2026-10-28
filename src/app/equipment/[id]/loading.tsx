import { Skeleton } from "@/components/ui/skeleton";

// Skeleton detailu zařízení: drobečky, hlavička, banner a záložky dokumentace se schématem.
export default function EquipmentLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Načítání zařízení">
      <div className="space-y-3">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="aspect-[1.414] w-full rounded-xl" />
    </div>
  );
}
