"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

type Criterion = {
  id: number;
  group: string;
  stopThreshold: string;
  idleThreshold: string;
  durationMin: number;
};

type Equipment = {
  id: number;
  code: string;
  factory: string;
  group: string;
  displayOrder: number;
  active: boolean;
};

export default function SettingsClient() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [c, e] = await Promise.all([
      fetch("/api/criteria").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
    ]);
    setCriteria(c.criteria || []);
    setEquipments(e.equipments || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function saveCriterion(c: Criterion) {
    await fetch(`/api/criteria/${encodeURIComponent(c.group)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stopThreshold: Number(c.stopThreshold),
        idleThreshold: Number(c.idleThreshold),
        durationMin: c.durationMin,
      }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">설정</h1>

      <Card>
        <CardBody>
          <CardTitle extra={<>그룹별 전류 임계값 · 수정 후 저장하면 다음 분석부터 반영됩니다</>}>판정 기준</CardTitle>
          {loading ? (
            <div className="text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> 로딩 중...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2">그룹</th>
                  <th>완전정지 (A)</th>
                  <th>비가동 상한 (A)</th>
                  <th>지속 조건 (분)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <CriterionRow key={c.id} initial={c} onSave={saveCriterion} />
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle extra={<>총 {equipments.length}대</>}>설비 마스터</CardTitle>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2">코드</th>
                <th>공장</th>
                <th>그룹</th>
                <th>표시순서</th>
                <th>활성</th>
              </tr>
            </thead>
            <tbody>
              {equipments.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-1.5 font-medium">{e.code}</td>
                  <td>{e.factory}</td>
                  <td className="text-slate-600">{e.group}</td>
                  <td className="tabular-nums text-slate-500 text-xs">{e.displayOrder}</td>
                  <td>{e.active ? "O" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

function CriterionRow({ initial, onSave }: { initial: Criterion; onSave: (c: Criterion) => Promise<void> }) {
  const [stop, setStop] = useState(initial.stopThreshold);
  const [idle, setIdle] = useState(initial.idleThreshold);
  const [dur, setDur] = useState(initial.durationMin);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = stop !== initial.stopThreshold || idle !== initial.idleThreshold || dur !== initial.durationMin;

  async function handle() {
    setSaving(true);
    await onSave({ ...initial, stopThreshold: String(stop), idleThreshold: String(idle), durationMin: dur });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 font-medium">{initial.group}</td>
      <td><input type="number" step="0.1" value={stop} onChange={(e) => setStop(e.target.value)} className="w-24 px-1.5 py-1 border border-slate-200 rounded" /></td>
      <td><input type="number" step="0.1" value={idle} onChange={(e) => setIdle(e.target.value)} className="w-24 px-1.5 py-1 border border-slate-200 rounded" /></td>
      <td><input type="number" value={dur} onChange={(e) => setDur(Number(e.target.value))} className="w-24 px-1.5 py-1 border border-slate-200 rounded" /></td>
      <td>
        <button onClick={handle} disabled={!dirty || saving} className="p-1 text-brand hover:text-brand-dark disabled:text-slate-300" title="저장">
          {saving ? <Loader2 className="animate-spin" size={14} /> : saved ? <CheckCircle2 size={14} className="text-run" /> : <Save size={14} />}
        </button>
      </td>
    </tr>
  );
}
