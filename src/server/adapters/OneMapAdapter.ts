import "server-only";
import { z } from "zod";
import { locationSchema } from "@/domain/preferences";
import { config } from "../config";
import { AppError } from "../http";
import { adminClient } from "../supabase";

const responseSchema = z.object({
  results: z.array(
    z.object({
      ADDRESS: z.string(),
      LATITUDE: z.string(),
      LONGITUDE: z.string(),
    }),
  ),
});
export class OneMapAdapter {
  async search(query: string) {
    const token = config().ONEMAP_TOKEN;
    if (!token)
      throw new AppError(
        "ONEMAP_UNAVAILABLE",
        "OneMap address search is not configured. Your entries have been kept.",
        503,
        true,
      );
    const url = new URL("https://www.onemap.gov.sg/api/common/elastic/search");
    url.search = new URLSearchParams({
      searchVal: query,
      returnGeom: "Y",
      getAddrDetails: "Y",
      pageNum: "1",
    }).toString();
    try {
      const response = await fetch(url, {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Provider failure");
      const raw = await response.json();
      if (raw.error) throw new Error("Provider auth failure");
      const locations = responseSchema
        .parse(raw)
        .results.slice(0, 10)
        .map((row) =>
          locationSchema.parse({
            id: `onemap:${row.LATITUDE}:${row.LONGITUDE}`,
            label: row.ADDRESS,
            latitude: Number(row.LATITUDE),
            longitude: Number(row.LONGITUDE),
            source: "onemap",
          }),
        );
      if (locations.length) {
        const { error } = await adminClient()
          .from("location_catalog")
          .upsert(locations, { onConflict: "id" });
        if (error) throw new Error("Catalog unavailable");
      }
      return locations;
    } catch {
      throw new AppError(
        "ONEMAP_UNAVAILABLE",
        "OneMap address search is unavailable. Keep your text and retry.",
        503,
        true,
      );
    }
  }
}
