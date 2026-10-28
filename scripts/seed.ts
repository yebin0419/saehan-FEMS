import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db, schema } = await import("../lib/db/client");
  const { EQUIPMENT_SEED, CRITERIA_SEED } = await import("../lib/master-data");
  const { sql } = await import("drizzle-orm");

  console.log("Seeding criteria...");
  for (const c of CRITERIA_SEED) {
    await db
      .insert(schema.emsCriteria)
      .values({
        group: c.group,
        stopThreshold: String(c.stopThreshold),
        idleThreshold: String(c.idleThreshold),
        durationMin: c.durationMin,
      })
      .onConflictDoUpdate({
        target: schema.emsCriteria.group,
        set: {
          stopThreshold: String(c.stopThreshold),
          idleThreshold: String(c.idleThreshold),
          durationMin: c.durationMin,
          updatedAt: sql`now()`,
        },
      });
  }
  console.log(`  → ${CRITERIA_SEED.length} criteria groups`);

  console.log("Seeding equipment...");
  for (const e of EQUIPMENT_SEED) {
    await db
      .insert(schema.emsEquipment)
      .values(e)
      .onConflictDoUpdate({
        target: schema.emsEquipment.code,
        set: {
          factory: e.factory,
          group: e.group,
          displayOrder: e.displayOrder,
          active: true,
        },
      });
  }
  console.log(`  → ${EQUIPMENT_SEED.length} equipment units`);

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
