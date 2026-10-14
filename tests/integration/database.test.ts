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
  await db.exec(
    await readFile(
      "supabase/migrations/202610120001_recommendations.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile("supabase/migrations/202610130001_shortlist.sql", "utf8"),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610130002_password_recovery.sql",
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id) values($1),($2)", [A, B]);
  await db.exec(
    await readFile(
      "supabase/migrations/20261013071758_expand_amenities.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261014111958_clear_recent_searches.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261014114935_market_price_snapshots.sql",
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec(
    "reset role; delete from public.discovery_history_settings; delete from public.discoveries; delete from public.preference_profiles; delete from private.app_sessions;",
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
  it("reserves immutable market snapshot imports for the backend", async () => {
    await expect(
      db.query("select * from public.market_price_snapshots"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        'insert into public.market_price_snapshots(id,kind,payload) values(\'fixture\',\'private\',\'{"id":"fixture","kind":"private"}\')',
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role; set role service_role");
    await db.query(
      'insert into public.market_price_snapshots(id,kind,payload) values(\'fixture\',\'private\',\'{"id":"fixture","kind":"private"}\')',
    );
    expect(
      (await db.query("select * from public.market_price_snapshots")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update public.market_price_snapshots set payload='{}'"),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      "reset role; delete from public.market_price_snapshots; set role anon",
    );
    await expect(
      db.query("select * from public.market_price_snapshots"),
    ).rejects.toThrow(/permission denied/);
  });
  it("accepts new sports while retaining the six-preference limit and category validation", async () => {
    const sports = [
      "Gym",
      "Basketball",
      "Football",
      "Swimming",
      "Tennis",
      "Running tracks",
    ];
    const payload = {
      ...p(),
      lifestyles: sports.map((category) => ({
        category,
        radius: 1000,
        priority: 3,
      })),
    };
    const profile = await insert(payload);
    expect(profile.id).toBeTruthy();
    await expect(
      insert({
        ...payload,
        lifestyles: [
          ...payload.lifestyles,
          { category: "Fitness corners", radius: 1000, priority: 3 },
        ],
      }),
    ).rejects.toThrow("INVALID_COUNTS");
    await expect(
      insert({
        ...payload,
        lifestyles: [{ category: "Unknown sport", radius: 1000, priority: 3 }],
      }),
    ).rejects.toThrow("INVALID_LIFESTYLE");
  });
  it("allows only the backend to revoke all recovered-owner sessions without affecting another owner", async () => {
    const profile = await insert();
    await expect(
      db.query("select public.revoke_user_sessions($1)", [B]),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.query(
      "insert into private.app_sessions(session_id,user_id) values($1,$2)",
      ["cccccccc-cccc-4ccc-8ccc-cccccccccccc", A],
    );
    await db.exec("set role service_role");
    await db.query("select public.revoke_user_sessions($1)", [A]);
    await as(A, SA);
    expect(
      (
        await db.query("select * from public.preference_profiles where id=$1", [
          profile.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ active: boolean }>(
          "select public.has_active_session() as active",
        )
      ).rows[0].active,
    ).toBe(false);
    await as(B, SB);
    expect(
      (
        await db.query<{ active: boolean }>(
          "select public.has_active_session() as active",
        )
      ).rows[0].active,
    ).toBe(true);
    await db.exec("reset role");
    expect(
      (
        await db.query("select * from public.preference_profiles where id=$1", [
          profile.id,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from private.app_sessions where user_id=$1 and not revoked",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
  });
  async function discovery(owner = A) {
    await db.exec("reset role");
    const row = (
      await db.query<{ id: string }>(
        "insert into public.discoveries(user_id,payload) values($1,$2) returning id",
        [owner, JSON.stringify({ results: [{ area: { id: "bedok" } }] })],
      )
    ).rows[0];
    await as(A, SA);
    return row.id;
  }
  async function bookmark(discoveryId: string, area = "bedok", owner = A) {
    return (
      await db.query<{ id: string }>(
        "insert into public.saved_areas(user_id,discovery_id,area_id) values($1,$2,$3) returning id",
        [owner, discoveryId, area],
      )
    ).rows[0];
  }
  it("clears only the owner's history and retains profiles, immutable evidence and bookmarks", async () => {
    const profile = await insert();
    const own = await discovery();
    const other = await discovery(B);
    await bookmark(own);
    expect(
      (await db.query("select * from public.recent_discoveries()")).rows,
    ).toHaveLength(1);
    await db.query("select public.clear_discovery_history()");
    await db.query("select public.clear_discovery_history()");
    expect(
      (await db.query("select * from public.recent_discoveries()")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.discoveries where id=$1", [own]))
        .rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query("select * from public.preference_profiles where id=$1", [
          profile.id,
        ])
      ).rows,
    ).toHaveLength(1);
    const next = await discovery();
    expect(
      (await db.query("select * from public.recent_discoveries()")).rows,
    ).toMatchObject([{ id: next }]);
    await as(B, SB);
    expect(
      (await db.query("select * from public.recent_discoveries()")).rows,
    ).toMatchObject([{ id: other }]);
    expect(
      (await db.query("select * from public.discovery_history_settings")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.discovery_history_settings(user_id) values($1)",
        [A],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (
        await db.query(
          "update public.discovery_history_settings set cleared_before=clock_timestamp() where user_id=$1 returning *",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("denies anonymous and expired-session history mutations", async () => {
    await discovery();
    await db.exec("reset role; set role anon");
    await expect(
      db.query("select public.clear_discovery_history()"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select * from public.recent_discoveries()"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role; update private.app_sessions set revoked=true");
    await as(A, SA);
    await expect(
      db.query("select public.clear_discovery_history()"),
    ).rejects.toThrow(/SIGN_IN_REQUIRED/);
    expect(
      (await db.query("select * from public.recent_discoveries()")).rows,
    ).toHaveLength(0);
  });
  it("saves, reads and removes only an owned published area", async () => {
    const id = await discovery();
    const saved = await bookmark(id);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(1);
    await as(B, SB);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from public.saved_areas where id=$1 returning id",
          [saved.id],
        )
      ).rows,
    ).toHaveLength(0);
    await as(A, SA);
    await db.query("delete from public.saved_areas where id=$1", [saved.id]);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(0);
  });
  it("rejects another owner's source search, forged towns and ownership", async () => {
    const other = await discovery(B);
    await expect(bookmark(other)).rejects.toThrow(/row-level security/);
    const own = await discovery();
    await expect(bookmark(own, "invented-town")).rejects.toThrow(
      /row-level security/,
    );
    await expect(bookmark(own, "bedok", B)).rejects.toThrow(
      /row-level security/,
    );
  });
  it("retains first search evidence on duplicate saves and forbids updates", async () => {
    const first = await discovery();
    await bookmark(first);
    const second = await discovery();
    await db.query(
      "insert into public.saved_areas(user_id,discovery_id,area_id) values($1,$2,'bedok') on conflict(user_id,area_id) do nothing",
      [A, second],
    );
    expect(
      (
        await db.query<{ discovery_id: string }>(
          "select discovery_id from public.saved_areas",
        )
      ).rows,
    ).toEqual([{ discovery_id: first }]);
    await expect(
      db.exec("update public.saved_areas set area_id='forged'"),
    ).rejects.toThrow(/permission denied/);
  });
  it("denies all shortlist access on expired/revoked sessions and anonymous access", async () => {
    const id = await discovery();
    await bookmark(id);
    await db.exec("reset role");
    await db.query(
      "update private.app_sessions set last_activity=now()-interval '31 minutes' where session_id=$1",
      [SA],
    );
    await as(A, SA);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("delete from public.saved_areas returning id")).rows,
    ).toHaveLength(0);
    await expect(bookmark(id)).rejects.toThrow(/row-level security/);
    await db.exec("reset role; set role anon");
    await expect(db.exec("select * from public.saved_areas")).rejects.toThrow(
      /permission denied/,
    );
    await expect(bookmark(id)).rejects.toThrow(/permission denied/);
  });
  it("keeps bookmarks when a source profile is deleted and cascades with the source search", async () => {
    const profile = await insert();
    const id = await discovery();
    await db.exec("reset role");
    await db.query("update public.discoveries set profile_id=$1 where id=$2", [
      profile.id,
      id,
    ]);
    await as(A, SA);
    await bookmark(id);
    await db.query("delete from public.preference_profiles where id=$1", [
      profile.id,
    ]);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(1);
    await db.exec("reset role");
    await db.query("delete from public.discoveries where id=$1", [id]);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(0);
  });
  it("preserves an account shortlist across a new login session", async () => {
    await bookmark(await discovery());
    const nextSession = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await db.exec("reset role");
    await db.query(
      "update private.app_sessions set revoked=true where session_id=$1",
      [SA],
    );
    await db.query(
      "insert into private.app_sessions(session_id,user_id) values($1,$2)",
      [nextSession, A],
    );
    await as(A, nextSession);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(1);
    await as(A, SA);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(0);
  });
  it("removes an account's bookmarks when Auth removes that account", async () => {
    await bookmark(await discovery());
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [A]);
    expect(
      (await db.query("select * from public.saved_areas")).rows,
    ).toHaveLength(0);
    await db.query("insert into auth.users(id) values($1)", [A]);
  });
  it("hard deletion cascades all owner data while preserving other accounts and shared datasets", async () => {
    await insert();
    await bookmark(await discovery());
    const otherDiscovery = await discovery(B);
    await as(B, SB);
    await insert(p(), B);
    await bookmark(otherDiscovery, "bedok", B);
    await db.exec("reset role");
    await db.query(
      "insert into public.research_snapshots(id,payload) values($1,$2)",
      [
        "account-deletion-fixture",
        JSON.stringify({ source: "public-fixture" }),
      ],
    );
    const sharedBefore = (
      await db.query("select * from public.research_snapshots")
    ).rows;
    await db.exec("set role service_role");
    await db.query("select public.revoke_user_sessions($1)", [A]);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [A]);
    try {
      for (const table of [
        "public.preference_profiles",
        "public.discoveries",
        "public.saved_areas",
        "private.app_sessions",
      ]) {
        expect(
          (await db.query(`select * from ${table} where user_id=$1`, [A])).rows,
        ).toHaveLength(0);
        expect(
          (await db.query(`select * from ${table} where user_id=$1`, [B])).rows,
        ).toHaveLength(1);
      }
      expect(
        (await db.query("select * from public.research_snapshots")).rows,
      ).toEqual(sharedBefore);
      await as(A, SA);
      expect(
        (
          await db.query<{ active: boolean }>(
            "select public.has_active_session() as active",
          )
        ).rows[0].active,
      ).toBe(false);
      await as(B, SB);
      expect(
        (
          await db.query<{ active: boolean }>(
            "select public.has_active_session() as active",
          )
        ).rows[0].active,
      ).toBe(true);
    } finally {
      await db.exec("reset role");
      await db.query("insert into auth.users(id) values($1)", [A]);
      await db.query("delete from public.research_snapshots where id=$1", [
        "account-deletion-fixture",
      ]);
    }
  });
  it("allows only active owners to read backend-published discoveries", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into public.discoveries(user_id,payload) values($1,$2)",
      [A, JSON.stringify({ results: [] })],
    );
    await as(A, SA);
    expect(
      (await db.query("select * from public.discoveries")).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "insert into public.discoveries(user_id,payload) values($1,'{}')",
        [A],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec("update public.discoveries set payload='{}'"),
    ).rejects.toThrow(/permission denied/);
    await as(B, SB);
    expect(
      (await db.query("select * from public.discoveries")).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
    await db.query(
      "update private.app_sessions set revoked=true where session_id=$1",
      [SA],
    );
    await as(A, SA);
    expect(
      (await db.query("select * from public.discoveries")).rows,
    ).toHaveLength(0);
    await db.exec("reset role; set role anon");
    await expect(db.exec("select * from public.discoveries")).rejects.toThrow(
      /permission denied/,
    );
  });
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
