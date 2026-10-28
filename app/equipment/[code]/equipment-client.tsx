"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { formatMinutes, formatPct, workDayMinuteToClock } from "@/lib/utils";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";

type ApiData = {
  equipment: { id: number; code: string; factory: string; group: string };
  date: string;
  result: { runMinutes: number; idleMinutes: number; stopMinutes: number; utilization: number; excluded: boolean } | null;
  readings: Array<{ recordedAt: string; current: number }>;
  events: Array<{
    id: number;
    state: "idle" | "stop";
    startMinute: number;
    endMinute: number;
    duration: number;
    avgCurrent: number;
    minCurrent: number;
    maxCurrent: number;
    tags: Array<{ k: string; t: string }> | null;
    cause: string | null;
    memo: string | null;
  }>;
};

const CAUSE_OPTIONS = [
  "품종/지시 교체",
  "금형 교체",
  "설비 고장/수리",
  "정기/예방 정비",
  "원료/부자재 대기",
  "생산 종료 (배대 종료)",
  "공통설비 (전력/에어/냉각수)",
  "테스트/시운전",
  "기타",
];

export default function EquipmentClient({ code, initialDate }: { code: string; initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/equipment/${encodeURIComponent(code)}?date=${date}`);
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [date, code]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.readings.map((r) => {
      const t = new Date(r.recordedAt);
      return {
        time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
        current: r.current,
        ts: t.getTime(),
      };
    });
  }, [data]);

  async function updateCause(eventId: number, cause: string, memo: string) {
    await fetch(`/api/event/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cause, memo }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/?date=${date}`}><Button variant="ghost"><ArrowLeft size={14} />대시보드</Button></Link>
          <h1 className="text-xl font-bold">
            {code}
            {data?.equipment && (
              <span className="ml-2 text-xs text-slate-500 font-normal">
                {data.equipment.factory} · {data.equipment.group}
              </span>
            )}
          </h1>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
        />
      </div>

      {loading && (
        <div className="text-slate-500 flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> 로딩 중...
        </div>
      )}

      {data && data.result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardBody>
              <div className="text-xs text-slate-500">가동률</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: data.result.utilization >= 0.8 ? STATUS_COLOR.run : STATUS_COLOR.stop }}>
                {formatPct(data.result.utilization)}
              </div>
              {data.result.excluded && <Badge kind="muted" className="mt-1">제외 설비</Badge>}
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-500">정상 가동</div>
              <div className="text-2xl font-bold tabular-nums text-run">{formatMinutes(data.result.runMinutes)}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-500">비가동 (Idle)</div>
              <div className="text-2xl font-bold tabular-nums text-idle">{formatMinutes(data.result.idleMinutes)}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-500">완전정지 (Stop)</div>
              <div className="text-2xl font-bold tabular-nums text-stop">{formatMinutes(data.result.stopMinutes)}</div>
            </CardBody></Card>
          </div>

          <Card>
            <CardBody>
              <CardTitle extra={<>1분 단위 측정값</>}>전류 추이</CardTitle>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={59} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      labelFormatter={(v) => `시각: ${v}`}
                      formatter={(v: number) => [`${v.toFixed(2)} A`, "전류"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    {data.events.map((ev) => (
                      <ReferenceArea
                        key={ev.id}
                        x1={chartData[ev.startMinute]?.time}
                        x2={chartData[Math.min(ev.endMinute, chartData.length - 1)]?.time}
                        fill={STATUS_COLOR[ev.state]}
                        fillOpacity={0.1}
                      />
                    ))}
                    <Line type="monotone" dataKey="current" stroke="#2563eb" dot={false} strokeWidth={1} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle extra={<>{data.events.length}개 구간</>}>비가동 구간</CardTitle>
              {data.events.length === 0 ? (
                <div className="text-sm text-slate-500 py-6 text-center">비가동 구간이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2">상태</th>
                      <th>시작</th>
                      <th>종료</th>
                      <th className="text-right">지속</th>
                      <th className="text-right">평균 A</th>
                      <th>태그</th>
                      <th>원인</th>
                      <th>메모</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((ev) => (
                      <EventRow key={ev.id} ev={ev} onUpdate={updateCause} />
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {data && !data.result && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm">
          해당 날짜 분석 결과가 없습니다. <Link href="/upload" className="text-brand underline">업로드/분석</Link>을 먼저 실행하세요.
        </div>
      )}
    </div>
  );
}

function EventRow({
  ev,
  onUpdate,
}: {
  ev: ApiData["events"][number];
  onUpdate: (id: number, cause: string, memo: string) => Promise<void>;
}) {
  const [cause, setCause] = useState(ev.cause ?? "");
  const [memo, setMemo] = useState(ev.memo ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = cause !== (ev.cause ?? "") || memo !== (ev.memo ?? "");

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2"><Badge kind={ev.state === "stop" ? "stop" : "idle"}>{STATUS_LABEL[ev.state]}</Badge></td>
      <td className="tabular-nums text-slate-600">{workDayMinuteToClock(ev.startMinute)}</td>
      <td className="tabular-nums text-slate-600">{workDayMinuteToClock(ev.endMinute + 1)}</td>
      <td className="tabular-nums text-right font-semibold">{formatMinutes(ev.duration)}</td>
      <td className="tabular-nums text-right text-slate-600">{ev.avgCurrent.toFixed(2)}</td>
      <td className="text-xs text-slate-500">
        {ev.tags?.map((t, i) => (
          <span key={i} className="inline-block px-1.5 py-0.5 bg-slate-100 rounded mr-1">{t.t}</span>
        ))}
      </td>
      <td>
        <select
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          className="px-1.5 py-1 border border-slate-200 rounded text-xs bg-white w-full"
        >
          <option value="">(미분류)</option>
          {CAUSE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모"
          className="px-1.5 py-1 border border-slate-200 rounded text-xs bg-white w-full"
        />
      </td>
      <td>
        <button
          onClick={async () => {
            setSaving(true);
            await onUpdate(ev.id, cause, memo);
            setSaving(false);
          }}
          disabled={!dirty || saving}
          className="p-1 text-brand hover:text-brand-dark disabled:text-slate-300"
          title="저장"
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
        </button>
      </td>
    </tr>
  );
}
