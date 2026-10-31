import "server-only";
import catalogue from "../../../data/bto-2026-06.json";
import {
  btoCatalogueSchema,
  privateSnapshotSchema,
  type PrivateSnapshot,
} from "@/domain/marketEvidence.mjs";
import { adminClient } from "../supabase";
import { AppError } from "../http";
import { decodePrivateSnapshot } from "../providers/privateSnapshotStorage.mjs";

export class MarketPriceAdapter {
  bto() {
    return btoCatalogueSchema.parse(catalogue);
  }
  async private(): Promise<PrivateSnapshot> {
    if (process.env.NODE_ENV === "development") {
      const { readFile } = await import("node:fs/promises");
      try {
        return privateSnapshotSchema.parse(
          JSON.parse(await readFile(".cache/market/private.json", "utf8")),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          throw new AppError(
            "PRIVATE_DATA_INVALID",
            "The local URA snapshot could not be validated. Re-import it before ranking.",
            503,
          );
      }
    }
    const { data, error } = await adminClient()
      .from("market_price_snapshots")
      .select("payload")
      .eq("kind", "private")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data)
      throw new AppError(
        "PRIVATE_DATA_UNAVAILABLE",
        "Verified URA prices are not connected yet. Area exploration is still available.",
        503,
      );
    try {
      return decodePrivateSnapshot(data.payload);
    } catch {
      throw new AppError(
        "PRIVATE_DATA_INVALID",
        "The URA snapshot could not be validated. Please retry after a data refresh.",
        503,
      );
    }
  }
}
