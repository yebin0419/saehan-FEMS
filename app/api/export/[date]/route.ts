import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { workDayMinuteToClock } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  const equipments = await db.select().from(schema.emsEquipment);
  const byId = new Map(equipments.map((e) => [e.id, e]));

  const results = await db
    .select()
    .from(schema.emsAnalysisResult)
    .where(eq(schema.emsAnalysisResult.analysisDate, date));

  const events = await db
    .select()
    .from(schema.emsDowntimeEvent)
    .where(eq(schema.emsDowntimeEvent.analysisDate, date));

  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ["공장", "설비", "그룹", "Run(분)", "Idle(분)", "Stop(분)", "가동률(%)", "제외"],
    ...results.map((r) => {
      const e = r.equipmentId ? byId.get(r.equipmentId) : null;
      return [
        e?.factory ?? "",
        e?.code ?? "",
        e?.group ?? "",
        r.runMinutes,
        r.idleMinutes,
        r.stopMinutes,
        r.utilizationRate ? Number((Number(r.utilizationRate) * 100).toFixed(2)) : 0,
        r.excluded ? "O" : "",
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "설비별_일요약");

  const eventRows = [
    ["설비", "상태", "시작", "종료", "지속(분)", "평균전류", "최소", "최대", "태그", "원인", "메모"],
    ...events.map((ev) => {
      const e = byId.get(ev.equipmentId);
      const tagsText = Array.isArray(ev.tags)
        ? (ev.tags as { t: string }[]).map((t) => t.t).join(", ")
        : "";
      return [
        e?.code ?? "",
        ev.state === "stop" ? "완전정지" : "비가동",
        workDayMinuteToClock(ev.startMinute),
        workDayMinuteToClock(ev.endMinute + 1),
        ev.duration,
        Number(ev.avgCurrent),
        Number(ev.minCurrent),
        Number(ev.maxCurrent),
        tagsText,
        ev.cause ?? "",
        ev.memo ?? "",
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eventRows), "비가동_구간상세");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="saehanFEMS_${date}.xlsx"`,
    },
  });
}
