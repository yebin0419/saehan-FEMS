import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { and, eq, gte, lt, asc } from "drizzle-orm";
import { WORK_DAY_START_HOUR } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const eqRow = (
    await db.select().from(schema.emsEquipment).where(eq(schema.emsEquipment.code, code)).limit(1)
  )[0];
  if (!eqRow) return NextResponse.json({ error: "equipment not found" }, { status: 404 });

  const [y, mo, d] = date.split("-").map(Number);
  const start = new Date(y, mo - 1, d, WORK_DAY_START_HOUR, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const readings = await db
    .select()
    .from(schema.emsReading)
    .where(
      and(
        eq(schema.emsReading.equipmentId, eqRow.id),
        gte(schema.emsReading.recordedAt, start),
        lt(schema.emsReading.recordedAt, end)
      )
    )
    .orderBy(asc(schema.emsReading.recordedAt));

  const result = (
    await db
      .select()
      .from(schema.emsAnalysisResult)
      .where(
        and(
          eq(schema.emsAnalysisResult.analysisDate, date),
          eq(schema.emsAnalysisResult.equipmentId, eqRow.id)
        )
      )
      .limit(1)
  )[0];

  const events = await db
    .select()
    .from(schema.emsDowntimeEvent)
    .where(
      and(
        eq(schema.emsDowntimeEvent.analysisDate, date),
        eq(schema.emsDowntimeEvent.equipmentId, eqRow.id)
      )
    )
    .orderBy(asc(schema.emsDowntimeEvent.startMinute));

  return NextResponse.json({
    equipment: eqRow,
    date,
    result: result
      ? {
          runMinutes: result.runMinutes,
          idleMinutes: result.idleMinutes,
          stopMinutes: result.stopMinutes,
          utilization: Number(result.utilizationRate) || 0,
          excluded: result.excluded,
        }
      : null,
    readings: readings.map((r) => ({
      recordedAt: r.recordedAt,
      current: Number(r.currentValue),
    })),
    events: events.map((e) => ({
      id: e.id,
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
