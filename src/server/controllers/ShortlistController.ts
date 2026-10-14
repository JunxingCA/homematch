import "server-only";
import { z } from "zod";
import { saveAreaSchema, savedArea } from "@/domain/shortlist";
import type { Discovery } from "@/domain/recommendations";
import { requireSession } from "../supabase";
import { AppError } from "../http";

function check(error: { code?: string } | null) {
  if (error)
    throw new AppError(
      "SHORTLIST_UNAVAILABLE",
      "Saved areas are unavailable. Please retry.",
      503,
      true,
    );
}
export class ShortlistController {
  async list() {
    const { client, user } = await requireSession();
    const { data, error } = await client
      .from("saved_areas")
      .select("id,created_at,discovery_id,area_id,discoveries!inner(payload)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    check(error);
    return (data ?? []).map((row) => {
      const source = row.discoveries as unknown as { payload: Discovery };
      return savedArea(row, source.payload);
    });
  }
  async add(input: unknown) {
    const { discoveryId, areaId } = saveAreaSchema.parse(input);
    const { client, user } = await requireSession();
    const { data: discovery, error: readError } = await client
      .from("discoveries")
      .select("payload")
      .eq("id", discoveryId)
      .eq("user_id", user.id)
      .maybeSingle();
    check(readError);
    if (
      !discovery ||
      !(discovery.payload as Discovery).results.some(
        (r) => r.area.id === areaId,
      )
    )
      throw new AppError(
        "NOT_FOUND",
        "This area is not in one of your saved searches.",
        404,
      );
    const { error } = await client
      .from("saved_areas")
      .upsert(
        { user_id: user.id, discovery_id: discoveryId, area_id: areaId },
        { onConflict: "user_id,area_id", ignoreDuplicates: true },
      );
    check(error);
    // A duplicate keeps its first source search rather than overwriting evidence.
    const { data, error: loadError } = await client
      .from("saved_areas")
      .select("id,created_at,discovery_id,area_id,discoveries!inner(payload)")
      .eq("user_id", user.id)
      .eq("area_id", areaId)
      .single();
    check(loadError);
    const source = data!.discoveries as unknown as { payload: Discovery };
    return savedArea(data!, source.payload);
  }
  async remove(id: string) {
    const { client, user } = await requireSession();
    const { data, error } = await client
      .from("saved_areas")
      .delete()
      .eq("id", z.uuid().parse(id))
      .eq("user_id", user.id)
      .select("id");
    check(error);
    if (!data?.length)
      throw new AppError(
        "NOT_FOUND",
        "Saved area not found. Refresh your shortlist.",
        404,
      );
  }
}
