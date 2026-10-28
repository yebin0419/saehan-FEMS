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

  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log("Tables:");
  for (const t of tables.rows) console.log("  -", t.table_name);

  const emsTables = tables.rows.filter((r) => r.table_name.startsWith("ems_"));
  for (const t of emsTables) {
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
      [t.table_name]
    );
    const count = await pool.query(`SELECT COUNT(*)::int AS c FROM "${t.table_name}"`);
    console.log(`\n== ${t.table_name} (${count.rows[0].c} rows) ==`);
    for (const c of cols.rows) {
      console.log(`  ${c.column_name} :: ${c.data_type} ${c.is_nullable === "YES" ? "NULL" : "NOT NULL"}`);
    }
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
