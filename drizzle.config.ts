import type { Config } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = new URL(process.env.DATABASE_URL!);

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  tablesFilter: ["ems_*"],
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  },
} satisfies Config;
