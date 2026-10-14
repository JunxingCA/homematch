import "server-only";
import { z } from "zod";
import { locationSchema } from "@/domain/preferences";
import { oneMap } from "../providers/oneMap";
import { AppError } from "../http";
import { adminClient } from "../supabase";
import { OneMapError } from "../providers/oneMapClient.mjs";

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
    const url = new URL("https://www.onemap.gov.sg/api/common/elastic/search");
    url.search = new URLSearchParams({
      searchVal: query,
      returnGeom: "Y",
      getAddrDetails: "Y",
      pageNum: "1",
    }).toString();
    try {
      const raw = await oneMap.json(url);
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
        const { data, error } = await adminClient()
          .from("location_catalog")
          .upsert(locations, { onConflict: "id" })
          .select("id,label,latitude,longitude,source");
        if (error || !data || data.length !== locations.length)
          throw new Error("Catalog unavailable");
        // Return the database's numeric representation, which the profile trigger compares.
        const stored = z.array(locationSchema).parse(data);
        return locations.map((location) => {
          const canonical = stored.find((row) => row.id === location.id);
          if (!canonical) throw new Error("Catalog result missing");
          return canonical;
        });
      }
      return locations;
    } catch (error) {
      if (error instanceof OneMapError && error.retryAfter)
        throw new AppError(
          "ONEMAP_RATE_LIMIT",
          "OneMap is temporarily limiting requests. Keep your text and retry later.",
          503,
          true,
          error.retryAfter,
        );
      throw new AppError(
        "ONEMAP_UNAVAILABLE",
        "OneMap address search is unavailable. Keep your text and retry.",
        503,
        true,
      );
    }
  }
}
