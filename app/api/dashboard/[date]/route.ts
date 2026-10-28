import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { and, desc, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const factory = req.nextUrl.searchParams.get("factory");

  const equipments = await db.select().from(schema.emsEquipment).where(eq(schema.emsEquipment.active, true));
  const byId = new Map(equipments.map((e) => [e.id, e]));

  const results = await db
    .select()
    .from(schema.emsAnalysisResult)
    .where(eq(schema.emsAnalysisResult.analysisDate, date));

  const filtered = results.filter((r) => {
    const eqMaster = r.equipmentId ? byId.get(r.equipmentId) : null;
    if (!eqMaster) return false;
    if (factory && factory !== "전체" && eqMaster.factory !== factory) return false;
    return true;
  });

  const active = filtered.filter((r) => !r.excluded);
  const totalRun = active.reduce((s, r) => s + r.runMinutes, 0);
  const totalIdle = active.reduce((s, r) => s + r.idleMinutes, 0);
  const totalStop = active.reduce((s, r) => s + r.stopMinutes, 0);
  const totalMin = totalRun + totalIdle + totalStop;
  const avgUtil = totalMin > 0 ? totalRun / totalMin : 0;

  const warnEqs = active.filter((r) => Number(r.utilizationRate) < 0.8);

  const equipmentsOut = filtered
    .map((r) => {
      const m = r.equipmentId ? byId.get(r.equipmentId) : null;
      return {
        equipmentId: r.equipmentId,
        code: m?.code ?? "",
        factory: m?.factory ?? "",
        group: m?.group ?? "",
        runMinutes: r.runMinutes,
        idleMinutes: r.idleMinutes,
        stopMinutes: r.stopMinutes,
        utilization: Number(r.utilizationRate) || 0,
        excluded: r.excluded,
      };
    })
    .filter((x) => x.code);
  equipmentsOut.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    return a.utilization - b.utilization;
  });

  const topEvents = await db
    .select()
    .from(schema.emsDowntimeEvent)
    .where(eq(schema.emsDowntimeEvent.analysisDate, date))
    .orderBy(desc(schema.emsDowntimeEvent.duration))
    .limit(5);

  const topEventsOut = topEvents.map((e) => {
    const m = byId.get(e.equipmentId);
    return {
      id: e.id,
      code: m?.code ?? "",
      factory: m?.factory ?? "",
      state: e.state,
      startMinute: e.startMinute,
      endMinute: e.endMinute,
      duration: e.duration,
      avgCurrent: Number(e.avgCurrent),
      tags: e.tags,
      cause: e.cause,
    };
  });

  return NextResponse.json({
    date,
    factory: factory ?? "전체",
    summary: {
      avgUtilization: avgUtil,
      totalRunMin: totalRun,
      totalIdleMin: totalIdle,
      totalStopMin: totalStop,
      activeCount: active.length,
      excludedCount: filtered.length - active.length,
      warnCount: warnEqs.length,
    },
    equipments: equipmentsOut,
    topEvents: topEventsOut,
  });
}
