import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normaliseUra } from "../src/domain/marketEvidence.mjs";
import { boundedText } from "./lib/providerDownload.mjs";
import { encodePrivateSnapshot } from "../src/server/providers/privateSnapshotStorage.mjs";

export async function collectPrivate({
  accessKey,
  fetcher = fetch,
  now = () => new Date(),
}) {
  if (!accessKey?.trim())
    throw Error(
      "Add URA_ACCESS_KEY to .env.local; OneMap credentials cannot be used here.",
    );
  const read = async (url, token) => {
    const signal = AbortSignal.timeout(60000);
    const response = await fetcher(url, {
      headers: { AccessKey: accessKey, ...(token ? { Token: token } : {}) },
      signal,
      redirect: "error",
      cache: "no-store",
    });
    return JSON.parse(await boundedText(response, 32 * 1024 * 1024, signal));
  };
  const auth = await read(
    "https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1",
  );
  if (
    auth.Status !== "Success" ||
    typeof auth.Result !== "string" ||
    !auth.Result.length
  )
    throw Error("URA authentication failed. Check your registered access key.");
  const batches = [];
  for (let batch = 1; batch <= 4; batch++)
    batches.push(
      await read(
        `https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=PMI_Resi_Transaction&batch=${batch}`,
        auth.Result,
      ),
    );
  const fetchedAt = now().toISOString();
  const hash = createHash("sha256")
    .update(JSON.stringify(batches))
    .digest("hex");
  return normaliseUra(
    batches,
    fetchedAt,
    `ura-${fetchedAt.slice(0, 10)}-${hash.slice(0, 20)}`,
  );
}
export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== "--publish"))
    throw Error(
      "Supported option: --publish. Without it, only the ignored local cache is updated.",
    );
  const snapshot = await collectPrivate({
    accessKey: process.env.URA_ACCESS_KEY,
  });
  await mkdir(".cache/market", { recursive: true });
  await writeFile(".cache/market/private.json", JSON.stringify(snapshot));
  if (args.includes("--publish")) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw Error(
        "Backend database configuration is required for publication.",
      );
    const client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) =>
            // Whole five-year snapshots can exceed 10 MB; this is an offline bulk import.
            fetch(input, { ...init, signal: AbortSignal.timeout(120000) }),
        },
      },
    );
    const { error } = await client.rpc("publish_private_snapshot", {
      p_id: snapshot.id,
      p_payload: encodePrivateSnapshot(snapshot),
    });
    if (error)
      throw Error(
        "Snapshot publication failed. The previous published snapshot is unchanged.",
      );
  }
  console.log(
    JSON.stringify({
      event: "private_prices_imported",
      published: args.includes("--publish"),
      projects: snapshot.projects.length,
      transactions: snapshot.projects.reduce(
        (sum, p) => sum + p.transactions.length,
        0,
      ),
      latestMonth: snapshot.latestMonth,
      skippedMultiUnit: snapshot.skippedMultiUnit,
      skippedCoordinates: snapshot.skippedCoordinates,
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error(
      "Private price import failed. Check URA_ACCESS_KEY, provider availability and schema compatibility. No partial snapshot was published.",
    );
    process.exitCode = 1;
  });
