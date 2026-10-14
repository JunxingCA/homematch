import "server-only";
import {
  snapshotSchema,
  type ResearchSnapshot,
} from "@/domain/recommendations";
import { adminClient } from "../supabase";
import { AppError } from "../http";

let cached: { snapshot: ResearchSnapshot; expires: number } | undefined;
let loading: Promise<ResearchSnapshot> | undefined;
export class DataGovAdapter {
  async snapshot(): Promise<ResearchSnapshot> {
    if (cached && cached.expires > Date.now()) return cached.snapshot;
    if (loading) return loading;
    loading = this.load();
    try {
      return await loading;
    } finally {
      loading = undefined;
    }
  }
  private async load(): Promise<ResearchSnapshot> {
    const { data, error } = await adminClient()
      .from("research_snapshots")
      .select("payload")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data)
      throw new AppError(
        "DATASET_UNAVAILABLE",
        "The HDB and amenity dataset has not been imported yet. Please retry after the data refresh.",
        503,
        true,
      );
    const result = snapshotSchema.safeParse(data.payload);
    if (!result.success)
      throw new AppError(
        "DATASET_INVALID",
        "The imported research dataset could not be validated.",
        503,
        true,
      );
    cached = { snapshot: result.data, expires: Date.now() + 60000 };
    return result.data;
  }
}
