import { expect, it, vi } from "vitest";
import { collectPrivate } from "../../scripts/import-private.mjs";
const row = {
  project: "Fixture",
  street: "Public fixture",
  x: "28001.642",
  y: "38744.572",
  transaction: [
    {
      contractDate: "0926",
      district: "04",
      propertyType: "Condominium",
      price: "1000000",
      area: "100",
      typeOfArea: "Strata",
      typeOfSale: "3",
      noOfUnits: "1",
    },
  ],
};
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
it("requires the separate URA key before network access", async () => {
  const fetcher = vi.fn();
  await expect(collectPrivate({ fetcher })).rejects.toThrow("URA_ACCESS_KEY");
  expect(fetcher).not.toHaveBeenCalled();
});
it("fetches a daily token then all four fixed official batches without exposing keys in URLs", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ Status: "Success", Result: "test-token" }))
    .mockResolvedValueOnce(json({ Status: "Success", Result: [row] }));
  for (let i = 0; i < 3; i++)
    fetcher.mockResolvedValueOnce(json({ Status: "Success", Result: [] }));
  const snapshot = await collectPrivate({
    accessKey: "test-key",
    fetcher,
    now: () => new Date("2026-10-14T00:00:00Z"),
  });
  expect(fetcher).toHaveBeenCalledTimes(5);
  expect(snapshot.batches).toEqual([1, 2, 3, 4]);
  expect(snapshot.projects).toHaveLength(1);
  for (const [url, init] of fetcher.mock.calls) {
    expect(new URL(url).hostname).toBe("eservice.ura.gov.sg");
    expect(url).not.toContain("test-key");
    expect(url).not.toContain("test-token");
    expect(init.redirect).toBe("error");
  }
  expect(fetcher.mock.calls[4][0]).toContain("batch=4");
});
it("publishes no partial return for a failed or oversized provider response", async () => {
  await expect(
    collectPrivate({
      accessKey: "test",
      fetcher: vi.fn().mockResolvedValue(json({ Status: "Failure" })),
    }),
  ).rejects.toThrow("authentication");
  await expect(
    collectPrivate({
      accessKey: "test",
      fetcher: vi
        .fn()
        .mockResolvedValue(
          new Response("", {
            headers: { "Content-Length": String(33 * 1024 * 1024) },
          }),
        ),
    }),
  ).rejects.toThrow("too large");
});
