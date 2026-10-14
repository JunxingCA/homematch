import { mkdir, writeFile } from "node:fs/promises";

// Intentionally limited to credential-free loopback preview HTML, not product/provider load.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:4319");
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(origin.hostname) ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw Error("Only a loopback preview origin is allowed");
const status = await fetch(new URL("/api/auth/session", origin), {
  redirect: "error",
  signal: AbortSignal.timeout(10000),
});
if (!status.ok || (await status.json()).mode !== "preview")
  throw Error("Start an explicitly read-only preview before benchmarking");
async function sample() {
  const start = performance.now();
  try {
    const response = await fetch(origin, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    return {
      ok: response.ok && text.includes("HomeMatch"),
      status: response.status,
      elapsedMs: Math.round(performance.now() - start),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      elapsedMs: Math.round(performance.now() - start),
    };
  }
}
const first = await sample();
const start = performance.now();
const samples = await Promise.all(Array.from({ length: 50 }, sample));
const sorted = samples.map((r) => r.elapsedMs).sort((a, b) => a - b);
const report = {
  createdAt: new Date().toISOString(),
  scope: "public-preview-html-only",
  fullRecommendationBenchmark: false,
  concurrency: 50,
  firstSample: first,
  successes: samples.filter((r) => r.ok).length,
  failures: samples.filter((r) => !r.ok).length,
  batchMs: Math.round(performance.now() - start),
  p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
  p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
  maxMs: sorted.at(-1),
};
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/public-shell-benchmark.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (!first.ok || report.failures) process.exitCode = 1;
