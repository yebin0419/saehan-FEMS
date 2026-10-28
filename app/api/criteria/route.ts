import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET() {
  const rows = await db.select().from(schema.emsCriteria);
  return NextResponse.json({ criteria: rows });
}
