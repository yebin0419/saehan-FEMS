import { NextRequest, NextResponse } from "next/server";
import { runAnalysisForDate } from "@/lib/analysis/run";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const date: string | undefined = body?.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) required" }, { status: 400 });
    }

    const results = await runAnalysisForDate(date);
    return NextResponse.json({
      ok: true,
      date,
      equipmentCount: results.length,
      analyzedCount: results.filter((r) => !r.excluded).length,
      excludedCount: results.filter((r) => r.excluded).length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
