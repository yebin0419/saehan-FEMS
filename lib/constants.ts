export const WORK_DAY_START_HOUR = 7;
export const SHIFT_NIGHT_START_HOUR = 19;

export const NOPROD_STOP_MIN = 1320;
export const LONG_MIN = 60;
export const SHORT_MIN = 15;
export const CHG_MIN = 20;
export const CHG_MAX = 240;

export const ST_GOOD = 0.95;
export const ST_WARN = 0.8;

export type Status = "run" | "idle" | "stop";

export const STATUS_LABEL: Record<Status, string> = {
  run: "정상가동",
  idle: "비가동",
  stop: "완전정지",
};

export const STATUS_COLOR: Record<Status, string> = {
  run: "#22c55e",
  idle: "#f59e0b",
  stop: "#ef4444",
};
