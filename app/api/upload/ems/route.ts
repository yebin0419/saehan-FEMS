import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

type EmsSample = { t: string; a: number };
type EmsEquipmentJson = { id?: string; code?: string; name?: string; samples: EmsSample[] };
type EmsFileJson = {
  meta?: { factory?: string; from?: string; to?: string };
  equipments: EmsEquipmentJson[];
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const text = await file.text();
    const parsed = JSON.parse(text) as EmsFileJson;
    if (!parsed.equipments || !Array.isArray(parsed.equipments)) {
      return NextResponse.json({ error: "equipments array missing" }, { status: 400 });
    }

    const equipments = await db.select().from(schema.emsEquipment);
    const byCode = new Map(equipments.map((e) => [e.code, e]));

    let totalInserted = 0;
    const unknown: string[] = [];

    for (const eq of parsed.equipments) {
      const code = (eq.code || eq.id || eq.name || "").trim();
      const master = byCode.get(code);
      if (!master) {
        unknown.push(code);
        continue;
      }

      const rows = eq.samples
        .map((s) => {
          const t = new Date(String(s.t).replace(" ", "T"));
          if (isNaN(t.getTime())) return null;
          return {
            equipmentId: master.id,
            recordedAt: t,
            currentValue: String(Number(s.a) || 0),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (rows.length === 0) continue;

      const CHUNK = 1000;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        await db
          .insert(schema.emsReading)
          .values(slice)
          .onConflictDoUpdate({
            target: [schema.emsReading.equipmentId, schema.emsReading.recordedAt],
            set: { currentValue: sql`EXCLUDED.current_value` },
          });
        totalInserted += slice.length;
      }
    }

    return NextResponse.json({
      ok: true,
      meta: parsed.meta ?? null,
      inserted: totalInserted,
      equipmentCount: parsed.equipments.length - unknown.length,
      unknownCodes: unknown,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
