import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

let db: PGlite;
const subject = "a".repeat(64);
type Admission = { allowed: boolean; leaseId?: string; retryAfter?: number };
async function acquire(operation = "ai", owner = subject) {
  const result = await db.query<{ result: Admission }>(
    "select public.acquire_operation($1,$2) as result",
    [operation, owner],
  );
  return result.rows[0].result;
}
async function release(
  admission: Admission,
  operation = "ai",
  owner = subject,
) {
  await db.query("select public.release_operation($1,$2,$3)", [
    operation,
    owner,
    admission.leaseId,
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema private; grant usage on schema public to anon, authenticated, service_role;",
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261013174853_operation_limits.sql",
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec(
    "reset role; truncate private.operation_usage, private.operation_leases; set role service_role;",
  );
});
afterAll(async () => {
  await db?.close();
});

it("shares account concurrency across separate admissions and releases only the matching lease", async () => {
  const first = await acquire("journeys");
  expect(first.allowed).toBe(true);
  expect(await acquire("journeys")).toMatchObject({ allowed: false });
  await release(first, "journeys", "b".repeat(64));
  expect(await acquire("journeys")).toMatchObject({ allowed: false });
  await release(first, "journeys");
  expect((await acquire("journeys")).allowed).toBe(true);
});
it("retains a cooldown after successful completion", async () => {
  const first = await acquire();
  await release(first);
  expect(await acquire()).toMatchObject({ allowed: false, retryAfter: 10 });
});
it("enforces the ten-attempt AI window without refunding failed attempts", async () => {
  for (let i = 0; i < 10; i++) {
    const entry = await acquire();
    expect(entry.allowed).toBe(true);
    await release(entry);
    await db.exec(
      "update private.operation_usage set last_at=clock_timestamp()-interval '11 seconds' where operation='ai'",
    );
  }
  expect(await acquire()).toMatchObject({ allowed: false });
  await db.exec(
    "update private.operation_usage set started_at=clock_timestamp()-interval '1 hour' where operation='ai'",
  );
  expect((await acquire()).allowed).toBe(true);
});
it("enforces a global quota even when individual accounts are below their limits", async () => {
  await acquire("locations");
  await db.exec(
    "update private.operation_usage set attempts=600 where operation='locations' and subject='global'",
  );
  expect(await acquire("locations", "b".repeat(64))).toMatchObject({
    allowed: false,
  });
});
it("bounds service concurrency under fifty queued different-user admissions", async () => {
  const results = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      acquire("ai", i.toString(16).padStart(64, "0")),
    ),
  );
  expect(results.filter((r) => r.allowed)).toHaveLength(6);
  expect(results.filter((r) => !r.allowed)).toHaveLength(44);
});
it("permits up to five overlapping location lookups per account", async () => {
  for (let i = 0; i < 5; i++)
    expect((await acquire("locations")).allowed).toBe(true);
  expect((await acquire("locations")).allowed).toBe(false);
});
it("expires crashed slots and fences an old completion from a replacement slot", async () => {
  const first = await acquire("journeys");
  await db.exec(
    "update private.operation_leases set expires_at=clock_timestamp()-interval '1 second'",
  );
  const next = await acquire("journeys");
  expect(next.allowed).toBe(true);
  await release(first, "journeys");
  expect((await acquire("journeys")).allowed).toBe(false);
  await release(next, "journeys");
  expect((await acquire("journeys")).allowed).toBe(true);
});
it("does not count rejected admissions or mix operation counters", async () => {
  await acquire();
  await acquire();
  expect((await acquire("locations")).allowed).toBe(true);
  const rows = await db.query<{ attempts: number }>(
    "select attempts from private.operation_usage where operation='ai'",
  );
  expect(rows.rows.map((r) => r.attempts)).toEqual([1, 1]);
});
it("prunes counters unused for seven days on that operation's next admission", async () => {
  await acquire("locations");
  await db.exec(
    "update private.operation_usage set started_at=clock_timestamp()-interval '8 days'",
  );
  await acquire("locations", "b".repeat(64));
  expect(
    (
      await db.query("select * from private.operation_usage where subject=$1", [
        subject,
      ])
    ).rows,
  ).toHaveLength(0);
});
it.each(["anon", "authenticated"])(
  "denies %s all table access and RPC execution",
  async (role) => {
    await db.exec(`reset role; set role ${role}`);
    await expect(acquire()).rejects.toThrow(/permission denied/);
    await expect(
      release({ leaseId: crypto.randomUUID(), allowed: true }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec("select * from private.operation_usage"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec("select * from private.operation_leases"),
    ).rejects.toThrow(/permission denied/);
  },
);
it("rejects unknown operations and non-pseudonymous subjects", async () => {
  await expect(acquire("custom")).rejects.toThrow("INVALID_LIMIT_OPERATION");
  await expect(acquire("ai", "user@example.com")).rejects.toThrow(
    "INVALID_LIMIT_SUBJECT",
  );
  await expect(acquire("ai", "global")).rejects.toThrow(
    "INVALID_LIMIT_SUBJECT",
  );
});
