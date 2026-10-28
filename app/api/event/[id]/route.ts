import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const patch: { cause?: string | null; memo?: string | null } = {};
  if (body.cause !== undefined) patch.cause = body.cause || null;
  if (body.memo !== undefined) patch.memo = body.memo || null;

  await db.update(schema.emsDowntimeEvent).set(patch).where(eq(schema.emsDowntimeEvent.id, idNum));
  return NextResponse.json({ ok: true, id: idNum, patch });
}
