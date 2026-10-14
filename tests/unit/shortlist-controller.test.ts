import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase", () => ({ requireSession: mocks.requireSession }));
import { ShortlistController } from "@/server/controllers/ShortlistController";
const owner = "11111111-1111-4111-8111-111111111111";
const discoveryId = "22222222-2222-4222-8222-222222222222";
const row = {
  id: "33333333-3333-4333-8333-333333333333",
  created_at: "2026-10-13T00:00:00Z",
  discovery_id: discoveryId,
  area_id: "bedok",
};
const source = {
  results: [{ area: { id: "bedok" }, overall: 42 }],
  preference: { name: "First search" },
};
function query(data: unknown, error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    upsert: vi.fn(),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.delete.mockReturnValue(q);
  q.order.mockResolvedValue({ data, error });
  q.maybeSingle.mockResolvedValue({ data, error });
  q.single.mockResolvedValue({ data, error });
  q.upsert.mockResolvedValue({ error });
  return q;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireSession.mockResolvedValue({
    client: { from: mocks.from },
    user: { id: owner },
  });
});
it("does not read or write bookmarks without an active session", async () => {
  mocks.requireSession.mockRejectedValue(Error("Session expired"));
  await expect(new ShortlistController().list()).rejects.toThrow(
    "Session expired",
  );
  expect(mocks.from).not.toHaveBeenCalled();
});
it("does not accept user-provided scores or ownership", async () => {
  await expect(
    new ShortlistController().add({
      discoveryId,
      areaId: "bedok",
      userId: owner,
    }),
  ).rejects.toThrow();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("rejects a missing/unowned source search or a town absent from it", async () => {
  mocks.from.mockReturnValue(query(null));
  await expect(
    new ShortlistController().add({ discoveryId, areaId: "bedok" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  mocks.from.mockReturnValue(query({ payload: source }));
  await expect(
    new ShortlistController().add({ discoveryId, areaId: "forged" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("uses owner filters and idempotent saves, returning persisted original evidence", async () => {
  const read = query({ payload: source }),
    write = query(null),
    loaded = query({ ...row, discoveries: { payload: source } });
  mocks.from
    .mockReturnValueOnce(read)
    .mockReturnValueOnce(write)
    .mockReturnValueOnce(loaded);
  const result = await new ShortlistController().add({
    discoveryId,
    areaId: "bedok",
  });
  expect(read.eq).toHaveBeenCalledWith("user_id", owner);
  expect(write.upsert).toHaveBeenCalledWith(
    { user_id: owner, discovery_id: discoveryId, area_id: "bedok" },
    { onConflict: "user_id,area_id", ignoreDuplicates: true },
  );
  expect(result.result.overall).toBe(42);
  expect(loaded.eq).toHaveBeenCalledWith("user_id", owner);
});
it("sanitises provider errors and never returns optimistic success after failed writes", async () => {
  mocks.from
    .mockReturnValueOnce(query({ payload: source }))
    .mockReturnValueOnce(
      query(null, { message: "Private provider details", code: "XX" }),
    );
  await expect(
    new ShortlistController().add({ discoveryId, areaId: "bedok" }),
  ).rejects.toMatchObject({ code: "SHORTLIST_UNAVAILABLE", status: 503 });
});
it("projects owned saved evidence without exposing the other areas in that search", async () => {
  const q = query([{ ...row, discoveries: { payload: source } }]);
  mocks.from.mockReturnValue(q);
  const result = await new ShortlistController().list();
  expect(result).toHaveLength(1);
  expect(result[0].result.area.id).toBe("bedok");
  expect(q.eq).toHaveBeenCalledWith("user_id", owner);
});
it("reports a missing or unowned delete as not found", async () => {
  const q = query([]);
  q.select.mockResolvedValue({ data: [], error: null });
  mocks.from.mockReturnValue(q);
  await expect(new ShortlistController().remove(row.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(q.eq).toHaveBeenCalledWith("user_id", owner);
});
