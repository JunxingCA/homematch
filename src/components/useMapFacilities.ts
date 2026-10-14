"use client";
import { useEffect, useState } from "react";
import {
  mapFacilitiesSchema,
  type MapFacilities,
} from "@/domain/mapFacilities";

export function useMapFacilities(
  discoveryId: string | undefined,
  areaId: string | undefined,
  radius: number,
) {
  const [retry, setRetry] = useState(0);
  const key = `${discoveryId}:${areaId}:${radius}:${retry}`;
  const [response, setResponse] = useState<{
    key: string;
    data: MapFacilities | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!discoveryId || !areaId) return;
    const abort = new AbortController();
    const load = async () => {
      try {
        const result = await fetch(
          `/api/discoveries/${discoveryId}/facilities?${new URLSearchParams({ areaId, radius: String(radius) })}`,
          { signal: abort.signal, cache: "no-store" },
        );
        const json = await result.json();
        if (!result.ok)
          throw Error(
            json.error?.message ?? "Nearby amenities could not be loaded.",
          );
        const data = mapFacilitiesSchema.parse(json.facilities);
        if (data.origin.id !== areaId || data.radius !== radius)
          throw Error("Nearby amenity response does not match this area.");
        if (!abort.signal.aborted) setResponse({ key, data, error: null });
      } catch (error) {
        if (!abort.signal.aborted)
          setResponse({
            key,
            data: null,
            error:
              error instanceof Error && !(error.name === "ZodError")
                ? error.message
                : "Nearby amenities could not be validated.",
          });
      }
    };
    void load();
    return () => abort.abort();
  }, [discoveryId, areaId, radius, retry, key]);
  const current = response?.key === key ? response : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: Boolean(discoveryId && areaId && !current),
    retry: () => setRetry((n) => n + 1),
  };
}
