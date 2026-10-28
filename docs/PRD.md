# PRD: 새한프라텍 EMS 비가동 분석 시스템 (saehanFEMS)

| 항목 | 내용 |
| --- | --- |
| 문서 버전 | v2 (2026-10-28) |
| 베이스라인 프로토타입 | `./index.html` — 단일 파일, 브라우저 내 분석 |
| 목표 산출물 | Next.js 15 기반 풀스택 웹 서비스 (Vercel 배포) |

> **v2 변경 요약** (베이스라인: `index.html` 단일 HTML 프로토타입 → 서버 기반 풀스택 전환)
> 1. **DB 저장 기반 운영 체계** — 1회성 분석(브라우저)에서 상시 조회·누적 분석으로 전환, 공장·설비 마스터 고정 (§2, §3)
> 2. **비가동 원인 분류 체계화** — 대분류(고장/금형교체/자재대기/계획정지/품질불량 등) + 세부원인, 계획/비계획 구분, 원인별 파레토 분석 (§7, §3.7, §5.5)
> 3. **추세 뷰** — 일간/주간/월간 설비별 가동율 꺾은선 그래프, 전일·전주·전월 대비 증감 화살표 (§10, §5.6)
> 4. **알림/임계치 설정** — 가동율 기준 미달, 완전정지/비가동 장기 지속 시 이메일·슬랙 알림 (§11, §5.7)

---

## 1. 개요

새한프라텍(청주) 공장의 설비 비가동 현황을 실시간으로 분석하고 시각화하는 웹 서비스.
기존 단일 HTML 프로토타입(`./index.html`)을 서버 기반 풀스택 서비스로 전환한다.

### 1.1 베이스라인 (`index.html`) 현황
- EMS JSON · MOLD Excel/CSV 드래그&드롭 업로드
- 브라우저 내 전류값 분류(Run / Down / Stop) 및 시각화 (Chart.js)
- 4개 탭 대시보드: 개요 / 시간대 / 원인 / 주간 요약
- PDF 인쇄, Excel 보고서 다운로드 (SheetJS)
- 설비·공장·교대 필터, 설비별 임계값 수동 조정 모달
- **한계**: 데이터가 세션 로컬에만 존재 → 누적 추세, 알림, 다중 사용자 공유 불가. 설비 마스터·판정 기준이 JSON 파일에 의존.

### 1.2 목표
- EMS 전류 데이터와 MOLD 생산 실적을 DB에 저장하고, 웹 UI에서 조회/분석
- 일일/주간 비가동 현황 대시보드 제공
- 설비별 가동율, 비가동 구간 상세, 생산 손실량 자동 산출
- Excel 보고서 다운로드
- **(v2)** 비가동 원인을 표준 분류로 기록하고, 원인별 손실 시간을 집계해 개선 우선순위 도출
- **(v2)** 일/주/월 단위 가동율 추세를 비교해 개선·악화 설비를 빠르게 파악
- **(v2)** 이상 상황(가동율 급락, 장시간 정지)을 담당자에게 즉시 알림

### 1.3 기술 스택
| 구분 | 선택 |
|------|------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Chart | Recharts |
| Backend | Next.js API Routes (Route Handlers) |
| DB | PostgreSQL (`postgresql://kbsi_app:SMmQhkEIeXivl5P0yrHWW1JhpwCcmWQg@203.255.78.89:15432/saehan?sslmode=require`) |
| ORM | Drizzle ORM |
| 배포 | Vercel |
| 패키지 매니저 | pnpm |
| **(v2)** 스케줄러 | Vercel Cron (알림 평가, 일/주/월 집계) |
| **(v2)** 이메일 | SMTP (nodemailer) 또는 Resend |
| **(v2)** 슬랙 | Slack Incoming Webhook |

### 1.4 보안·운영 원칙
- `index.html`에서 유지한 **"데이터 외부 전송 없음"** 원칙은, 서비스화 이후 **사내 인증된 사용자만 접근**(SSO/비밀번호)으로 대체한다. 업로드된 원본 JSON은 서버 디스크에 저장하지 않고 파싱 후 폐기한다.
- DB 접속 정보, Slack webhook URL, SMTP 자격 증명 등은 **환경변수**로만 관리.

---

## 2. 도메인 모델

### 2.1 설비 마스터 (equipment)

공장 2개, 설비 그룹 기반. 현장 담당자가 확정한 37대 구성을 신규 DB에 시드한다.

| 공장 | 설비 | 그룹 | 수량 |
|------|------|------|------|
| 1공장 | PET-1 ~ PET-18 | PET | 18 |
| 1공장 | PE-1 ~ PE-4 | PE | 4 |
| 1공장 | A-1 | 사출기 | 1 |
| 1공장 | B-1, B-2 | B-1, B-2 | 2 |
| 2공장 | P-1 ~ P-5 | 사출기 | 5 |
| 2공장 | S-1 ~ S-7 | 블로우 성형기(그룹별 상이) | 7 |
| **합계** | | | **37** |

> `index.html`은 설비 목록을 업로드 JSON에서 동적으로 추출한다. 신규 서비스에서는 위 37대를 DB에 고정 등록하고, 업로드 JSON의 설비 ID는 code 매칭으로 식별한다.

### 2.2 판정 기준 (criteria)

설비 그룹별 전류 임계값. `index.html`의 설비별 자동 추정(top 75% × 0.7)을 대체하여 **그룹별 고정값**으로 운영한다.

| 그룹 | 완전정지 (A) | 비가동 상한 (A) | 지속 조건 (분) |
|------|-------------|----------------|---------------|
| PET | 5 | 60 | 5 |
| PE | 5 | 50 | 3 |
| 사출기 | 5 | 50 | 5 |
| B-1 | 5 | 50 | 3 |
| B-2 | 5 | 29 | 3 |
| S-1 | 5 | 40 | 3 |
| S-2 | 5 | 35 | 3 |
| S-3,5 | 5 | 60 | 3 |
| S-4 | 5 | 25 | 3 |
| S-6 | 5 | 50 | 3 |
| S-7 | 10 | 100 | 3 |

### 2.3 분석 상수

| 상수 | 값 | 설명 |
|------|----|------|
| NOPROD_STOP_MIN | 1320 | 연속 정지 이 이상이면 미가동 설비로 제외 (22시간) |
| LONG_MIN | 60 | 장시간 정지 기준 (분) |
| SHORT_MIN | 15 | 짧은 비가동 기준 (분) |
| CHG_MIN / CHG_MAX | 20 / 240 | 품종 교체 후보 구간 (분) |
| ST_GOOD | 0.95 | 가동율 양호 기준 |
| ST_WARN | 0.80 | 가동율 주의 기준 |
| **(v2)** TREND_FLAT_PP | 1.0 | 증감 화살표 "보합" 판정 폭 (±%p) |
| **(v2)** ALERT_COOLDOWN_MIN | 60 | 동일 규칙·동일 설비 재알림 최소 간격 (분, 규칙별 재정의 가능) |

### 2.4 (v2) 가동율 정의

| 지표 | 산식 | 용도 |
|------|------|------|
| 가동율 (기본) | 정상가동분 / 분석 대상 총분 (1,440분) | 기존 대시보드, 알림 |
| 계획정지 제외 가동율 | 정상가동분 / (총분 − 계획정지 분류 분) | 추세 뷰 토글, 실질 성과 비교 |

- 하루 기준은 `index.html`과 동일하게 **07:00 ~ 익일 07:00**.
- 주간/월간 가동율은 일별 가동율의 단순 평균이 아니라 **분 단위 가중 합산** (Σ정상가동분 / Σ대상분)으로 계산한다.
- `NOPROD_STOP_MIN`으로 제외된 미가동 일자는 분모에서 제외하며, 추세 그래프에서는 점 대신 공백(끊긴 선)으로 표시한다.

---

## 3. 데이터베이스 스키마

### 3.1 ems_equipment (설비 마스터)
```sql
CREATE TABLE ems_equipment (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,    -- 'PET-1', 'S-3' 등
  factory VARCHAR(10) NOT NULL,         -- '1공장', '2공장'
  "group" VARCHAR(20) NOT NULL,         -- 'PET', 'PE', '사출기', 'S-3,5' 등
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 ems_criteria (판정 기준)
```sql
CREATE TABLE ems_criteria (
  id SERIAL PRIMARY KEY,
  "group" VARCHAR(20) UNIQUE NOT NULL,
  stop_threshold NUMERIC(6,2) NOT NULL,    -- 완전정지 임계 (A)
  idle_threshold NUMERIC(6,2) NOT NULL,    -- 비가동 상한 (A)
  duration_min INT NOT NULL,               -- 지속 조건 (분)
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 ems_reading (EMS 1분 전류 데이터)
```sql
CREATE TABLE ems_reading (
  id BIGSERIAL PRIMARY KEY,
  equipment_id INT NOT NULL REFERENCES ems_equipment(id),
  recorded_at TIMESTAMPTZ NOT NULL,        -- 1분 단위 시각
  current_value NUMERIC(8,3) NOT NULL,     -- 전류값 (A)
  UNIQUE (equipment_id, recorded_at)
);
CREATE INDEX idx_ems_reading_time ON ems_reading (recorded_at, equipment_id);
```

### 3.4 ems_mold_production (MOLD 생산 실적)
```sql
CREATE TABLE ems_mold_production (
  id BIGSERIAL PRIMARY KEY,
  equipment_id INT NOT NULL REFERENCES ems_equipment(id),
  production_date DATE NOT NULL,
  dept_code VARCHAR(10),                   -- 부서코드 (1211, 1212, 1219)
  order_no VARCHAR(50),                    -- 작업지시번호
  item_name VARCHAR(200),                  -- 품명
  input_qty INT NOT NULL DEFAULT 0,        -- 총투입수
  good_qty INT NOT NULL DEFAULT 0,         -- 양품수
  capa_12hr NUMERIC(10,2) DEFAULT 0,       -- 12시간 CAPA (개)
  UNIQUE (equipment_id, production_date, order_no)
);
```

### 3.5 ems_analysis_result (분석 결과 캐시)
```sql
CREATE TABLE ems_analysis_result (
  id BIGSERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL,             -- 분석 대상일
  factory VARCHAR(10),                     -- NULL이면 전체
  equipment_id INT REFERENCES ems_equipment(id),
  status VARCHAR(10) NOT NULL,             -- 'run', 'idle', 'stop'
  minutes INT NOT NULL,
  run_minutes INT NOT NULL DEFAULT 0,
  idle_minutes INT NOT NULL DEFAULT 0,
  stop_minutes INT NOT NULL DEFAULT 0,
  planned_stop_minutes INT NOT NULL DEFAULT 0,  -- (v2) 계획정지로 분류된 분
  excluded BOOLEAN NOT NULL DEFAULT false,      -- (v2) 미가동 설비로 제외 여부
  utilization_rate NUMERIC(5,4),
  lost_units NUMERIC(10,1),
  result_json JSONB,                       -- 상세 분석 결과 (구간, 태그 등)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (analysis_date, equipment_id)
);
-- (v2) 추세 조회용
CREATE INDEX idx_analysis_equip_date ON ems_analysis_result (equipment_id, analysis_date);
```

> 추세 뷰(§10)는 이 테이블을 원천으로 사용한다. 주간/월간 값은 SQL 집계(`date_trunc`)로 계산하며, 데이터량이 커지면 §3.10 집계 테이블로 전환한다.

### 3.6 ems_downtime_event (비가동 구간)
```sql
CREATE TABLE ems_downtime_event (
  id BIGSERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL,
  equipment_id INT NOT NULL REFERENCES ems_equipment(id),
  state VARCHAR(10) NOT NULL,              -- 'idle' | 'stop'
  start_minute INT NOT NULL,               -- 07:00 기준 경과분
  end_minute INT NOT NULL,
  duration INT NOT NULL,
  avg_current NUMERIC(8,3),
  min_current NUMERIC(8,3),
  max_current NUMERIC(8,3),
  lost_units NUMERIC(10,1),
  tags JSONB,                              -- [{k, t, h}]
  cause VARCHAR(50),                       -- (deprecated) 자유 텍스트 원인 기록, 호환용
  cause_code VARCHAR(20) REFERENCES ems_downtime_cause(code),  -- (v2) 표준 원인 코드
  cause_source VARCHAR(10),                -- (v2) 'manual' | 'suggested' | 'bulk'
  suggested_cause_code VARCHAR(20),        -- (v2) 태그 기반 자동 추천 원인
  classified_by VARCHAR(50),               -- (v2) 분류 입력자
  classified_at TIMESTAMPTZ,               -- (v2) 분류 시각
  memo TEXT,                               -- 수기 메모
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_event_cause ON ems_downtime_event (cause_code, analysis_date);
```

> `index.html`에는 원인 분류 기능이 없으므로 **마이그레이션 대상 데이터는 없다**. v2에서는 처음부터 `cause_code` 중심으로 운영한다. `cause` 자유 텍스트 컬럼은 추후 유지보수 중 임시 메모용으로만 사용.

### 3.7 (v2) ems_downtime_cause (비가동 원인 마스터)
```sql
CREATE TABLE ems_downtime_cause (
  code VARCHAR(20) PRIMARY KEY,            -- 'BRK_MECH', 'MOLD_CHG' 등
  category VARCHAR(20) NOT NULL,           -- 대분류 코드 'BREAKDOWN', 'MOLD' ...
  category_name VARCHAR(30) NOT NULL,      -- '고장', '금형교체' ...
  name VARCHAR(50) NOT NULL,               -- 세부 원인명
  is_planned BOOLEAN NOT NULL DEFAULT false, -- 계획정지 여부 (가동율 분모 제외 대상)
  color VARCHAR(7) NOT NULL,               -- 차트 색상 (#RRGGBB)
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
```

### 3.8 (v2) ems_alert_rule (알림 규칙)
```sql
CREATE TABLE ems_alert_rule (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(30) NOT NULL,          -- 'UTIL_BELOW' | 'STOP_DURATION' | 'IDLE_DURATION' | 'UTIL_DROP'
  scope_type VARCHAR(10) NOT NULL,         -- 'all' | 'factory' | 'group' | 'equipment'
  scope_value VARCHAR(50),                 -- '1공장', 'PET', 'PET-3' 등 (all이면 NULL)
  threshold NUMERIC(8,3) NOT NULL,         -- 가동율(0~1) 또는 지속시간(분) 또는 하락폭(%p)
  period VARCHAR(10),                      -- UTIL_* 전용: 'day' | 'week' | 'rolling_2h' 등
  severity VARCHAR(10) NOT NULL DEFAULT 'warning',  -- 'info' | 'warning' | 'critical'
  cooldown_min INT NOT NULL DEFAULT 60,
  quiet_start TIME,                        -- 방해금지 시작 (critical은 무시)
  quiet_end TIME,
  exclude_planned BOOLEAN NOT NULL DEFAULT true, -- 계획정지로 분류된 구간은 알림 제외
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.9 (v2) ems_alert_channel / ems_alert_rule_channel / ems_alert_log
```sql
-- 수신 채널 (사람/채널 단위)
CREATE TABLE ems_alert_channel (
  id SERIAL PRIMARY KEY,
  channel_type VARCHAR(10) NOT NULL,       -- 'email' | 'slack'
  name VARCHAR(50) NOT NULL,               -- '생산팀장', '#설비알림' 등
  target VARCHAR(255) NOT NULL,            -- 이메일 주소 / Slack webhook URL
  active BOOLEAN NOT NULL DEFAULT true,
  verified_at TIMESTAMPTZ,                 -- 테스트 발송 성공 시각
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 규칙 ↔ 채널 N:M
CREATE TABLE ems_alert_rule_channel (
  rule_id INT NOT NULL REFERENCES ems_alert_rule(id) ON DELETE CASCADE,
  channel_id INT NOT NULL REFERENCES ems_alert_channel(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, channel_id)
);

-- 발생/발송 이력
CREATE TABLE ems_alert_log (
  id BIGSERIAL PRIMARY KEY,
  rule_id INT NOT NULL REFERENCES ems_alert_rule(id),
  equipment_id INT REFERENCES ems_equipment(id),
  event_id BIGINT REFERENCES ems_downtime_event(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed_value NUMERIC(8,3),             -- 실제 가동율 / 지속분
  message TEXT NOT NULL,
  dedup_key VARCHAR(100) NOT NULL,         -- rule_id:equipment_id:기간키
  delivery JSONB,                          -- [{channel_id, status:'sent'|'failed', error, sent_at}]
  acknowledged_by VARCHAR(50),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ                  -- 상태 복구 시각 (복구 알림 발송 기준)
);
CREATE INDEX idx_alert_log_dedup ON ems_alert_log (dedup_key, triggered_at DESC);
```

> Slack webhook URL, SMTP 비밀번호 등 비밀값은 DB가 아닌 **환경변수**(`SLACK_DEFAULT_WEBHOOK`, `SMTP_*`)에 두고, 채널별 webhook URL은 DB 저장 시 암호화한다.

### 3.10 (v2, 선택) ems_utilization_daily (추세용 집계)
```sql
CREATE TABLE ems_utilization_daily (
  analysis_date DATE NOT NULL,
  equipment_id INT NOT NULL REFERENCES ems_equipment(id),
  target_minutes INT NOT NULL,
  run_minutes INT NOT NULL,
  idle_minutes INT NOT NULL,
  stop_minutes INT NOT NULL,
  planned_stop_minutes INT NOT NULL,
  PRIMARY KEY (analysis_date, equipment_id)
);
```
분석 실행 시 upsert. 1년치 기준 약 13,500행으로, 초기에는 §3.5에서 직접 집계해도 충분하다.

---

## 4. API 설계

### 4.1 데이터 업로드
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/upload/ems` | EMS JSON 파일 업로드 → DB 저장 → **(v2) 분석 후 알림 평가 트리거** |
| POST | `/api/upload/mold` | MOLD .xls 파일 업로드 → 파싱 후 DB 저장 |

> `index.html`의 즐겨찾기(북마크릿) 추출 스크립트는 그대로 재사용하며, 결과 JSON을 이 엔드포인트에 업로드한다.

### 4.2 분석
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 지정일 분석 실행 (1분 전류 → 상태 분류 → 구간 탐지 → 원인 추천 → 결과 저장) |
| GET | `/api/analyze/:date` | 분석 결과 조회 (`?factory=1공장`) |

### 4.3 조회
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/equipment` | 설비 목록 |
| GET | `/api/criteria` | 판정 기준 목록 |
| PUT | `/api/criteria/:group` | 판정 기준 수정 |
| GET | `/api/dashboard/:date` | 대시보드 데이터 (전체 요약 + 설비별 가동율 + **(v2) 전일 대비 증감**) |
| GET | `/api/events/:date` | 비가동 구간 목록 (`?equipment=PET-1&cause=unclassified`) |
| PATCH | `/api/events/:id` | 비가동 구간에 원인 코드/메모 기록 |
| GET | `/api/export/:date` | Excel 보고서 다운로드 |

### 4.4 (v2) 비가동 원인
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/causes` | 원인 마스터 목록 (대분류별 그룹) |
| POST | `/api/causes` | 세부 원인 추가 |
| PUT | `/api/causes/:code` | 원인 수정 (이름/색상/계획정지 여부/비활성화) |
| PATCH | `/api/events/bulk` | 여러 구간 일괄 분류 `{ids:[], cause_code, memo?}` |
| POST | `/api/events/:id/accept-suggestion` | 자동 추천 원인 확정 |
| GET | `/api/causes/pareto` | 원인별 손실 집계 `?from&to&factory&equipment&level=category\|cause` |

### 4.5 (v2) 추세
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/trends/utilization` | `?granularity=day\|week\|month&from&to&equipment=PET-1,PET-2&factory&excludePlanned=true` → 설비별 시계열 + 직전 기간 대비 증감 |
| GET | `/api/trends/compare` | `?date=YYYY-MM-DD&basis=dod\|wow\|mom` → 전 설비 현재값/비교값/증감(%p)/방향 |

응답 예시 (`/api/trends/utilization`):
```json
{
  "granularity": "week",
  "series": [
    {
      "equipment": "PET-1",
      "points": [
        { "period": "2026-W42", "start": "2026-10-12", "utilization": 0.912, "runMin": 9190, "targetMin": 10080 },
        { "period": "2026-W43", "start": "2026-10-19", "utilization": 0.874, "runMin": 8810, "targetMin": 10080 }
      ],
      "latestDelta": { "pp": -3.8, "direction": "down" }
    }
  ]
}
```

### 4.6 (v2) 알림
| Method | Path | 설명 |
|--------|------|------|
| GET / POST | `/api/alerts/rules` | 규칙 목록 / 생성 |
| PUT / DELETE | `/api/alerts/rules/:id` | 규칙 수정 / 삭제 |
| GET / POST | `/api/alerts/channels` | 수신 채널 목록 / 등록 |
| PUT / DELETE | `/api/alerts/channels/:id` | 채널 수정 / 삭제 |
| POST | `/api/alerts/channels/:id/test` | 테스트 메시지 발송 → 성공 시 `verified_at` 기록 |
| POST | `/api/alerts/evaluate` | 알림 평가 실행 (Cron 및 분석 완료 후 호출, `CRON_SECRET` 검증) |
| GET | `/api/alerts/log` | 알림 이력 `?from&to&status=open\|acked\|resolved` |
| POST | `/api/alerts/log/:id/ack` | 알림 확인 처리 |

---

## 5. 페이지 구성

### 5.1 `/` — 대시보드 (한눈에 보기)
`index.html` "개요" 탭을 서버 데이터 기반으로 재구현. 가동률 요약 중심 뷰.

- **날짜 선택**: 기본값 = 가장 최근 분석일
- **공장 필터**: 전체 / 1공장 / 2공장
- **상단 KPI 카드 (3개)**:
  - 비가동 + 완전정지 (시간)
  - 못 만든 수량 (추정, 개)
  - 점검 필요 설비 (대)
  - **(v2)** 각 카드에 전일 대비 증감 화살표 표시
- **평균 가동율 배너**: 큰 숫자 + 상태 뱃지 (양호/주의/점검) + 요약 문장 + **(v2) 전일·전주 대비 증감 화살표**
- **설비별 가동 구성**: 가동율 낮은 순 정렬, 스택 바 (정상/비가동/정지)
  - **(v2)** 가동율 숫자 옆에 전일 대비 화살표, 알림 임계치 미달 설비는 🔔 아이콘 + 빨간 테두리
- **먼저 확인할 구간 TOP 5**: 가장 길게 멈춘 순, 상태 뱃지 + 태그 + **(v2) 원인 뱃지(미분류 시 "미분류")**
- **(v2) 원인 분류 현황 미니 카드**: 분류율(%) + 상위 3개 원인 시간
- **(v2) 미확인 알림 배지**: 헤더 우측, 클릭 시 알림 이력으로 이동
- **전력 추가 사용분**: (MOLD 있을 때) 비생산 가동 설비 테이블

### 5.2 `/equipment/:code` — 설비 상세
- 선택한 설비의 일일 전류 그래프 (1분 단위)
- 상태 타임라인 (정상가동/비가동/완전정지 색상 구분)
  - **(v2)** 원인 분류된 구간은 원인 색상으로 오버레이
- 비가동 구간 목록 + 원인 기록 입력
  - **(v2)** 대분류 → 세부원인 2단 선택, 자동 추천 원인은 회색 칩으로 표시 후 원클릭 확정
  - **(v2)** 체크박스 다중 선택 → 일괄 분류
- **(v2)** 최근 30일 가동율 미니 꺾은선 (스파크라인) + 전일/전주 대비 증감
- 생산 실적 (MOLD 데이터)

### 5.3 `/upload` — 데이터 업로드
- EMS JSON 파일 드래그앤드롭 업로드 (`index.html`의 업로드 UI 디자인 재사용)
- MOLD .xls 파일 복수 업로드
- 업로드 후 자동 분석 실행 → **(v2) 알림 평가 자동 실행**
- 업로드 이력 목록
- 하단에 즐겨찾기(북마크릿) 추출 스크립트 안내 (3단계 매뉴얼) 그대로 유지

### 5.4 `/settings` — 설정
- 판정 기준(임계값) 편집 UI (`index.html`의 임계값 모달을 영구 설정으로 승격)
- 설비 마스터 관리
- **(v2)** 탭 구성: `판정 기준 | 설비 | 비가동 원인 | 알림 규칙 | 수신 채널`

### 5.5 (v2) `/causes` — 비가동 원인 분석
- **기간/공장/설비 필터** (기본: 최근 7일)
- **파레토 차트**: 원인 대분류별 손실 시간 막대(내림차순) + 누적 비율 꺾은선
- **드릴다운**: 대분류 클릭 → 세부원인 파레토 → 해당 구간 목록
- **설비 × 원인 히트맵**: 행=설비, 열=대분류, 셀=손실 시간
- **분류율 KPI**: 전체 비가동 시간 중 원인 기록된 비율 (목표 90% 이상)
- **미분류 구간 작업함**: 미분류 구간을 오래된 순으로 나열, 인라인 분류

### 5.6 (v2) `/trends` — 추세 뷰
§10 참조.

### 5.7 (v2) `/alerts` — 알림 이력
- 발생 시각, 설비, 규칙명, 관측값, 심각도, 발송 결과(채널별 성공/실패), 확인자
- 필터: 미확인 / 확인됨 / 복구됨, 심각도, 기간
- 행 클릭 → 해당 설비 상세 (해당 구간 하이라이트)
- "확인" 버튼으로 ack 처리

---

## 6. 분석 엔진 (서버사이드)

`index.html`의 클라이언트 JS 로직(`analyze()`, `classify()`, `workDayMinuteOffset()`)을 서버사이드 TypeScript로 이식한다.

### 6.1 상태 분류 (`classify`)
```
1분 전류 배열 → 각 분 상태 (정상가동 / 비가동 / 완전정지) 판정
- v <= stop_threshold → 완전정지
- stop_threshold < v <= idle_threshold 이고 지속 >= duration_min → 비가동
- 그 외 → 정상가동
- 정상가동 10분 이하 → 종일 정지 처리
```

> `index.html`은 Run/Down/Stop 3단 분류를 사용한다. 신규 시스템에서는 명칭을 **정상가동 / 비가동(idle) / 완전정지(stop)** 로 통일한다.

### 6.2 구간(이벤트) 탐지
- 연속 같은 상태 구간을 하나의 이벤트로 묶음
- 태그 자동 부여: 교대 시간대, 장시간 정지, 짧은 비가동 반복, 하루 시작/끝 정지, 교체 후보

### 6.3 생산 손실 추정
- 분당 CAPA = CAPA'(12HR) / 720
- 못 만든 수량 = (비가동분 + 정지분) × 분당 CAPA
- 속도 차질 = 이론생산수 - 총투입수
- 불량 = 총투입수 - 양품수

### 6.4 비생산 가동 탐지
- EMS에 가동 흔적이 있으나 MOLD 생산 실적이 없는 설비
- 전력량 추정: sqrt(3) × V × A × 역률 × 시간

### 6.5 (v2) 원인 자동 추천
구간 탐지 직후 태그 기반으로 `suggested_cause_code`를 채운다. **추천은 확정이 아니며** 현장 확인 후 확정해야 집계에 "분류됨"으로 반영된다.

| 조건 | 추천 원인 |
|------|----------|
| 태그 `교체 후보` (20~240분 정지) | 금형교체 > 금형 교체(품종 변경) |
| 태그 `하루 끝 정지` + MOLD 당일 실적 종료 | 계획정지 > 생산 종료 |
| 태그 `하루 시작 정지` | 계획정지 > 가동 준비/예열 |
| 같은 시각 동일 공장 설비 ≥ 50% 동시 정지 | 공통설비 > 전력/에어/냉각수 |
| 태그 `짧은 비가동 반복` | 고장 > 순간 정지(쇼트 스톱) |
| MOLD 불량률(1 − 양품/투입) ≥ 5% 이고 비가동 구간 존재 | 품질불량 > 품질 이상 조정 |

### 6.6 (v2) 분석 후처리 순서
```
분석 완료 → ems_analysis_result / ems_downtime_event 저장
         → 원인 자동 추천 (§6.5)
         → 일 집계 upsert (§3.10, 사용 시)
         → 알림 평가 (§11.3)
```

---

## 7. 비가동 원인 분류 (v2 신설)

현장 기록용 (Excel 드롭다운 및 웹 UI). `index.html`에는 원인 분류 기능이 없으므로, v2에서 처음부터 **대분류 9종 + 세부원인** 2단 구조로 도입한다.

### 7.1 원인 체계

| 대분류 (category) | 계획 여부 | 세부 원인 (code: 이름) | 색상 |
|------------------|----------|----------------------|------|
| **고장** BREAKDOWN | 비계획 | BRK_MECH: 기계 고장 · BRK_ELEC: 전기/제어 고장 · BRK_HYD: 유압/공압 고장 · BRK_HEAT: 히터/온도 이상 · BRK_SHORT: 순간 정지(쇼트 스톱) | #E5484D |
| **금형교체** MOLD | 비계획* | MOLD_CHG: 금형 교체(품종 변경) · MOLD_REPAIR: 금형 수리/청소 · MOLD_ADJ: 금형 조정 | #F76B15 |
| **자재대기** MATERIAL | 비계획 | MAT_RESIN: 원료(레진) 대기 · MAT_SUB: 부자재 대기 · MAT_DRY: 원료 건조 대기 | #FFC53D |
| **계획정지** PLANNED | **계획** | PLN_PM: 정기/예방 정비 · PLN_END: 생산 종료(배대 종료) · PLN_NOORDER: 작업지시 없음 · PLN_BREAK: 휴식/교대 · PLN_PREP: 가동 준비/예열 | #8D8D8D |
| **품질불량** QUALITY | 비계획 | QLT_ADJ: 품질 이상 조정 · QLT_INSPECT: 검사 대기/보류 · QLT_REWORK: 불량 원인 조치 | #8E4EC6 |
| **품종/지시 교체** CHANGEOVER | 비계획* | CHG_ORDER: 작업지시 교체 · CHG_COLOR: 색상/원료 교체 | #0090FF |
| **공통설비** UTILITY | 비계획 | UTL_POWER: 전력 · UTL_AIR: 에어 · UTL_WATER: 냉각수 | #12A594 |
| **테스트/시운전** TEST | 계획 | TST_TRIAL: 신규 금형 시사출 · TST_RUN: 수리 후 시운전 | #3E63DD |
| **기타** ETC | 비계획 | ETC: 기타(메모 필수) | #B0B0B0 |

\* 금형교체·품종교체는 생산계획에 포함된 경우가 많으나, **단축 대상(SMED)** 으로 관리하기 위해 기본값은 비계획으로 두고 설정에서 변경 가능.

**규칙**
- `ETC` 선택 시 메모 필수.
- `is_planned = true` 원인은 "계획정지 제외 가동율"의 분모에서 제외되고, 알림 규칙의 `exclude_planned` 대상이 된다.
- 원인 마스터는 `/settings` > 비가동 원인 탭에서 추가/수정/비활성화 가능 (삭제 불가 — 과거 기록 보존).

### 7.2 집계 지표
- **원인별 손실 시간** = Σ duration (원인 코드별)
- **원인별 손실 수량** = Σ lost_units
- **발생 빈도** = 구간 수, **평균 지속시간** = 손실 시간 / 빈도
- **MTBF (고장)** = 정상가동 시간 / 고장 대분류 발생 건수
- **MTTR (고장)** = 고장 대분류 손실 시간 / 발생 건수
- **분류율** = 분류된 구간 시간 / 전체 비가동+정지 시간

---

## 8. Excel 보고서

`index.html`의 `#excel-btn` SheetJS 로직을 서버사이드로 이식·확장한다. 현재 프로토타입은 4개 시트(요약/설비별/시간대별/교대별)를 생성하며, v2에서 아래 시트를 추가·확장한다.

### 시트 구성:
1. **설비별_일요약**: 설비별 가동/비가동/정지 시간, MOLD 생산 실적, 기준CAPA 대비 차질, 수율, **(v2) 전일 대비 증감**
2. **비가동_구간상세**: 모든 비가동/정지 구간의 시각, 지속시간, 전류값, 태그, **(v2) 원인 대분류 / 세부원인 / 추천원인 / 입력자**
3. **전력추가사용_비생산가동**: 생산 실적 없이 가동한 설비의 전력 소비 내역
4. **(v2) 원인별_집계**: 대분류·세부원인별 손실 시간, 빈도, 손실 수량, 누적 비율
5. **(v2) 가동율_추세**: (주간/월간 보고서 선택 시) 설비 × 기간 가동율 피벗 + 증감

**(v2) 보고서 범위 옵션**: `GET /api/export?from&to&type=daily|weekly|monthly`

---

## 9. 마일스톤

> 베이스라인 상태: `./index.html` 단일 파일 프로토타입 완료 (브라우저 내 분석 · PDF/Excel 출력 가능)

### Phase 1: 기반 구축
- [ ] 프로젝트 생성 (Next.js 15 + TypeScript + Tailwind + shadcn/ui)
- [ ] DB 스키마 생성 (Drizzle ORM 마이그레이션) — 6개 테이블
- [ ] 설비 마스터 37대 + 판정 기준 11개 그룹 시드
- [ ] EMS JSON 업로드 API + DB 저장
- [ ] 업로드 페이지 UI (드래그앤드롭) — `index.html`의 업로드 UI 디자인 재사용
- [ ] 네비게이션 + 레이아웃

### Phase 2: 분석 엔진 이식
- [ ] 상태 분류 엔진 (classify) — `index.html`의 Run/Down/Stop 로직을 정상가동/비가동/완전정지로 재명명하여 TS 포트
- [ ] 구간 탐지 + 태그 부여 (교대, 장시간, 반복, 교체 후보 등)
- [ ] 분석 API (`POST /api/analyze`)
- [ ] 대시보드 API (`GET /api/dashboard/:date`) — 요약 + 설비별 + TOP5 이벤트
- [ ] 비가동 구간 API (`GET /api/events/:date`)
- [ ] 생산 손실 추정 (MOLD 연동 시 활성화)

### Phase 3: 대시보드 UI
- [ ] 대시보드 페이지 — 날짜 선택 + 공장 필터 + 분석 실행 버튼
- [ ] 평균 가동율 배너 (verdict) — 상태 뱃지(양호/주의/점검) + 요약 문장
- [ ] KPI 카드 3개 (비가동+정지 시간, 못만든수량, 점검필요 설비)
- [ ] 설비별 가동 구성 스택바 — 가동율 낮은 순, 2단 레이아웃
- [ ] TOP 5 비가동 구간 테이블 — 상태 뱃지 + 태그

### Phase 4: 상세 기능
- [ ] 설비 상세 페이지 (`/equipment/:code`) — 전류 차트(Recharts) + 가동 KPI + 구간 목록
- [ ] 비가동 원인 기록 (PATCH `/api/events/:id`) — 자유 텍스트 (Phase 6에서 코드 체계로 교체)
- [ ] Excel 보고서 다운로드 (`GET /api/export/:date`) — 2시트 (일요약 + 구간상세)
- [ ] 설정 페이지 (`/settings`) — 판정 기준 인라인 편집
- [ ] 대시보드에서 설비 클릭 → 상세 페이지 링크
- [ ] 대시보드 엑셀 다운로드 버튼

### Phase 5: 운영
- [ ] Vercel 배포
- [ ] MOLD 업로드 + 파싱 → 생산 손실 추정 활성화
- [ ] 반응형 레이아웃 최적화
- [ ] `index.html` → 신규 서비스 전환 안내 (베이스라인 종료)

### Phase 6 (v2): 비가동 원인 분류
- [ ] `ems_downtime_cause` 테이블 생성 + 9개 대분류 / 세부원인 시드
- [ ] `ems_downtime_event`에 `cause_code` / `suggested_cause_code` 등 v2 컬럼 추가
- [ ] 원인 자동 추천 로직 (§6.5)
- [ ] 설비 상세: 2단 원인 선택 + 추천 확정 + 일괄 분류
- [ ] `/causes` 파레토 / 히트맵 / 미분류 작업함
- [ ] 설정: 원인 마스터 관리 탭
- [ ] Excel `원인별_집계` 시트

### Phase 7 (v2): 추세 뷰
- [ ] `/api/trends/utilization`, `/api/trends/compare` (분 가중 집계, 계획정지 제외 옵션)
- [ ] `/trends` 페이지: 기간 단위 토글, 설비 다중 선택 꺾은선, 기준선
- [ ] 증감 화살표 컴포넌트 (`<DeltaArrow pp={...} />`) 공통화
- [ ] 대시보드 / 설비 상세에 증감 화살표 + 스파크라인 적용
- [ ] Excel `가동율_추세` 시트 + 주간/월간 보고서

### Phase 8 (v2): 알림/임계치
- [ ] 알림 테이블 4종 생성
- [ ] 채널 어댑터: 이메일 → 슬랙 순
- [ ] 알림 평가 엔진 + 중복 억제/쿨다운/방해금지
- [ ] Vercel Cron 등록 (`/api/alerts/evaluate`, 5분 주기)
- [ ] 설정: 알림 규칙 / 수신 채널 탭 + 테스트 발송
- [ ] `/alerts` 이력 페이지 + 헤더 미확인 배지
- [ ] 기본 규칙 시드 (§11.2)

---

## 10. (v2) 추세 뷰 상세

### 10.1 화면 구성 (`/trends`)

```
┌────────────────────────────────────────────────────────────────┐
│ [일간|주간|월간]  기간: 2026-08-01 ~ 2026-10-26   공장: [전체▼]  │
│ 설비: [PET-1 ×][PET-3 ×][S-2 ×][+ 추가]  □ 계획정지 제외        │
├────────────────────────────────────────────────────────────────┤
│ 100%┤                                                          │
│  95%┤- - - - - - - - - - - - - - - - - - - - - (양호 기준) - - │
│  80%┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (주의 기준) ─ ─ │
│     │   ●───●───●╲      ╱●───●         PET-1                    │
│     │             ●───●                PET-3                    │
│     └──W32──W33──W34──W35──W36──W37──W38──...                   │
├────────────────────────────────────────────────────────────────┤
│ 설비   │ 이번 주 │ 지난 주 │ 증감     │ 4주 평균 │ 추세(스파크)  │
│ PET-1  │ 91.2%  │ 87.4%  │ ▲ 3.8%p │ 89.0%   │ ﹏﹏╱        │
│ PET-3  │ 78.5%  │ 85.1%  │ ▼ 6.6%p │ 84.2%   │ ﹏╲﹏        │
│ S-2    │ 93.0%  │ 92.6%  │ ▬ 0.4%p │ 92.8%   │ ﹏﹏﹏        │
└────────────────────────────────────────────────────────────────┘
```

### 10.2 기간 단위

| 단위 | 버킷 | 기본 조회 범위 | 비교 기준 (증감) |
|------|------|---------------|-----------------|
| 일간 | 07:00 ~ 익일 07:00 | 최근 30일 | 전일 대비 (DoD) |
| 주간 | 월 07:00 ~ 다음 월 07:00 (ISO 주차) | 최근 12주 | 전주 대비 (WoW) |
| 월간 | 1일 07:00 ~ 다음 달 1일 07:00 | 최근 12개월 | 전월 대비 (MoM) |

- 진행 중인 기간(이번 주/이번 달)은 점선 마커로 표시하고 툴팁에 "집계 중 (n일)" 표기.
- 비교 시에는 **동일 경과일수** 기준으로 비교 옵션 제공 (예: 이번 주 월~수 vs 지난 주 월~수).

### 10.3 꺾은선 그래프
- Recharts `LineChart`, 설비당 1개 선 (최대 8개 선택, 초과 시 경고).
- Y축 0~100%, 기준선: `ST_GOOD`(95%, 초록 점선), `ST_WARN`(80%, 주황 점선), 사용자 알림 임계치(빨강 점선, 해당 설비 규칙이 있을 때).
- 툴팁: 기간, 가동율, 정상가동/비가동/정지 시간, 상위 원인 1개.
- 데이터 포인트 클릭 → 해당 일자 설비 상세(일간) 또는 해당 기간 원인 파레토(주/월간)로 이동.
- 프리셋: "공장 평균", "그룹 평균(PET/PE/사출기/S)", "가동율 하위 5대".

### 10.4 증감 화살표 규칙

| 조건 (증감 = 현재 − 비교, %p) | 표시 | 색상 |
|------------------------------|------|------|
| 증감 > +TREND_FLAT_PP | ▲ +x.x%p | 초록 |
| 증감 < −TREND_FLAT_PP | ▼ −x.x%p | 빨강 |
| \|증감\| ≤ TREND_FLAT_PP | ▬ x.x%p | 회색 |
| 비교 기간 데이터 없음 / 제외 | – | 회색 |

- 비가동 시간, 손실 수량처럼 **낮을수록 좋은 지표**는 색상을 반대로 적용 (증가=빨강).
- 색상 외에 아이콘 모양으로도 구분 (색각 이상 대응).
- 공통 컴포넌트 `<DeltaArrow value={pp} inverse={boolean} />` 로 대시보드·상세·추세·Excel에서 동일 규칙 사용.

### 10.5 집계 SQL (참고)
```sql
SELECT e.code,
       date_trunc('week', r.analysis_date)::date AS period_start,
       SUM(r.run_minutes)::numeric
         / NULLIF(SUM(r.minutes - CASE WHEN :excludePlanned THEN r.planned_stop_minutes ELSE 0 END), 0)
         AS utilization
FROM ems_analysis_result r
JOIN ems_equipment e ON e.id = r.equipment_id
WHERE r.analysis_date BETWEEN :from AND :to
  AND r.excluded = false
  AND e.code = ANY(:codes)
GROUP BY e.code, period_start
ORDER BY e.code, period_start;
```

---

## 11. (v2) 알림 / 임계치 설정 상세

### 11.1 규칙 유형

| rule_type | 설명 | threshold 단위 | 판정 시점 |
|-----------|------|---------------|----------|
| `UTIL_BELOW` | 기간 가동율이 기준 미만 | 비율 (예: 0.80) | 일 분석 완료 시 / 주간은 월요일 07:30 |
| `STOP_DURATION` | 완전정지가 N분 이상 연속 지속 | 분 (예: 30) | 구간 탐지 시 (실시간 수집 시 5분 주기) |
| `IDLE_DURATION` | 비가동(공회전)이 N분 이상 연속 지속 | 분 | 상동 |
| `UTIL_DROP` | 전일(전주) 대비 가동율이 N%p 이상 하락 | %p (예: 10) | 일 분석 완료 시 |

- **적용 범위**: 전체 / 공장 / 설비 그룹 / 개별 설비. 범위가 겹치면 **가장 구체적인 규칙**(설비 > 그룹 > 공장 > 전체)만 적용.
- **미가동 제외 설비**(`excluded = true`)는 `UTIL_*` 평가 대상에서 제외.
- `exclude_planned = true`이면 계획정지로 **분류 확정된** 구간은 지속 시간 알림에서 제외 (분류 전에는 알림 발생).

### 11.2 기본 규칙 (시드)

| 이름 | 유형 | 범위 | 임계치 | 심각도 | 채널 |
|------|------|------|--------|--------|------|
| 일 가동율 주의 | UTIL_BELOW / day | 전체 | 80% | warning | 슬랙 |
| 일 가동율 위험 | UTIL_BELOW / day | 전체 | 60% | critical | 슬랙 + 이메일 |
| 장시간 완전정지 | STOP_DURATION | 전체 | 60분 | critical | 슬랙 + 이메일 |
| 장시간 공회전 | IDLE_DURATION | 전체 | 30분 | warning | 슬랙 |
| 가동율 급락 | UTIL_DROP / day | 전체 | 15%p | warning | 이메일 |
| 주간 가동율 리포트 기준 | UTIL_BELOW / week | 전체 | 85% | info | 이메일 |

### 11.3 평가 엔진

```
evaluateAlerts(trigger: 'analysis' | 'cron', date?)
  1. 활성 규칙 로드 → 설비별 적용 규칙 결정 (구체성 우선)
  2. 규칙 유형별 관측값 계산
     - UTIL_*      : ems_analysis_result 기준
     - *_DURATION  : ems_downtime_event (분석 결과) 또는 최근 ems_reading 꼬리 구간 (실시간)
  3. 조건 충족 시 dedup_key 생성
     - UTIL_BELOW/DROP : rule:equip:YYYY-MM-DD (또는 주차)
     - *_DURATION      : rule:equip:event_start_ts
  4. 같은 dedup_key가 이미 있으면 skip
     같은 rule+equip의 마지막 발송이 cooldown_min 이내면 skip
  5. 방해금지 시간대 && severity != critical → 보류 후 해제 시각에 묶음 발송
  6. 채널별 발송 (병렬, 실패 시 지수 백오프 3회 재시도) → ems_alert_log 기록
  7. 이전 open 알림 중 상태가 정상 복구된 건 → resolved_at 기록 + 복구 알림(선택)
```

**데이터 수집 방식에 따른 동작**
- **현재(배치 업로드)**: EMS JSON 업로드 → 분석 완료 시 평가. "N분 이상 지속" 알림은 업로드 시점에 사후 탐지된다 (메시지에 "사후 탐지" 표기).
- **향후(실시간 수집)**: EMS가 주기적으로 `ems_reading`에 적재되면 Vercel Cron 5분 주기로 각 설비의 **현재 진행 중인 정지 구간 길이**를 계산해 평가. 이 경우 진정한 실시간 알림이 된다.

### 11.4 채널별 구현

| 채널 | 방식 | 필요 설정 | 비고 |
|------|------|----------|------|
| 이메일 | SMTP(nodemailer) 또는 Resend API | `SMTP_HOST/PORT/USER/PASS`, 발신 주소 | HTML 템플릿, 주간 리포트 첨부(Excel) 가능 |
| 슬랙 | Incoming Webhook | 채널별 webhook URL | Block Kit 메시지, "설비 상세 보기" 버튼 링크 |

> **향후 확장**: 모바일 즉시 알림이 필요하다면 카카오 알림톡 / Teams / Telegram 등을 채널 어댑터로 추가할 수 있도록 `channel_type` enum 설계만 유지한다.

**슬랙 메시지 예시**
```
🔴 [CRITICAL] PET-3 완전정지 72분 지속
• 공장: 1공장 / 그룹: PET
• 시작: 2026-10-27 09:14  (진행 중)
• 오늘 가동율: 71.4%  (전일 대비 ▼ 12.3%p)
[설비 상세 보기]  [알림 확인]
```

### 11.5 설정 UI (`/settings` > 알림 규칙 / 수신 채널)
- **규칙 목록**: 이름, 유형, 범위, 임계치, 심각도, 채널, 활성 토글
- **규칙 편집 폼**: 유형 선택 → 유형에 맞는 임계치 입력(가동율은 % 슬라이더, 지속시간은 분), 범위 선택(공장/그룹/설비 다중), 채널 다중 선택, 쿨다운, 방해금지 시간
- **미리보기**: "최근 7일 데이터에 이 규칙을 적용했다면 N건 발생" (과다 알림 방지)
- **수신 채널**: 유형별 등록, 테스트 발송 버튼, 검증 상태 표시
- **가동율 표시 연동**: 설비별 가동율 화면(대시보드, 추세)에 해당 설비의 `UTIL_BELOW` 임계치를 기준선/색상으로 반영

### 11.6 비기능 요구사항
- 알림 평가 1회 실행 ≤ 10초 (37대 기준), Cron 타임아웃 내 완료
- 발송 실패 시 이력에 오류 사유 기록, 3회 연속 실패 채널은 설정 화면에 경고 표시
- 동일 설비·동일 사유로 하루 최대 알림 건수 제한 (기본 10건)
- 알림 규칙/채널 변경 이력 로깅 (변경자, 변경 전후 값)
- `/api/alerts/evaluate`는 `CRON_SECRET` 헤더 검증으로 외부 호출 차단

---

## 12. (v2) 성공 지표

| 지표 | 현재 (`index.html` 운영) | 목표 (서비스 도입 3개월) |
|------|-------------------------|------------------------|
| 비가동 원인 분류율 | 측정 불가 (원인 입력 UI 없음) | ≥ 90% |
| 장시간 정지(60분+) 인지 소요 시간 | 익일 수작업 분석 | 실시간 수집 후 ≤ 10분 |
| 주간 가동율 리뷰 소요 시간 | 매일 index.html 재실행 + 수작업 Excel 정리 | 추세 뷰로 ≤ 10분 |
| 상위 3개 원인 손실 시간 | 기준선 측정 | 20% 감소 |

---

## 13. 미결 사항 (Open Questions)

- [ ] `index.html`의 EMS JSON 포맷(`equipments[].samples[].t/a`)이 실제 사내 EMS 추출 결과와 일치하는가? 즐겨찾기 북마크릿의 산출 포맷 확정 필요
- [ ] MOLD .xls의 부서별 컬럼 네이밍 표준화 (현재 `index.html`은 유연 매칭 사용)
- [ ] 실시간 수집(EMS → DB 자동 적재) 구현 시점 — v2 알림의 "진짜 실시간" 전환 전제
- [ ] 사용자 인증 방식 (사내 SSO vs 자체 비밀번호)
