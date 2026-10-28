import {
  pgTable,
  serial,
  bigserial,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  date,
  text,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const emsEquipment = pgTable(
  "ems_equipment",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    factory: varchar("factory", { length: 10 }).notNull(),
    group: varchar("group", { length: 20 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  }
);

export const emsCriteria = pgTable("ems_criteria", {
  id: serial("id").primaryKey(),
  group: varchar("group", { length: 20 }).notNull().unique(),
  stopThreshold: numeric("stop_threshold", { precision: 6, scale: 2 }).notNull(),
  idleThreshold: numeric("idle_threshold", { precision: 6, scale: 2 }).notNull(),
  durationMin: integer("duration_min").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const emsReading = pgTable(
  "ems_reading",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    equipmentId: integer("equipment_id")
      .notNull()
      .references(() => emsEquipment.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    currentValue: numeric("current_value", { precision: 8, scale: 3 }).notNull(),
  },
  (t) => ({
    uq: uniqueIndex("ems_reading_eq_time").on(t.equipmentId, t.recordedAt),
    idxTime: index("idx_ems_reading_time").on(t.recordedAt, t.equipmentId),
  })
);

export const emsMoldProduction = pgTable(
  "ems_mold_production",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    equipmentId: integer("equipment_id")
      .notNull()
      .references(() => emsEquipment.id),
    productionDate: date("production_date").notNull(),
    deptCode: varchar("dept_code", { length: 10 }),
    orderNo: varchar("order_no", { length: 50 }),
    itemName: varchar("item_name", { length: 200 }),
    inputQty: integer("input_qty").notNull().default(0),
    goodQty: integer("good_qty").notNull().default(0),
    capa12hr: numeric("capa_12hr", { precision: 10, scale: 2 }).default("0"),
  },
  (t) => ({
    uq: uniqueIndex("ems_mold_unique").on(t.equipmentId, t.productionDate, t.orderNo),
  })
);

export const emsAnalysisResult = pgTable(
  "ems_analysis_result",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    analysisDate: date("analysis_date").notNull(),
    factory: varchar("factory", { length: 10 }),
    equipmentId: integer("equipment_id").references(() => emsEquipment.id),
    status: varchar("status", { length: 10 }).notNull(),
    minutes: integer("minutes").notNull(),
    runMinutes: integer("run_minutes").notNull().default(0),
    idleMinutes: integer("idle_minutes").notNull().default(0),
    stopMinutes: integer("stop_minutes").notNull().default(0),
    plannedStopMinutes: integer("planned_stop_minutes").notNull().default(0),
    excluded: boolean("excluded").notNull().default(false),
    utilizationRate: numeric("utilization_rate", { precision: 5, scale: 4 }),
    lostUnits: numeric("lost_units", { precision: 10, scale: 1 }),
    resultJson: jsonb("result_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("ems_analysis_unique").on(t.analysisDate, t.equipmentId),
    idxEqDate: index("idx_analysis_equip_date").on(t.equipmentId, t.analysisDate),
  })
);

export const emsDowntimeEvent = pgTable(
  "ems_downtime_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    analysisDate: date("analysis_date").notNull(),
    equipmentId: integer("equipment_id")
      .notNull()
      .references(() => emsEquipment.id),
    state: varchar("state", { length: 10 }).notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    duration: integer("duration").notNull(),
    avgCurrent: numeric("avg_current", { precision: 8, scale: 3 }),
    minCurrent: numeric("min_current", { precision: 8, scale: 3 }),
    maxCurrent: numeric("max_current", { precision: 8, scale: 3 }),
    lostUnits: numeric("lost_units", { precision: 10, scale: 1 }),
    tags: jsonb("tags"),
    cause: varchar("cause", { length: 50 }),
    memo: text("memo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxEqDate: index("idx_event_eq_date").on(t.equipmentId, t.analysisDate),
  })
);

export type Equipment = typeof emsEquipment.$inferSelect;
export type Criteria = typeof emsCriteria.$inferSelect;
export type Reading = typeof emsReading.$inferSelect;
export type MoldProduction = typeof emsMoldProduction.$inferSelect;
export type AnalysisResult = typeof emsAnalysisResult.$inferSelect;
export type DowntimeEvent = typeof emsDowntimeEvent.$inferSelect;
