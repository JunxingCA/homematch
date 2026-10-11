import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { samplePreference } from "@/domain/fixtures";

let db: PGlite;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const p = () => structuredClone(samplePreference);
async function as(user: string, session: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: user, session_id: session }),
  ]);
  await db.exec("set role authenticated");
}
async function insert(payload: unknown = p(), owner = A) {
  return (
    await db.query<{ id: string; revision: number; confirmed: boolean }>(
      "insert into public.preference_profiles(user_id,payload) values($1,$2::jsonb) returning id,revision,confirmed",
      [owner, JSON.stringify(payload)],
    )
  ).rows[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema public,auth to authenticated,anon,service_role;
    grant execute on function auth.jwt(),auth.uid() to authenticated,anon,service_role;`);
  await db.exec(
    await readFile("supabase/migrations/202610110001_foundation.sql", "utf8"),
  );
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [A, B]);
});
beforeEach(async () => {
  await db.exec(
    "reset role; delete from public.preference_profiles; delete from private.app_sessions;",
  );
  await db.query(
    "insert into private.app_sessions(session_id,user_id) values($1,$2),($3,$4)",
    [SA, A, SB, B],
  );
  await as(A, SA);
});
afterAll(async () => {
  await db?.close();
});

describe("real PostgreSQL migration and RLS (PGlite)", () => {
  it("creates, reads, updates, confirms and deletes an owned profile", async () => {
    const row = await insert();
    expect(row.revision).toBe(1);
    expect(row.confirmed).toBe(false);
    const confirmed = await db.query<{ revision: number; confirmed: boolean }>(
      "update public.preference_profiles set confirmed=true where id=$1 returning revision,confirmed",
      [row.id],
    );
    expect(confirmed.rows[0]).toEqual({ revision: 2, confirmed: true });
    const changed = p();
    changed.name = "Changed";
    const result = await db.query<{ revision: number; confirmed: boolean }>(
      "update public.preference_profiles set payload=$2 where id=$1 returning revision,confirmed",
      [row.id, JSON.stringify(changed)],
    );
    expect(result.rows[0]).toEqual({ revision: 3, confirmed: false });
    await db.query("delete from public.preference_profiles where id=$1", [
      row.id,
    ]);
    expect(
      (await db.query("select * from public.preference_profiles")).rows,
    ).toHaveLength(0);
  });
  it("does not permit clients to create a pre-confirmed profile", async () => {
    const result = await db.query<{ confirmed: boolean }>(
      "insert into public.preference_profiles(user_id,payload,confirmed,revision) values($1,$2,true,99) returning confirmed,revision",
      [A, JSON.stringify(p())],
    );
    expect(result.rows[0]).toEqual({ confirmed: false, revision: 1 });
  });
  it("enforces four profiles even without the application", async () => {
    for (let i = 0; i < 4; i++) await insert();
    await expect(insert()).rejects.toThrow("PROFILE_LIMIT");
    expect(
      (await db.query("select * from public.preference_profiles")).rows,
    ).toHaveLength(4);
  });
  it("hides another user's profile including embedded destinations", async () => {
    const row = await insert();
    await as(B, SB);
    expect(
      (
        await db.query("select * from public.preference_profiles where id=$1", [
          row.id,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "update public.preference_profiles set confirmed=true where id=$1 returning id",
          [row.id],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "delete from public.preference_profiles where id=$1 returning id",
          [row.id],
        )
      ).rows,
    ).toEqual([]);
    await expect(insert(p(), A)).rejects.toThrow(/row-level security/);
  });
  it("cannot transfer ownership", async () => {
    const row = await insert();
    await expect(
      db.query("update public.preference_profiles set user_id=$2 where id=$1", [
        row.id,
        B,
      ]),
    ).rejects.toThrow("IMMUTABLE_OWNER");
  });
  it("rejects stale revision writes", async () => {
    const row = await insert();
    await db.query(
      "update public.preference_profiles set confirmed=true where id=$1",
      [row.id],
    );
    expect(
      (
        await db.query(
          "update public.preference_profiles set confirmed=false where id=$1 and revision=1 returning id",
          [row.id],
        )
      ).rows,
    ).toEqual([]);
  });
  it("denies reads and writes after inactivity, and cannot revive the session", async () => {
    await insert();
    await db.exec("reset role");
    await db.query(
      "update private.app_sessions set last_activity=now()-interval '30 minutes' where session_id=$1",
      [SA],
    );
    await as(A, SA);
    expect(
      (
        await db.query<{ active: boolean }>(
          "select public.has_active_session() as active",
        )
      ).rows[0].active,
    ).toBe(false);
    expect(
      (
        await db.query<{ active: boolean }>(
          "select public.touch_session() as active",
        )
      ).rows[0].active,
    ).toBe(false);
    expect(
      (await db.query("select * from public.preference_profiles")).rows,
    ).toEqual([]);
    await expect(insert()).rejects.toThrow("SESSION_EXPIRED");
  });
  it("refreshes only an active session and respects revocation", async () => {
    expect(
      (
        await db.query<{ active: boolean }>(
          "select public.touch_session() as active",
        )
      ).rows[0].active,
    ).toBe(true);
    await db.exec("select public.revoke_session()");
    expect(
      (
        await db.query<{ active: boolean }>(
          "select public.has_active_session() as active",
        )
      ).rows[0].active,
    ).toBe(false);
  });
  it("cannot register or forge another session", async () => {
    await expect(
      db.query("select public.register_session($1,$2)", [SA, A]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("select * from private.app_sessions")).rejects.toThrow(
      /permission denied/,
    );
    await as(A, SB);
    await expect(insert()).rejects.toThrow("SESSION_EXPIRED");
  });
  it("denies anonymous table access", async () => {
    await db.exec("reset role; set role anon");
    await expect(
      db.exec("select * from public.preference_profiles"),
    ).rejects.toThrow(/permission denied/);
  });
  it("does not trust fabricated coordinates or labels", async () => {
    const value = p();
    value.destinations[0].location!.latitude = 1.4;
    await expect(insert(value)).rejects.toThrow("UNVERIFIED_LOCATION");
    await expect(
      db.exec(
        "insert into public.location_catalog values('bad','fake',1.3,103.8,'onemap',now())",
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("can save unresolved drafts but cannot confirm them", async () => {
    const value = p();
    value.destinations[0].location = null;
    const row = await insert(value);
    await expect(
      db.query(
        "update public.preference_profiles set confirmed=true where id=$1",
        [row.id],
      ),
    ).rejects.toThrow("UNRESOLVED_LOCATION");
  });
  it.each([
    [
      "weights",
      () => ({
        ...p(),
        weights: { destination: 1, lifestyle: 1, affordability: 1 },
      }),
    ],
    ["budget", () => ({ ...p(), budgetMin: 900000 })],
    ["destinations", () => ({ ...p(), destinations: [] })],
    ["unrecognized keys", () => ({ ...p(), isAdmin: true })],
    ["null category", () => ({ ...p(), category: null })],
    [
      "null mode",
      () => ({
        ...p(),
        destinations: [{ ...p().destinations[0], mode: null }],
      }),
    ],
  ] as const)("rejects invalid %s via direct SQL", async (_name, value) => {
    await expect(insert(value())).rejects.toThrow();
  });
  it("cascades owned data when Auth removes an account", async () => {
    await insert();
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [A]);
    expect(
      (await db.query("select * from public.preference_profiles")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from private.app_sessions where user_id=$1", [
          A,
        ])
      ).rows,
    ).toHaveLength(0);
    await db.query("insert into auth.users(id) values($1)", [A]);
  });
});
