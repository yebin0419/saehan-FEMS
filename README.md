# saehanFEMS

새한프라텍 공장 설비 비가동 분석 시스템 (Phase 1-4 MVP).
`docs/index.html` 단일 파일 프로토타입을 Next.js 15 풀스택으로 포팅한 결과.

## 구성

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + Recharts
- **Backend**: Next.js Route Handlers
- **DB**: PostgreSQL (원격) + Drizzle ORM
- **엑셀 I/O**: SheetJS (xlsx)

## 디렉토리

```
app/
  layout.tsx                — 공통 레이아웃 + 네비게이션
  page.tsx                  — / 대시보드
  dashboard-client.tsx
  upload/page.tsx           — /upload EMS JSON 업로드
  equipment/[code]/         — /equipment/PET-1?date=... 설비 상세
  settings/                 — /settings 판정 기준 편집
  api/
    upload/ems              — POST: EMS JSON → DB 저장
    analyze                 — POST: 지정일 분석 실행
    dashboard/[date]        — GET: 대시보드 요약 데이터
    events/[date]           — GET: 특정일 비가동 구간 전체
    event/[id]              — PATCH: 구간 원인/메모 수정
    equipment               — GET: 설비 마스터 목록
    equipment/[code]        — GET: 설비 상세 (전류 + 결과 + 구간)
    criteria                — GET: 판정 기준 목록
    criteria/[group]        — PUT: 판정 기준 수정
    export/[date]           — GET: Excel 보고서 (2시트)
lib/
  constants.ts              — 분석 상수 (NOPROD_STOP_MIN, 임계값 등)
  utils.ts                  — formatMinutes, formatPct, workDayMinuteToClock
  master-data.ts            — 설비 37대 + 판정 기준 11그룹 시드 데이터
  db/
    schema.ts               — Drizzle 스키마
    client.ts               — DB 연결 풀
  analysis/
    types.ts
    classify.ts             — 상태 분류 + 구간 탐지 + 태그 (index.html 포팅)
    run.ts                  — DB 조회 → analyze → persist
components/ui/              — Card, Button, Badge
scripts/
  seed.ts                   — 설비·판정기준 시드
  migrate.ts                — ems_analysis_result 컬럼 추가 (최초 1회)
  analyze.ts                — CLI 분석 실행
  inspect.ts                — DB 상태 점검
  prepare-db.ts             — 분석 결과 테이블 리셋
docs/
  index.html                — 베이스라인 단일 HTML 프로토타입
  PRD.md
```

## 실행

### 1. 환경 변수
`.env.local` (이미 작성됨):
```
DATABASE_URL=postgresql://kbsi_app:...@203.255.78.89:15432/saehan?sslmode=require
# 운영 배포 시에만 설정 (설정하면 전체 접근에 Basic Auth 적용)
# 로컬 개발에서는 비워두면 인증 생략
ADMIN_USER=
ADMIN_PASSWORD=
```

### 2. 설치 (최초 1회)
```bash
pnpm install
```

### 3. DB 준비 (최초 1회)
```bash
pnpm tsx scripts/migrate.ts   # ems_analysis_result에 누락 컬럼 추가
pnpm db:seed                  # 설비 37대 + 판정 기준 11그룹 upsert
```

### 4. 개발 서버
```bash
pnpm dev
# http://localhost:3000
```

### 5. CLI로 분석 실행 (선택)
```bash
pnpm tsx scripts/analyze.ts 2026-10-13
```

## 흐름

```
[EMS JSON 추출] ─drag&drop─▶  /upload
                               │
                               ▼
               POST /api/upload/ems  ·  ems_reading 저장
                               │
                               ▼
               POST /api/analyze    ·  분 단위 상태 분류
                                       구간(이벤트) 탐지
                                       ems_analysis_result / ems_downtime_event upsert
                               │
                               ▼
                       /  (대시보드)
                       ├─ 평균 가동율 배너
                       ├─ KPI 3개
                       ├─ 설비별 스택 바
                       └─ TOP 5 비가동 구간
                               │
                               ▼
                      /equipment/[code]
                       ├─ 전류 그래프 (Recharts)
                       ├─ 구간 하이라이트 (ReferenceArea)
                       └─ 원인/메모 인라인 편집 → PATCH /api/event/[id]
                               │
                               ▼
                 GET /api/export/[date] → .xlsx 다운로드
```

## 분석 로직 요약

- **분석 기간**: 지정일 07:00 ~ 익일 07:00 (총 1,440분)
- **상태 분류** (설비 그룹별 임계값):
  - 전류 ≤ `stop_threshold` → `stop`
  - `stop_threshold` < 전류 ≤ `idle_threshold`, 지속 ≥ `duration_min` → `idle`
  - 그 외 → `run`
- **미가동 설비 제외**: 연속 정지 ≥ 1,320분(22h) 또는 정상가동 ≤ 10분
- **구간 태그**: 교대(주/야), 장시간(≥60분), 짧은 비가동(<15분), 하루 시작/끝 정지, 교체 후보(20~240분 정지)

## 현재 데이터 상태

- `ems_reading`: 63,392건 (2026-10-13 ~ 2026-10-14 KST)
- `ems_analysis_result`: 37건 (2026-10-13 분석 완료, 활성 22대 / 제외 15대, 평균 가동율 72.9%)

## 다음 단계 (Phase 5+)

- Vercel 배포 + 사내 인증
- MOLD 생산 실적 업로드 + 생산 손실 추정
- (v2) 비가동 원인 분류 체계화
- (v2) 추세 뷰 (/trends)
- (v2) 알림 (이메일 + 슬랙)

자세한 요구사항은 `docs/PRD.md` 참조.
