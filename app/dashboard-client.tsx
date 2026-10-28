"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMinutes, formatPct, workDayMinuteToClock } from "@/lib/utils";
import { STATUS_COLOR, STATUS_LABEL, ST_GOOD, ST_WARN } from "@/lib/constants";
import { Download, Loader2, RefreshCw, AlertTriangle } from "lucide-react";

type DashboardData = {
  date: string;
  factory: string;
  summary: {
    avgUtilization: number;
    totalRunMin: number;
    totalIdleMin: number;
    totalStopMin: number;
    activeCount: number;
    excludedCount: number;
    warnCount: number;
  };
  equipments: Array<{
    equipmentId: number;
    code: string;
    factory: string;
    group: string;
    runMinutes: number;
    idleMinutes: number;
    stopMinutes: number;
    utilization: number;
    excluded: boolean;
  }>;
  topEvents: Array<{
    id: number;
    code: string;
    factory: string;
    state: "idle" | "stop";
    startMinute: number;
    endMinute: number;
    duration: number;
    tags: Array<{ k: string; t: string }> | null;
    cause: string | null;
  }>;
};

export default function DashboardClient({
  initialDate,
  initialFactory,
}: {
  initialDate: string;
  initialFactory: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [factory, setFactory] = useState(initialFactory);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const q = factory ? `?factory=${encodeURIComponent(factory)}` : "";
      const res = await fetch(`/api/dashboard/${date}${q}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "조회 실패");
      setData(d);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function analyzeNow() {
    setAnalyzing(true);
    try {
      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      await load();
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    load();
  }, [date, factory]);

  const verdict = (() => {
    if (!data) return null;
    const u = data.summary.avgUtilization;
    if (u >= ST_GOOD) return { kind: "run" as const, label: "양호", msg: "모든 설비가 안정적으로 가동 중입니다." };
    if (u >= ST_WARN) return { kind: "idle" as const, label: "주의", msg: `점검이 필요한 설비 ${data.summary.warnCount}대를 확인하세요.` };
    return { kind: "stop" as const, label: "점검 필요", msg: `점검 필요 설비 ${data.summary.warnCount}대 · 비가동 집중 구간을 확인하세요.` };
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
        />
        <select
          value={factory}
          onChange={(e) => setFactory(e.target.value)}
          className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
        >
          <option value="">전체 공장</option>
          <option value="1공장">1공장</option>
          <option value="2공장">2공장</option>
        </select>
        <Button variant="secondary" onClick={analyzeNow} disabled={analyzing}>
          {analyzing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          {analyzing ? "분석 중..." : "분석 재실행"}
        </Button>
        <div className="flex-1" />
        <a href={`/api/export/${date}`} className="no-print">
          <Button variant="secondary">
            <Download size={14} /> 엑셀 받기
          </Button>
        </a>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> 로딩 중...
        </div>
      ) : data ? (
        <>
          {/* 평균 가동율 배너 */}
          {verdict && (
            <Card className={`border-l-4 ${verdict.kind === "run" ? "border-l-run" : verdict.kind === "idle" ? "border-l-idle" : "border-l-stop"}`}>
              <CardBody className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1">평균 가동율</div>
                  <div className="flex items-center gap-3">
                    <div className="text-4xl font-bold tabular-nums" style={{ color: STATUS_COLOR[verdict.kind] }}>
                      {formatPct(data.summary.avgUtilization)}
                    </div>
                    <Badge kind={verdict.kind}>{verdict.label}</Badge>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{verdict.msg}</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>활성 {data.summary.activeCount}대 · 제외 {data.summary.excludedCount}대</div>
                  <div className="mt-1">총 분석 {data.summary.activeCount + data.summary.excludedCount}대 설비</div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* KPI 카드 3개 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardBody>
                <div className="text-xs text-slate-500 uppercase font-medium tracking-wider">비가동 + 정지</div>
                <div className="text-2xl font-bold mt-1 text-stop tabular-nums">
                  {formatMinutes(data.summary.totalIdleMin + data.summary.totalStopMin)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Idle {formatMinutes(data.summary.totalIdleMin)} · Stop {formatMinutes(data.summary.totalStopMin)}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-xs text-slate-500 uppercase font-medium tracking-wider">정상 가동 시간</div>
                <div className="text-2xl font-bold mt-1 text-run tabular-nums">
                  {formatMinutes(data.summary.totalRunMin)}
                </div>
                <div className="text-xs text-slate-500 mt-1">활성 설비 합계</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="text-xs text-slate-500 uppercase font-medium tracking-wider">점검 필요 설비</div>
                <div className="text-2xl font-bold mt-1 text-idle tabular-nums">{data.summary.warnCount}대</div>
                <div className="text-xs text-slate-500 mt-1">가동율 80% 미만</div>
              </CardBody>
            </Card>
          </div>

          {/* 설비별 가동 구성 */}
          <Card>
            <CardBody>
              <CardTitle extra={<>가동율 낮은 순 · 클릭하면 상세로 이동</>}>설비별 가동 구성</CardTitle>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2">
                {data.equipments.map((e) => (
                  <EquipmentBar key={e.code} equipment={e} date={date} />
                ))}
              </div>
            </CardBody>
          </Card>

          {/* TOP 5 비가동 구간 */}
          <Card>
            <CardBody>
              <CardTitle extra={<>가장 길게 멈춘 순</>}>먼저 확인할 비가동 구간 TOP 5</CardTitle>
              {data.topEvents.length === 0 ? (
                <div className="text-sm text-slate-500 py-6 text-center">해당 날짜에 비가동 구간이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2">설비</th>
                      <th>상태</th>
                      <th>시작</th>
                      <th>종료</th>
                      <th className="text-right">지속</th>
                      <th>태그</th>
                      <th>원인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topEvents.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2">
                          <Link href={`/equipment/${e.code}?date=${date}`} className="text-brand hover:underline font-medium">
                            {e.code}
                          </Link>
                          <span className="text-xs text-slate-400 ml-2">{e.factory}</span>
                        </td>
                        <td><Badge kind={e.state === "stop" ? "stop" : "idle"}>{STATUS_LABEL[e.state]}</Badge></td>
                        <td className="tabular-nums text-slate-600">{workDayMinuteToClock(e.startMinute)}</td>
                        <td className="tabular-nums text-slate-600">{workDayMinuteToClock(e.endMinute + 1)}</td>
                        <td className="tabular-nums text-right font-semibold">{formatMinutes(e.duration)}</td>
                        <td className="text-xs text-slate-500">
                          {e.tags?.map((t, i) => (
                            <span key={i} className="inline-block px-1.5 py-0.5 bg-slate-100 rounded mr-1">{t.t}</span>
                          ))}
                        </td>
                        <td className="text-xs text-slate-500">{e.cause ?? <span className="text-slate-400">미분류</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function EquipmentBar({ equipment, date }: { equipment: DashboardData["equipments"][number]; date: string }) {
  const total = equipment.runMinutes + equipment.idleMinutes + equipment.stopMinutes;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const statusColor =
    equipment.excluded
      ? "#9ca3af"
      : equipment.utilization >= ST_GOOD
      ? STATUS_COLOR.run
      : equipment.utilization >= ST_WARN
      ? STATUS_COLOR.idle
      : STATUS_COLOR.stop;

  return (
    <Link href={`/equipment/${equipment.code}?date=${date}`} className="block py-1.5 group">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-16 text-xs font-semibold text-slate-700 group-hover:text-brand">{equipment.code}</div>
        <div className="text-[10px] text-slate-400">{equipment.group}</div>
        <div className="flex-1" />
        {equipment.excluded ? (
          <Badge kind="muted">제외</Badge>
        ) : (
          <div className="text-xs tabular-nums font-bold" style={{ color: statusColor }}>
            {formatPct(equipment.utilization)}
          </div>
        )}
      </div>
      <div className="h-3 rounded overflow-hidden flex bg-slate-100">
        {equipment.excluded ? (
          <div className="w-full bg-slate-200" />
        ) : (
          <>
            <div style={{ width: `${pct(equipment.runMinutes)}%`, background: STATUS_COLOR.run }} title={`Run ${equipment.runMinutes}분`} />
            <div style={{ width: `${pct(equipment.idleMinutes)}%`, background: STATUS_COLOR.idle }} title={`Idle ${equipment.idleMinutes}분`} />
            <div style={{ width: `${pct(equipment.stopMinutes)}%`, background: STATUS_COLOR.stop }} title={`Stop ${equipment.stopMinutes}분`} />
          </>
        )}
      </div>
    </Link>
  );
}
