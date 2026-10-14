import { createClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectResearch } from "./lib/collectResearch.mjs";
import { refreshResearch } from "./lib/researchRefresh.mjs";
import { refreshState } from "./lib/refreshState.mjs";

function repository() {
  if (
    process.env.APP_MODE !== "supabase" ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw Error("Refresh requires a configured backend environment.");
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, init) =>
          fetch(url, { ...init, signal: AbortSignal.timeout(60000) }),
      },
    },
  );
  return {
    async latest() {
      const { data, error } = await client
        .from("research_snapshots")
        .select("payload")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw Error("Snapshot unavailable");
      return data?.payload ?? null;
    },
    async publish(snapshot) {
      const { error } = await client
        .from("research_snapshots")
        .insert({ id: snapshot.id, payload: snapshot });
      if (error) {
        // A lost response may still have committed. Verify this exact immutable ID before reporting success.
        const verification = await client
          .from("research_snapshots")
          .select("id")
          .eq("id", snapshot.id)
          .maybeSingle();
        if (verification.error || verification.data?.id !== snapshot.id)
          throw Error("Publication unconfirmed");
      }
    },
  };
}

export async function runOnce({
  dryRun = false,
  force = false,
  intervalHours = 24,
  signal,
  store = refreshState(),
  repo,
  collect = collectResearch,
} = {}) {
  const release = await store.acquire();
  if (!release) return { state: "locked" };
  let previousStatus = {};
  const startedAt = new Date().toISOString();
  try {
    previousStatus = await store.read();
    await store.write({ ...previousStatus, state: "running", startedAt });
    const result = await refreshResearch({
      repository: repo ?? repository(),
      collect,
      dryRun,
      force,
      intervalHours,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(25 * 60000)])
        : AbortSignal.timeout(25 * 60000),
    });
    await store.write({
      ...previousStatus,
      ...result,
      startedAt,
      finishedAt: new Date().toISOString(),
      lastError: null,
      ...(result.state === "published"
        ? { lastSuccessAt: result.fetchedAt }
        : {}),
    });
    return result;
  } catch (error) {
    const code =
      error.code && /^[A-Z_]+$/.test(error.code)
        ? error.code
        : "REFRESH_FAILED";
    await store.write({
      ...previousStatus,
      state: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      lastError: code,
    });
    throw Error(
      `Refresh failed (${code}). Previous snapshots are retained; no success is recorded.`,
    );
  } finally {
    await release();
  }
}

export async function main(args = process.argv.slice(2)) {
  const allowed = new Set([
    "--once",
    "--watch",
    "--status",
    "--dry-run",
    "--force",
  ]);
  if (
    args.some((arg) => !allowed.has(arg)) ||
    new Set(args).size !== args.length ||
    (args.includes("--status") && args.length !== 1) ||
    (args.includes("--watch") && args.length !== 1) ||
    (args.includes("--watch") &&
      (args.includes("--dry-run") ||
        args.includes("--force") ||
        args.includes("--status")))
  )
    throw Error("Use --once [--dry-run] [--force], --watch or --status.");
  if (args.includes("--status")) {
    console.log(JSON.stringify(await refreshState().read()));
    return;
  }
  const intervalHours = Number(
    process.env.RESEARCH_REFRESH_INTERVAL_HOURS ?? 24,
  );
  if (
    !Number.isInteger(intervalHours) ||
    intervalHours < 6 ||
    intervalHours > 168
  )
    throw Error("Refresh interval must be 6 to 168 whole hours.");
  const stop = new AbortController();
  const cancel = () => stop.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    do {
      try {
        const result = await runOnce({
          dryRun: args.includes("--dry-run"),
          force: args.includes("--force"),
          intervalHours,
          signal: stop.signal,
        });
        console.log(JSON.stringify(result));
        if (result.state === "locked" && !args.includes("--watch"))
          throw Error(
            "A refresh lock exists. Check its worker before retrying.",
          );
      } catch (error) {
        console.error(error.message);
        if (!args.includes("--watch"))
          throw Error("Research refresh did not complete.");
      }
      if (!args.includes("--watch") || stop.signal.aborted) break;
      // Await each run; an hourly wake checks whether the last successful snapshot is due.
      await sleep(3600000, undefined, { signal: stop.signal });
    } while (!stop.signal.aborted);
  } catch (error) {
    if (!stop.signal.aborted) throw error;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
