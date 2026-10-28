import { db, schema } from "../db/client";
import { and, eq, gte, lt } from "drizzle-orm";
import { WORK_DAY_START_HOUR } from "../constants";
import { analyzeEquipment } from "./classify";
import type { EquipmentAnalysis } from "./types";

export async function runAnalysisForDate(analysisDate: string): Promise<EquipmentAnalysis[]> {
  const equipments = await db.select().from(schema.emsEquipment).where(eq(schema.emsEquipment.active, true));
  const criteria = await db.select().from(schema.emsCriteria);
  const criteriaByGroup = new Map(criteria.map((c) => [c.group, c]));

  const [y, m, d] = analysisDate.split("-").map(Number);
  const start = new Date(y, m - 1, d, WORK_DAY_START_HOUR, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const results: EquipmentAnalysis[] = [];

  for (const eq_ of equipments) {
    const crit = criteriaByGroup.get(eq_.group);
    if (!crit) continue;

    const readings = await db
      .select()
      .from(schema.emsReading)
      .where(
        and(
          eq(schema.emsReading.equipmentId, eq_.id),
          gte(schema.emsReading.recordedAt, start),
          lt(schema.emsReading.recordedAt, end)
        )
      );

    const samples = readings.map((r) => ({
      recordedAt: r.recordedAt,
      current: Number(r.currentValue),
    }));

    const result = analyzeEquipment(
      {
        id: eq_.id,
        code: eq_.code,
        factory: eq_.factory,
        group: eq_.group,
        criterion: {
          stopThreshold: Number(crit.stopThreshold),
          idleThreshold: Number(crit.idleThreshold),
          durationMin: crit.durationMin,
        },
      },
      samples,
      analysisDate
    );
    results.push(result);
  }

  await persistResults(analysisDate, results);
  return results;
}

async function persistResults(analysisDate: string, results: EquipmentAnalysis[]) {
  for (const r of results) {
    await db
      .insert(schema.emsAnalysisResult)
      .values({
        analysisDate,
        factory: r.factory,
        equipmentId: r.equipmentId,
        status: r.excluded ? "excluded" : r.utilization >= 0.95 ? "run" : r.utilization >= 0.8 ? "idle" : "stop",
        minutes: r.totalMinutes,
        runMinutes: r.runMinutes,
        idleMinutes: r.idleMinutes,
        stopMinutes: r.stopMinutes,
        plannedStopMinutes: 0,
        excluded: r.excluded,
        utilizationRate: r.totalMinutes > 0 ? r.utilization.toFixed(4) : null,
        resultJson: { excludeReason: r.excludeReason ?? null },
      })
      .onConflictDoUpdate({
        target: [schema.emsAnalysisResult.analysisDate, schema.emsAnalysisResult.equipmentId],
        set: {
          status: r.excluded ? "excluded" : r.utilization >= 0.95 ? "run" : r.utilization >= 0.8 ? "idle" : "stop",
          minutes: r.totalMinutes,
          runMinutes: r.runMinutes,
          idleMinutes: r.idleMinutes,
          stopMinutes: r.stopMinutes,
          excluded: r.excluded,
          utilizationRate: r.totalMinutes > 0 ? r.utilization.toFixed(4) : null,
          resultJson: { excludeReason: r.excludeReason ?? null },
        },
      });

    await db
      .delete(schema.emsDowntimeEvent)
      .where(
        and(
          eq(schema.emsDowntimeEvent.analysisDate, analysisDate),
          eq(schema.emsDowntimeEvent.equipmentId, r.equipmentId)
        )
      );

    if (r.events.length > 0) {
      await db.insert(schema.emsDowntimeEvent).values(
        r.events.map((e) => ({
          analysisDate,
          equipmentId: r.equipmentId,
          state: e.state,
          startMinute: e.startMinute,
          endMinute: e.endMinute,
          duration: e.duration,
          avgCurrent: e.avgCurrent.toFixed(3),
          minCurrent: e.minCurrent.toFixed(3),
          maxCurrent: e.maxCurrent.toFixed(3),
          tags: e.tags,
        }))
      );
    }
  }
}
