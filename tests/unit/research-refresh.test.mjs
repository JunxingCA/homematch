import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  snapshotSchema,
  lifestyleCategories,
} from "../../src/domain/researchSnapshot.mjs";
import {
  TOWNS,
  validateResearch,
  refreshResearch,
} from "../../scripts/lib/researchRefresh.mjs";
import { refreshState } from "../../scripts/lib/refreshState.mjs";
import { runOnce, main } from "../../scripts/refresh-research.mjs";

const now = new Date("2026-10-14T00:00:00Z");
function sample() {
  return {
    id: "original",
    fetchedAt: now.toISOString(),
    sourceUrl: "https://data.gov.sg/",
    sourceHash: "hash",
    sourceUpdatedAt: "2026-10-13T00:00:00Z",
    latestMonth: "2026-09",
    importedRows: 104000,
    areas: TOWNS.map((name, i) => ({
      id: String(i),
      name,
      originLabel: "Representative MRT",
      latitude: 1.3,
      longitude: 103.8,
    })),
    supportedFacilities: [...lifestyleCategories],
    facilitySources: lifestyleCategories.map((category) => ({
      category,
      theme: "test",
      updatedAt: "2026-10-13T00:00:00Z",
    })),
    facilities: lifestyleCategories.flatMap((category) =>
      Array.from({ length: 10 }, (_, i) => ({
        category,
        name: `Public venue ${i}`,
        latitude: 1.3,
        longitude: 103.8,
      })),
    ),
    prices: TOWNS.map((town) => ({
      town,
      month: "2026-09",
      flatType: "4-room",
      values: Array(4000).fill(500000),
    })),
  };
}
function fixtures() {
  const previous = { ...sample(), fetchedAt: "2026-10-12T00:00:00Z" };
  const repository = {
    latest: vi.fn(async () => previous),
    publish: vi.fn(async () => {}),
  };
  const collect = vi.fn(async () => ({ payload: sample() }));
  return { previous, repository, collect, now: () => now };
}
describe("complete validated research refresh", () => {
  it("shares the exact runtime schema with the app and gives each verification an immutable identity", () => {
    const old = sample();
    const snapshot = validateResearch(old, null, now);
    expect(snapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.id).toMatch(/^[a-f0-9]{64}$/);
    const next = validateResearch(
      { ...old, fetchedAt: "2026-10-14T00:00:01Z" },
      old,
      new Date("2026-10-14T00:00:01Z"),
    );
    expect(next.id).not.toBe(snapshot.id);
    expect(old.id).toBe("original");
  });
  it.each([
    ["missing town", (s) => s.areas.pop()],
    [
      "duplicate town",
      (s) => {
        s.areas[0] = s.areas[1];
      },
    ],
    [
      "missing sport",
      (s) => {
        s.facilities = s.facilities.filter((f) => f.category !== "Gym");
      },
    ],
    [
      "invalid coordinates",
      (s) => {
        s.areas[0].latitude = 3;
      },
    ],
    ["incorrect row count", (s) => s.importedRows++],
    [
      "unsupported price type",
      (s) => {
        s.prices[0].flatType = "Condo";
      },
    ],
    [
      "empty price group",
      (s) => {
        s.prices[0].values = [];
        s.importedRows -= 4000;
      },
    ],
    [
      "duplicate price group",
      (s) => {
        s.prices.push(s.prices[0]);
        s.importedRows += 4000;
      },
    ],
    [
      "bad calendar month",
      (s) => {
        s.prices[0].month = "2026-13";
      },
    ],
    [
      "future retrieval",
      (s) => {
        s.fetchedAt = "2026-10-15T00:00:00Z";
      },
    ],
    [
      "stale retrieval",
      (s) => {
        s.fetchedAt = "2026-10-01T00:00:00Z";
      },
    ],
    [
      "stale metadata",
      (s) => {
        s.facilitySources[0].updatedAt = "2025-01-01T00:00:00Z";
      },
    ],
    [
      "duplicate source",
      (s) => {
        s.facilitySources[0] = s.facilitySources[1];
      },
    ],
    [
      "missing HDB metadata",
      (s) => {
        delete s.sourceUpdatedAt;
      },
    ],
    [
      "future HDB metadata",
      (s) => {
        s.sourceUpdatedAt = "2027-01-01T00:00:00Z";
      },
    ],
  ])("rejects %s before publication", (_, change) => {
    const snapshot = sample();
    change(snapshot);
    expect(() => validateResearch(snapshot, null, now)).toThrow();
  });
  it("does not relabel a stale or future transaction month as current", () => {
    for (const month of ["2026-06", "2026-11"]) {
      const snapshot = sample();
      snapshot.latestMonth = month;
      snapshot.prices.forEach((group) => {
        group.month = month;
      });
      expect(() => validateResearch(snapshot, null, now)).toThrow(
        "STALE_OR_INVALID_PRICES",
      );
    }
  });
  it("requires review after suspicious facility loss or source regression", () => {
    const old = sample();
    const fewer = sample();
    fewer.facilities = fewer.facilities.filter(
      (f) => f.category !== "Gym" || Number(f.name.at(-1)) < 7,
    );
    expect(() => validateResearch(fewer, old, now)).toThrow(
      "FACILITY_REGRESSION",
    );
    const stale = sample();
    stale.facilitySources[0].updatedAt = "2026-10-12T00:00:00Z";
    expect(() => validateResearch(stale, old, now)).toThrow(
      "SOURCE_REGRESSION",
    );
  });
  it("publishes exactly once only after a complete collection and validation", async () => {
    const f = fixtures();
    const result = await refreshResearch(f);
    expect(result.state).toBe("published");
    expect(f.repository.publish).toHaveBeenCalledOnce();
    expect(f.previous.fetchedAt).toBe("2026-10-12T00:00:00Z");
  });
  it("skips a recent successful snapshot without advancing its age", async () => {
    const f = fixtures();
    f.previous.fetchedAt = "2026-10-13T23:00:00Z";
    expect(await refreshResearch(f)).toMatchObject({
      state: "not-due",
      fetchedAt: f.previous.fetchedAt,
    });
    expect(f.collect).not.toHaveBeenCalled();
    expect(f.repository.publish).not.toHaveBeenCalled();
  });
  it("preserves the last snapshot and does not expose raw provider errors", async () => {
    const f = fixtures();
    f.collect.mockRejectedValue(new Error("PRIVATE API KEY"));
    await expect(refreshResearch(f)).rejects.toThrow("COLLECTION_FAILED");
    expect(f.repository.publish).not.toHaveBeenCalled();
    expect(f.previous.id).toBe("original");
  });
  it("does not bypass validation in dry-run or force mode", async () => {
    const f = fixtures();
    const broken = sample();
    broken.areas.pop();
    f.collect.mockResolvedValue({ payload: broken });
    await expect(
      refreshResearch({ ...f, force: true, dryRun: true }),
    ).rejects.toThrow("INCOMPLETE_TOWNS");
    expect(f.repository.publish).not.toHaveBeenCalled();
  });
  it("reports a dry-run candidate separately from the active dataset", async () => {
    const f = fixtures();
    const result = await refreshResearch({ ...f, dryRun: true });
    expect(result).toMatchObject({
      state: "validated-only",
      activeSnapshotId: "original",
      activeFetchedAt: f.previous.fetchedAt,
    });
    expect(result.candidateSnapshotId).not.toBe("original");
    expect(result.fetchedAt).toBeUndefined();
    expect(f.repository.publish).not.toHaveBeenCalled();
  });
  it("does not claim success if publication cannot be confirmed", async () => {
    const f = fixtures();
    f.repository.publish.mockRejectedValue(new Error("PRIVATE DATABASE URL"));
    await expect(refreshResearch(f)).rejects.toThrow("PUBLICATION_UNCONFIRMED");
  });
  it("fails closed on an unavailable baseline rather than publishing blindly", async () => {
    const f = fixtures();
    f.repository.latest.mockRejectedValue(new Error("unavailable"));
    await expect(refreshResearch(f)).rejects.toThrow("BASELINE_UNAVAILABLE");
    expect(f.collect).not.toHaveBeenCalled();
  });
  it("cancels before publication", async () => {
    const f = fixtures();
    const controller = new AbortController();
    f.collect.mockImplementation(async () => {
      controller.abort();
      return { payload: sample() };
    });
    await expect(
      refreshResearch({ ...f, signal: controller.signal }),
    ).rejects.toThrow("CANCELLED");
    expect(f.repository.publish).not.toHaveBeenCalled();
  });
});

describe("single-host refresh lock and truthful status", () => {
  async function isolated(fn) {
    const directory = await mkdtemp(join(tmpdir(), "homematch-refresh-"));
    try {
      await fn(refreshState(directory), directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  it("prevents overlapping jobs and releases only its own lock", async () => {
    await isolated(async (store, directory) => {
      const release = await store.acquire();
      expect(await store.acquire()).toBeNull();
      const f = fixtures();
      expect(
        await runOnce({
          store,
          repo: f.repository,
          collect: f.collect,
          force: true,
        }),
      ).toEqual({ state: "locked" });
      expect(f.collect).not.toHaveBeenCalled();
      expect((await stat(join(directory, "lock.json"))).mode & 0o777).toBe(
        0o600,
      );
      await release();
      const next = await store.acquire();
      expect(next).not.toBeNull();
      await next();
    });
  });
  it("retains the last success on failures and releases the lock for retry", async () => {
    await isolated(async (store, directory) => {
      await store.write({
        lastSuccessAt: "2026-10-12T00:00:00Z",
        snapshotId: "old",
      });
      const f = fixtures();
      f.collect.mockRejectedValue(new Error("SECRET"));
      await expect(
        runOnce({ store, repo: f.repository, collect: f.collect, force: true }),
      ).rejects.toThrow("COLLECTION_FAILED");
      expect(await store.read()).toMatchObject({
        state: "failed",
        snapshotId: "old",
        lastSuccessAt: "2026-10-12T00:00:00Z",
        lastError: "COLLECTION_FAILED",
      });
      expect(
        await readFile(join(directory, "status.json"), "utf8"),
      ).not.toContain("SECRET");
      const release = await store.acquire();
      expect(release).not.toBeNull();
      await release();
    });
  });
  it("rejects unknown command flags without running a job", async () => {
    await expect(main(["--wrong"])).rejects.toThrow("Use --once");
    await expect(main(["--watch", "--force"])).rejects.toThrow("Use --once");
    await expect(main(["--status", "--force"])).rejects.toThrow("Use --once");
    await expect(main(["--watch", "--once"])).rejects.toThrow("Use --once");
    await expect(main(["--force", "--force"])).rejects.toThrow("Use --once");
  });
});
