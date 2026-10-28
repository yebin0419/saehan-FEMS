import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { eq, asc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const rows = await db
    .select()
    .from(schema.emsEquipment)
    .where(eq(schema.emsEquipment.active, true))
    .orderBy(asc(schema.emsEquipment.displayOrder));
  return NextResponse.json({ equipments: rows });
}
