"use client";

import { useState, useRef } from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, FileJson, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayWorkDate } from "@/lib/utils";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(todayWorkDate());
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "uploading" } | { kind: "analyzing" } | { kind: "done"; data: any } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setStatus({ kind: "uploading" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload/ems", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || "업로드 실패");

      setStatus({ kind: "analyzing" });
      const anRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const anData = await anRes.json();
      if (!anRes.ok) throw new Error(anData.error || "분석 실패");

      setStatus({ kind: "done", data: { ...upData, ...anData } });
    } catch (err: any) {
      setStatus({ kind: "error", message: err.message || String(err) });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <CardTitle>데이터 업로드</CardTitle>
          <p className="text-xs text-slate-500 mb-4">
            EMS 전류 JSON을 업로드하면 서버에 저장된 뒤 자동으로 지정일 분석이 실행됩니다. 파일은 외부로 전송되지 않고 서버에서만 처리됩니다.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-slate-600 font-medium">분석 대상일</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded text-sm"
            />
            <span className="text-xs text-slate-400">07:00 ~ 익일 07:00 범위로 집계됩니다</span>
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className={cn(
              "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition",
              dragOver ? "border-brand bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Upload className="mx-auto mb-2 text-slate-400" size={32} />
            <div className="font-semibold text-slate-700">EMS 전류 JSON · 필수</div>
            <div className="text-xs text-slate-500 mt-1">클릭하거나 파일을 끌어다 놓으세요</div>
          </div>

          {file && (
            <div className="mt-3 flex items-center justify-between bg-slate-100 rounded px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <FileJson size={16} className="text-slate-500" />
                <span className="font-medium">{file.name}</span>
                <span className="text-slate-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="mt-5 flex justify-center">
            <Button onClick={handleUpload} disabled={!file || status.kind === "uploading" || status.kind === "analyzing"}>
              {status.kind === "uploading" && <Loader2 className="animate-spin" size={14} />}
              {status.kind === "analyzing" && <Loader2 className="animate-spin" size={14} />}
              {status.kind === "uploading" ? "업로드 중..." : status.kind === "analyzing" ? "분석 중..." : "업로드 + 분석"}
            </Button>
          </div>

          {status.kind === "done" && (
            <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm">
                <div className="font-semibold text-green-800">분석 완료</div>
                <div className="text-green-700 mt-1">
                  저장된 측정값 {status.data.inserted?.toLocaleString()}건 · 설비 {status.data.analyzedCount}대 분석 · 제외 {status.data.excludedCount}대
                </div>
                {status.data.unknownCodes?.length > 0 && (
                  <div className="text-amber-700 mt-1 text-xs">
                    매칭되지 않은 설비 코드: {status.data.unknownCodes.join(", ")}
                  </div>
                )}
                <a href={`/?date=${date}`} className="inline-block mt-2 text-brand underline">
                  대시보드 보기 →
                </a>
              </div>
            </div>
          )}

          {status.kind === "error" && (
            <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-red-700">{status.message}</div>
            </div>
          )}
        </CardBody>
      </Card>

      <details className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <summary className="font-semibold cursor-pointer text-sm">EMS JSON 데이터 추출 방법 (즐겨찾기 스크립트)</summary>
        <div className="mt-3 text-sm text-slate-700 space-y-3">
          <p>사내 EMS 시스템 화면에서 아래 즐겨찾기(북마크릿)를 실행하면, 분석 기간(07:00 ~ 익일 07:00) 전류 데이터가 JSON으로 자동 저장됩니다.</p>
          <div>
            <h4 className="font-semibold mb-1">1. 즐겨찾기(북마크) 생성</h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>사용 중인 브라우저(Chrome, Edge 등)에서 새 북마크를 생성</li>
              <li>URL 입력 칸에 아래 JavaScript 코드를 그대로 붙여넣고 저장</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">2. EMS 조회 화면에서 실행</h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>EMS 조회 화면에서 분석 기간을 설정</li>
              <li>등록한 즐겨찾기를 클릭하면 JSON 파일이 자동 다운로드됨</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">3. 이 페이지에 업로드</h4>
            <p className="text-xs">다운로드된 JSON 파일을 상단 영역에 드래그 앤 드롭</p>
          </div>
          <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
javascript:(function()&#123; /* TODO: 사내 EMS 환경에 맞춰 북마크 스크립트 삽입 */ alert('즐겨찾기 스크립트 자리입니다.'); &#125;)();
          </pre>
        </div>
      </details>
    </div>
  );
}
