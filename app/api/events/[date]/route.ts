import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { and, eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const code = req.nextUrl.searchParams.get("equipment");
  const equipments = await db.select().from(schema.emsEquipment);
  const byCode = new Map(equipments.map((e) => [e.code, e]));
  const byId = new Map(equipments.map((e) => [e.id, e]));

  const where = code
    ? and(
        eq(schema.emsDowntimeEvent.analysisDate, date),
        eq(schema.emsDowntimeEvent.equipmentId, byCode.get(code)?.id ?? -1)
      )
    : eq(schema.emsDowntimeEvent.analysisDate, date);

  const events = await db
    .select()
    .from(schema.emsDowntimeEvent)
    .where(where)
    .orderBy(desc(schema.emsDowntimeEvent.duration));

  return NextResponse.json({
    date,
    events: events.map((e) => ({
      id: e.id,
      code: byId.get(e.equipmentId)?.code ?? "",
      state: e.state,
      startMinute: e.startMinute,
      endMinute: e.endMinute,
      duration: e.duration,
      avgCurrent: Number(e.avgCurrent),
      minCurrent: Number(e.minCurrent),
      maxCurrent: Number(e.maxCurrent),
      tags: e.tags,
      cause: e.cause,
      memo: e.memo,
    })),
  });
}
