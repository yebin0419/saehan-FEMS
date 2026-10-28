import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ group: string }> }
) {
  const { group } = await params;
  const body = await req.json();
  const stop = Number(body.stopThreshold);
  const idle = Number(body.idleThreshold);
  const dur = Number(body.durationMin);
  if (!isFinite(stop) || !isFinite(idle) || !isFinite(dur)) {
    return NextResponse.json({ error: "invalid thresholds" }, { status: 400 });
  }

  await db
    .update(schema.emsCriteria)
    .set({
      stopThreshold: String(stop),
      idleThreshold: String(idle),
      durationMin: dur,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.emsCriteria.group, decodeURIComponent(group)));

  return NextResponse.json({ ok: true, group });
}
