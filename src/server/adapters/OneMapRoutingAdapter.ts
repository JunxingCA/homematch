import "server-only";
import { z } from "zod";
import polyline from "@mapbox/polyline";
import type { Point, RouteEvidence } from "@/domain/recommendations";
import type { Preference } from "@/domain/preferences";
import { oneMap } from "../providers/oneMap";
import { AppError } from "../http";
import { OneMapError } from "../providers/oneMapClient.mjs";

const number = z.number().finite().nonnegative();
const driveSchema = z.object({
  status: z.literal(0),
  route_geometry: z.string(),
  route_summary: z.object({ total_time: number, total_distance: number }),
});
const transitSchema = z.object({
  plan: z.object({
    itineraries: z
      .array(
        z.object({
          duration: number,
          legs: z
            .array(
              z.object({
                distance: number,
                legGeometry: z.object({ points: z.string() }),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  }),
});
type Route = Pick<RouteEvidence, "minutes" | "metres" | "geometry">;
const cache = new Map<string, { value: Route; expires: number }>();

export class OneMapRoutingAdapter {
  async route(
    start: Point,
    destination: Preference["destinations"][number],
    departure: string,
    signal: AbortSignal,
  ): Promise<RouteEvidence> {
    if (!destination.location)
      throw new AppError(
        "UNRESOLVED_LOCATION",
        "Select all destination addresses first.",
        422,
      );
    const end = destination.location;
    const key = JSON.stringify([
      start.latitude,
      start.longitude,
      end.latitude,
      end.longitude,
      destination.mode,
      departure,
    ]);
    const cached = cache.get(key);
    let route: Route;
    if (cached && cached.expires > Date.now()) route = cached.value;
    else {
      const url = new URL(
        "https://www.onemap.gov.sg/api/public/routingsvc/route",
      );
      url.search = new URLSearchParams({
        start: `${start.latitude},${start.longitude}`,
        end: `${end.latitude},${end.longitude}`,
        routeType: destination.mode === "public" ? "pt" : "drive",
      }).toString();
      if (destination.mode === "public") {
        const [year, month, day] = departure.slice(0, 10).split("-");
        url.searchParams.set("date", `${month}-${day}-${year}`);
        url.searchParams.set("time", "08:00:00");
        url.searchParams.set("mode", "TRANSIT");
        url.searchParams.set("numItineraries", "1");
      }
      try {
        const raw = await oneMap.json(url, { signal, timeoutMs: 15000 });
        if (destination.mode === "private") {
          const data = driveSchema.parse(raw);
          route = {
            minutes: data.route_summary.total_time / 60,
            metres: data.route_summary.total_distance,
            geometry: [polyline.decode(data.route_geometry)],
          };
        } else {
          const data = transitSchema.parse(raw).plan.itineraries[0];
          route = {
            minutes: data.duration / 60,
            metres: data.legs.reduce((sum, leg) => sum + leg.distance, 0),
            geometry: data.legs.map((leg) =>
              polyline.decode(leg.legGeometry.points),
            ),
          };
        }
        if (
          route.geometry.some(
            (line) =>
              !line.length ||
              line.some(
                (p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]),
              ),
          )
        )
          throw Error("Invalid route geometry");
        if (cache.size >= 500) cache.delete(cache.keys().next().value!);
        cache.set(key, { value: route, expires: Date.now() + 3600000 });
      } catch (error) {
        if (error instanceof OneMapError && error.retryAfter)
          throw new AppError(
            "ONEMAP_RATE_LIMIT",
            "OneMap is temporarily limiting route requests. Keep your preferences and retry later.",
            503,
            true,
            error.retryAfter,
          );
        throw new AppError(
          "ROUTING_UNAVAILABLE",
          `OneMap could not calculate a ${destination.mode === "public" ? "public transport" : "driving"} route to ${destination.location.label}. Retry the search or select another entrance for that destination.`,
          503,
          true,
        );
      }
    }
    return {
      ...route,
      destination: end.label,
      visits: destination.visits,
      mode: destination.mode,
    };
  }
}
