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

  async function run(sql: string) {
    console.log("  →", sql.split("\n")[0].slice(0, 80));
    await pool.query(sql);
  }

  console.log("Adding missing columns on ems_analysis_result...");
  await run(`ALTER TABLE ems_analysis_result ADD COLUMN IF NOT EXISTS factory VARCHAR(10)`);
  await run(`ALTER TABLE ems_analysis_result ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'run'`);
  await run(`ALTER TABLE ems_analysis_result ADD COLUMN IF NOT EXISTS minutes INT NOT NULL DEFAULT 1440`);
  await run(`ALTER TABLE ems_analysis_result ADD COLUMN IF NOT EXISTS planned_stop_minutes INT NOT NULL DEFAULT 0`);
  await run(`ALTER TABLE ems_analysis_result ADD COLUMN IF NOT EXISTS excluded BOOLEAN NOT NULL DEFAULT false`);

  console.log("\nEnsuring unique constraint for upserts...");
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'ems_analysis_unique'
      ) THEN
        CREATE UNIQUE INDEX ems_analysis_unique ON ems_analysis_result (analysis_date, equipment_id);
      END IF;
    END $$;
  `);
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analysis_equip_date'
      ) THEN
        CREATE INDEX idx_analysis_equip_date ON ems_analysis_result (equipment_id, analysis_date);
      END IF;
    END $$;
  `);

  console.log("\nEnsuring unique on ems_reading...");
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'ems_reading_eq_time'
      ) THEN
        CREATE UNIQUE INDEX ems_reading_eq_time ON ems_reading (equipment_id, recorded_at);
      END IF;
    END $$;
  `);
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ems_reading_time'
      ) THEN
        CREATE INDEX idx_ems_reading_time ON ems_reading (recorded_at, equipment_id);
      END IF;
    END $$;
  `);

  console.log("\nEnsuring index on ems_downtime_event...");
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_eq_date'
      ) THEN
        CREATE INDEX idx_event_eq_date ON ems_downtime_event (equipment_id, analysis_date);
      END IF;
    END $$;
  `);

  console.log("\nEnsuring unique on ems_mold_production...");
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'ems_mold_unique'
      ) THEN
        CREATE UNIQUE INDEX ems_mold_unique ON ems_mold_production (equipment_id, production_date, order_no);
      END IF;
    END $$;
  `);

  console.log("\nMigration done.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
