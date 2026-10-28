import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: DrizzleDb;
};

function initDb(): DrizzleDb {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(dbUrl);
  const pool = new Pool({
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.pool = pool;
  }
  return drizzle(pool, { schema });
}

/**
 * Lazy-initialized Drizzle 클라이언트.
 * import 시점에는 아무것도 하지 않고, 첫 쿼리 호출 시점에 Pool과 drizzle을 생성한다.
 * 이렇게 하면 Vercel 빌드의 "collect page data" 단계에서
 * DATABASE_URL이 아직 주입되지 않았더라도 모듈 로드 자체는 통과한다.
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    if (!globalForDb.db) globalForDb.db = initDb();
    const value = Reflect.get(globalForDb.db, prop, receiver);
    return typeof value === "function" ? value.bind(globalForDb.db) : value;
  },
});

export { schema };
