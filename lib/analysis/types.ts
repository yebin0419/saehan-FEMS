import type { Status } from "../constants";

export type EmsSample = {
  recordedAt: Date;
  current: number;
};

export type Criterion = {
  stopThreshold: number;
  idleThreshold: number;
  durationMin: number;
};

export type EquipmentContext = {
  id: number;
  code: string;
  factory: string;
  group: string;
  criterion: Criterion;
};

export type MinuteState = {
  minute: number;
  current: number;
  status: Status;
};

export type EventTag = {
  k: string;
  t: string;
  h?: string;
};

export type DowntimeEventOut = {
  state: "idle" | "stop";
  startMinute: number;
  endMinute: number;
  duration: number;
  avgCurrent: number;
  minCurrent: number;
  maxCurrent: number;
  tags: EventTag[];
};

export type EquipmentAnalysis = {
  equipmentId: number;
  code: string;
  factory: string;
  group: string;
  totalMinutes: number;
  runMinutes: number;
  idleMinutes: number;
  stopMinutes: number;
  utilization: number;
  excluded: boolean;
  excludeReason?: string;
  events: DowntimeEventOut[];
  minuteStates: MinuteState[];
};
