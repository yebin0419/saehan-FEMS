import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const date = process.argv[2];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Usage: tsx scripts/analyze.ts YYYY-MM-DD");
    process.exit(1);
  }
  const { runAnalysisForDate } = await import("../lib/analysis/run");
  console.log(`Analyzing ${date}...`);
  const t0 = Date.now();
  const results = await runAnalysisForDate(date);
  const t1 = Date.now();
  const active = results.filter((r) => !r.excluded);
  const excluded = results.filter((r) => r.excluded);
  const avgUtil =
    active.length > 0
      ? active.reduce((s, r) => s + r.utilization, 0) / active.length
      : 0;
  console.log(`\nDone in ${t1 - t0}ms`);
  console.log(`  Total:    ${results.length}`);
  console.log(`  Active:   ${active.length}`);
  console.log(`  Excluded: ${excluded.length}`);
  console.log(`  Avg util: ${(avgUtil * 100).toFixed(1)}%`);
  console.log("\nTop 5 (lowest utilization among active):");
  active
    .sort((a, b) => a.utilization - b.utilization)
    .slice(0, 5)
    .forEach((r) =>
      console.log(
        `  ${r.code.padEnd(8)} util=${(r.utilization * 100).toFixed(1)}%  run=${r.runMinutes}  idle=${r.idleMinutes}  stop=${r.stopMinutes}  events=${r.events.length}`
      )
    );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
