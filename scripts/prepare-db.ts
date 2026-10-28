import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const pool = new Pool({
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  });

  console.log("Clearing stale analysis/event rows (will be regenerated)...");
  await pool.query(`DELETE FROM ems_downtime_event`);
  await pool.query(`DELETE FROM ems_analysis_result`);

  console.log("Checking reading date range...");
  const range = await pool.query(
    `SELECT MIN(recorded_at) AS min_t, MAX(recorded_at) AS max_t, COUNT(*)::int AS n FROM ems_reading`
  );
  console.log("  readings:", range.rows[0]);

  const byDate = await pool.query(
    `SELECT DATE(recorded_at - INTERVAL '7 hours') AS workday, COUNT(*)::int AS n FROM ems_reading GROUP BY workday ORDER BY workday`
  );
  console.log("  by workday:");
  for (const r of byDate.rows) console.log(`    ${r.workday}: ${r.n}`);

  await pool.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
