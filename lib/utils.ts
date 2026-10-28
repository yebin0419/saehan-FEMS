import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { WORK_DAY_START_HOUR } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(mins: number): string {
  if (!mins) return "0분";
  if (mins < 60) return `${Math.round(mins)}분`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}시간 ${m}분`;
}

export function formatPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || !isFinite(ratio)) return "-";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function workDayMinuteToClock(minute: number): string {
  const hour = (Math.floor(minute / 60) + WORK_DAY_START_HOUR) % 24;
  const mm = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function todayWorkDate(): string {
  const now = new Date();
  if (now.getHours() < WORK_DAY_START_HOUR) now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}
