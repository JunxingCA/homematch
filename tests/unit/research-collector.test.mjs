import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectResearch } from "../../scripts/lib/collectResearch.mjs";
import { TOWNS, validateResearch } from "../../scripts/lib/researchRefresh.mjs";
import { sportCategories } from "../../scripts/lib/amenities.mjs";
import {
  boundedText,
  officialDownloadUrl,
} from "../../scripts/lib/providerDownload.mjs";

afterEach(() => vi.unstubAllEnvs());
describe("full official source collector with controlled HTTP", () => {
  it("collects all 26 towns, prices, metadata and 13 categories before validation", async () => {
    vi.stubEnv("ONEMAP_TOKEN", "TEST ONLY");
    const directory = await mkdtemp(join(tmpdir(), "homematch-collector-"));
    const updated = new Date(Date.now() - 86400000).toISOString();
    const sgNow = new Date(Date.now() + 8 * 3600000);
    const month = new Date(
      Date.UTC(sgNow.getUTCFullYear(), sgNow.getUTCMonth() - 1, 1),
    )
      .toISOString()
      .slice(0, 7);
    const hdb =
      "month,town,flat_type,resale_price,floor_area_sqm\n" +
      TOWNS.map((town) =>
        `${month},${town},4 ROOM,500000,90\n`.repeat(4000),
      ).join("");
    const sports =
      "SportsFacility,VenueName,Latitude,Longitude\n" +
      Object.keys(sportCategories)
        .map((type) => `${type},Test venue,1.3,103.8\n`)
        .join("");
    const schools =
      "school_name,postal_code,address\nTEST PRIMARY SCHOOL,123456,TEST ROAD\n";
    const pause = vi.fn(async () => {});
    const fetcher = vi.fn(async (input, options) => {
      const url = new URL(input);
      if (url.hostname.includes("data.gov.sg")) {
        expect(options.redirect).toBe("error");
        const id = url.pathname.split("/").at(-2);
        if (url.pathname.endsWith("/metadata"))
          return Response.json({
            data: {
              lastUpdatedAt: updated,
              coverageStart: "2024-01-01",
              coverageEnd: "2026-12-31",
            },
          });
        if (url.pathname.endsWith("/initiate-download"))
          return Response.json({ data: {} });
        if (url.pathname.endsWith("/poll-download"))
          return Response.json({
            data: {
              status: "DOWNLOAD_SUCCESS",
              url: `https://datasets.s3.ap-southeast-1.amazonaws.com/${id}`,
            },
          });
      }
      if (url.hostname.endsWith(".amazonaws.com"))
        return new Response(
          url.pathname.includes("8b84")
            ? hdb
            : url.pathname.includes("2cfb")
              ? sports
              : schools,
        );
      if (url.pathname.includes("retrieveTheme"))
        return Response.json({
          SrchResults: [
            { DateTime: updated, FeatCount: 1 },
            { Type: "Point", NAME: "TEST FACILITY", LatLng: "1.3,103.8" },
          ],
        });
      if (url.pathname.includes("elastic/search")) {
        expect(options.headers.Authorization).toBe("TEST ONLY");
        const query = url.searchParams.get("searchVal");
        const building =
          query === "123456"
            ? "TEST PRIMARY SCHOOL"
            : query.includes("MRT STATION")
              ? query
              : "FAIRPRICE TEST SUPERMARKET";
        return Response.json({
          found: 1,
          totalNumPages: 1,
          results: [
            {
              BUILDING: building,
              ADDRESS: building,
              POSTAL: "123456",
              LATITUDE: "1.3",
              LONGITUDE: "103.8",
            },
          ],
        });
      }
      throw Error("Unexpected controlled endpoint");
    });
    try {
      const collected = await collectResearch({
        cacheDir: directory,
        fetcher,
        pause,
      });
      const validated = validateResearch(collected.payload, null);
      expect(validated.importedRows).toBe(104000);
      expect(validated.areas).toHaveLength(26);
      expect(validated.supportedFacilities).toHaveLength(13);
      expect(
        validated.facilitySources.find((s) => s.category === "Gym").updatedAt,
      ).toBe(updated);
      expect(pause).toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it.each([
    "http://datasets.s3.amazonaws.com/file",
    "https://attackeramazonaws.com/file",
    "https://evil.example/file",
    "https://user:password@datasets.s3.amazonaws.com/file",
    "https://datasets.s3.amazonaws.com:444/file",
    "https://ec2-10-0-0-1.compute.amazonaws.com/file",
  ])("rejects unsafe download URL %s", (value) => {
    expect(() => officialDownloadUrl(value)).toThrow();
  });
  it("accepts regional and global S3 dataset links", () => {
    expect(
      officialDownloadUrl(
        "https://datasets.s3.ap-southeast-1.amazonaws.com/file?signature=test",
      ).protocol,
    ).toBe("https:");
    expect(
      officialDownloadUrl("https://datasets.s3.amazonaws.com/file").hostname,
    ).toBe("datasets.s3.amazonaws.com");
  });
  it("bounds streamed downloads even without a content length", async () => {
    await expect(boundedText(new Response("too large"), 3)).rejects.toThrow(
      "too large",
    );
    expect(await boundedText(new Response("okay"), 10)).toBe("okay");
  });
  it("rejects oversized declared content and aborted downloads", async () => {
    await expect(
      boundedText(
        new Response("x", { headers: { "Content-Length": "999" } }),
        10,
      ),
    ).rejects.toThrow("too large");
    const stop = new AbortController();
    stop.abort();
    await expect(
      boundedText(new Response("x"), 10, stop.signal),
    ).rejects.toThrow();
  });
});
