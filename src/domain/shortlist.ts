import { z } from "zod";
import type { AreaResult, Discovery } from "./recommendations";

export const saveAreaSchema = z
  .object({ discoveryId: z.uuid(), areaId: z.string().min(1).max(120) })
  .strict();
export type SavedArea = {
  id: string;
  savedAt: string;
  discoveryId: string;
  result: AreaResult;
  context: Pick<
    Discovery,
    | "createdAt"
    | "preference"
    | "formulaVersion"
    | "fromMonth"
    | "toMonthExclusive"
    | "fetchedAt"
    | "snapshotId"
    | "facilitySources"
  >;
};
export function savedArea(
  row: {
    id: string;
    created_at: string;
    discovery_id: string;
    area_id: string;
  },
  discovery: Discovery,
): SavedArea {
  const result = discovery.results.find((r) => r.area.id === row.area_id);
  if (!result) throw Error("Saved area is absent from its source discovery");
  const {
    createdAt,
    preference,
    formulaVersion,
    fromMonth,
    toMonthExclusive,
    fetchedAt,
    snapshotId,
    facilitySources,
  } = discovery;
  return {
    id: row.id,
    savedAt: row.created_at,
    discoveryId: row.discovery_id,
    result,
    context: {
      createdAt,
      preference,
      formulaVersion,
      fromMonth,
      toMonthExclusive,
      fetchedAt,
      snapshotId,
      facilitySources,
    },
  };
}
