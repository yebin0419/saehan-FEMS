export type EquipmentSeed = {
  code: string;
  factory: "1공장" | "2공장";
  group: string;
  displayOrder: number;
};

export type CriteriaSeed = {
  group: string;
  stopThreshold: number;
  idleThreshold: number;
  durationMin: number;
};

export const EQUIPMENT_SEED: EquipmentSeed[] = [
  ...Array.from({ length: 18 }, (_, i) => ({
    code: `PET-${i + 1}`,
    factory: "1공장" as const,
    group: "PET",
    displayOrder: i,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    code: `PE-${i + 1}`,
    factory: "1공장" as const,
    group: "PE",
    displayOrder: 100 + i,
  })),
  { code: "A-1", factory: "1공장", group: "사출기", displayOrder: 200 },
  { code: "B-1", factory: "1공장", group: "B-1", displayOrder: 210 },
  { code: "B-2", factory: "1공장", group: "B-2", displayOrder: 211 },
  ...Array.from({ length: 5 }, (_, i) => ({
    code: `P-${i + 1}`,
    factory: "2공장" as const,
    group: "사출기",
    displayOrder: 300 + i,
  })),
  { code: "S-1", factory: "2공장", group: "S-1", displayOrder: 400 },
  { code: "S-2", factory: "2공장", group: "S-2", displayOrder: 401 },
  { code: "S-3", factory: "2공장", group: "S-3,5", displayOrder: 402 },
  { code: "S-4", factory: "2공장", group: "S-4", displayOrder: 403 },
  { code: "S-5", factory: "2공장", group: "S-3,5", displayOrder: 404 },
  { code: "S-6", factory: "2공장", group: "S-6", displayOrder: 405 },
  { code: "S-7", factory: "2공장", group: "S-7", displayOrder: 406 },
];

export const CRITERIA_SEED: CriteriaSeed[] = [
  { group: "PET", stopThreshold: 5, idleThreshold: 60, durationMin: 5 },
  { group: "PE", stopThreshold: 5, idleThreshold: 50, durationMin: 3 },
  { group: "사출기", stopThreshold: 5, idleThreshold: 50, durationMin: 5 },
  { group: "B-1", stopThreshold: 5, idleThreshold: 50, durationMin: 3 },
  { group: "B-2", stopThreshold: 5, idleThreshold: 29, durationMin: 3 },
  { group: "S-1", stopThreshold: 5, idleThreshold: 40, durationMin: 3 },
  { group: "S-2", stopThreshold: 5, idleThreshold: 35, durationMin: 3 },
  { group: "S-3,5", stopThreshold: 5, idleThreshold: 60, durationMin: 3 },
  { group: "S-4", stopThreshold: 5, idleThreshold: 25, durationMin: 3 },
  { group: "S-6", stopThreshold: 5, idleThreshold: 50, durationMin: 3 },
  { group: "S-7", stopThreshold: 10, idleThreshold: 100, durationMin: 3 },
];
