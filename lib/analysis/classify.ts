import { WORK_DAY_START_HOUR, SHIFT_NIGHT_START_HOUR, NOPROD_STOP_MIN, LONG_MIN, SHORT_MIN, CHG_MIN, CHG_MAX } from "../constants";
import type { Status } from "../constants";
import type {
  Criterion,
  DowntimeEventOut,
  EmsSample,
  EquipmentAnalysis,
  EquipmentContext,
  EventTag,
  MinuteState,
} from "./types";

/**
 * 분석 기준일: 지정일 07:00 ~ 익일 07:00 (총 1,440분).
 * samples에서 해당 범위만 추려 분 단위 상태 배열을 생성한다.
 */
export function toMinuteStates(
  samples: EmsSample[],
  analysisDate: string,
  criterion: Criterion
): MinuteState[] {
  const [y, m, d] = analysisDate.split("-").map(Number);
  const start = new Date(y, m - 1, d, WORK_DAY_START_HOUR, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const byMinute = new Map<number, number>();
  for (const s of samples) {
    const t = s.recordedAt;
    if (t < start || t >= end) continue;
    const minuteIdx = Math.floor((t.getTime() - start.getTime()) / 60000);
    if (minuteIdx < 0 || minuteIdx >= 1440) continue;
    byMinute.set(minuteIdx, s.current);
  }

  const stopTh = criterion.stopThreshold;
  const idleTh = criterion.idleThreshold;
  const durMin = criterion.durationMin;

  const raw: Status[] = new Array(1440).fill("stop");
  const curValues: number[] = new Array(1440).fill(0);

  for (let i = 0; i < 1440; i++) {
    const v = byMinute.get(i);
    curValues[i] = v ?? 0;
    if (v === undefined) raw[i] = "stop";
    else if (v <= stopTh) raw[i] = "stop";
    else if (v <= idleTh) raw[i] = "idle";
    else raw[i] = "run";
  }

  const final: Status[] = raw.slice();
  for (let i = 0; i < 1440; ) {
    if (raw[i] === "idle") {
      let j = i;
      while (j < 1440 && raw[j] === "idle") j++;
      const span = j - i;
      if (span < durMin) {
        for (let k = i; k < j; k++) final[k] = "run";
      }
      i = j;
    } else i++;
  }

  return final.map((status, minute) => ({ minute, current: curValues[minute], status }));
}

export function detectEvents(states: MinuteState[]): DowntimeEventOut[] {
  const events: DowntimeEventOut[] = [];
  const n = states.length;
  let i = 0;
  while (i < n) {
    const s = states[i].status;
    if (s === "run") {
      i++;
      continue;
    }
    let j = i;
    while (j < n && states[j].status === s) j++;
    const slice = states.slice(i, j);
    const currents = slice.map((x) => x.current);
    const avg = currents.reduce((a, b) => a + b, 0) / Math.max(1, currents.length);
    events.push({
      state: s as "idle" | "stop",
      startMinute: i,
      endMinute: j - 1,
      duration: j - i,
      avgCurrent: Number(avg.toFixed(3)),
      minCurrent: Math.min(...currents),
      maxCurrent: Math.max(...currents),
      tags: computeTags(i, j - 1, s as "idle" | "stop"),
    });
    i = j;
  }
  return events;
}

function computeTags(startMin: number, endMin: number, state: "idle" | "stop"): EventTag[] {
  const tags: EventTag[] = [];
  const duration = endMin - startMin + 1;

  const startHour = (Math.floor(startMin / 60) + WORK_DAY_START_HOUR) % 24;
  const dayShift = startHour >= WORK_DAY_START_HOUR && startHour < SHIFT_NIGHT_START_HOUR;
  tags.push({ k: "shift", t: dayShift ? "주간" : "야간" });

  if (duration >= LONG_MIN) tags.push({ k: "long", t: "장시간" });
  if (state === "idle" && duration < SHORT_MIN) tags.push({ k: "short", t: "짧은 비가동" });
  if (state === "stop" && startMin === 0) tags.push({ k: "startstop", t: "하루 시작 정지" });
  if (state === "stop" && endMin === 1439) tags.push({ k: "endstop", t: "하루 끝 정지" });
  if (state === "stop" && duration >= CHG_MIN && duration <= CHG_MAX) {
    tags.push({ k: "change", t: "교체 후보" });
  }

  return tags;
}

export function summarize(
  equipment: EquipmentContext,
  states: MinuteState[],
  events: DowntimeEventOut[]
): EquipmentAnalysis {
  const runMinutes = states.filter((s) => s.status === "run").length;
  const idleMinutes = states.filter((s) => s.status === "idle").length;
  const stopMinutes = states.filter((s) => s.status === "stop").length;
  const totalMinutes = states.length;

  const longestStop = events
    .filter((e) => e.state === "stop")
    .reduce((max, e) => Math.max(max, e.duration), 0);
  const excluded = longestStop >= NOPROD_STOP_MIN || runMinutes <= 10;

  return {
    equipmentId: equipment.id,
    code: equipment.code,
    factory: equipment.factory,
    group: equipment.group,
    totalMinutes,
    runMinutes,
    idleMinutes,
    stopMinutes,
    utilization: totalMinutes > 0 ? runMinutes / totalMinutes : 0,
    excluded,
    excludeReason: excluded
      ? longestStop >= NOPROD_STOP_MIN
        ? `연속 정지 ${longestStop}분 (≥${NOPROD_STOP_MIN})`
        : `정상가동 ${runMinutes}분 (≤10)`
      : undefined,
    events,
    minuteStates: states,
  };
}

export function analyzeEquipment(
  equipment: EquipmentContext,
  samples: EmsSample[],
  analysisDate: string
): EquipmentAnalysis {
  const states = toMinuteStates(samples, analysisDate, equipment.criterion);
  const events = detectEvents(states);
  return summarize(equipment, states, events);
}
