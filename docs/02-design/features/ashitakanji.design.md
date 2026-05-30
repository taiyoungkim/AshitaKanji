# 아시타칸지 (明日漢字) - Design

> 작성일: 2026-05-29 (v1.0)
> 기반: Plan v0.7.4 (`docs/01-plan/features/ashitakanji.plan.md`)
> 선택 아키텍처: **Option C — Pragmatic Balance** (Feature-first + 얇은 서비스 레이어)
> 다음 단계: `/pdca do ashitakanji --scope module-N`

---

## Context Anchor (Plan에서 복사, Do/Analysis로 전파)

| 축 | 내용 |
|---|---|
| **WHY** | 한자/가나/뜻 동시 노출 = 수동 읽기 + 망각. reveal 강제 + FSRS + 도파민 루프 = 매일 끝낼 수 있는 평생 단어장. 레벨업해도 같은 앱 |
| **WHO** | 1차: 장기 학습자 (수년 N5→N1, 하루 15-30분). 2차: 시험 임박 헤비유저 (빠른 훑기/약점 복습) |
| **RISK** | 1) 6,200 검수 부담 2) Tatoeba attribution 미준수 3) 카피 오해 4) Placeholder 회귀 5) 데이터 소실 6) GPT anchoring bias |
| **SUCCESS** | 6,200 verified / 5종 카드 타입 / FSRS+Again 미니라운드+Done / 레벨별 진척 5+전체 1 / JSON export / 사용자 학습데이터 송신 0 / OTA off / URL HTTP 200 / Placeholder 0 |
| **SCOPE** | MVP: 레벨 선택/혼합 + reveal UX + FSRS 4단계 + 일일 12개 (5-50) + 빠른 훑기 50/100/200/300 + 약점 복습 + Done + 통계 + TTS + JSON export. V1.1: 알림/한자분해/노트. V1.2+: GPT/네이버/IAP |

### 결정 체인 (Plan → Design)
- **[Plan] Architecture**: Option C Pragmatic Balance — Feature-first 폴더, 얇은 서비스 레이어, RN 의존성 부분 누수 허용
- **[Plan] State**: Zustand (UI/Settings) + TanStack Query (DB 캐시 invalidation)
- **[Plan] DB Access**: Repository pattern (CardRepo, UserCardRepo, ReviewLogRepo, ScanResultRepo, SessionRepo, DailyStatsRepo)
- **[Plan] SRS**: ts-fsrs npm 직접 wrapping (FsrsScheduler 서비스)
- **[Plan] Navigation**: expo-router (file-based)

---

## 1. Overview

### 1.1 목적
JLPT N5-N1 핵심 선별 6,200 단어를 reveal UX + FSRS 간격반복으로 매일 끝낼 수 있는 평생 단어장 앱.

### 1.2 비기능 요구
| 항목 | 목표 |
|---|---|
| DB 크기 (앱 번들 포함) | < 20MB |
| 콜드 스타트 → Home | < 1.5s |
| 카드 등급 입력 → 다음 카드 | < 50ms |
| 학습 상태 영속화 | 100% (앱 강제 종료 후에도 유지) |
| 외부 학습 데이터 송신 | 0건 |
| OTA 통신 | 0건 (MVP `expo.updates.enabled=false`) |
| 오프라인 동작 | 100% (모든 학습 기능) |

### 1.3 Out of Scope (Design 차원)
- 사용자 인증 / 계정 (MVP X)
- 다기기 동기화 (V1.2+)
- 백엔드 서버 (전체 로컬)
- 푸시 알림 (V1.1)
- AI 질문 (V1.2+)

---

## 2. Architecture (Option C — Pragmatic Balance)

### 2.1 레이어
```
┌──────────────────────────────────────────────────┐
│  Presentation (app/, src/features/*/components/) │
│  - expo-router screens                            │
│  - React components                               │
│  - Zustand stores (UI state)                      │
└──────────────────────────────────────────────────┘
                       ↕
┌──────────────────────────────────────────────────┐
│  Service Layer (src/features/*/services/, src/srs/)│
│  - SessionEngine (큐 우선순위, Main+미니 라운드)   │
│  - FsrsScheduler (ts-fsrs wrapper)                │
│  - ScanService (빠른 훑기 분류 → SRS 편입)        │
│  - WeaknessService (약점 큐 산정)                 │
│  - StatsRollupService (lazy rollup)               │
│  - ExportService (JSON dump)                      │
└──────────────────────────────────────────────────┘
                       ↕
┌──────────────────────────────────────────────────┐
│  Repository (src/db/repos/*)                      │
│  - CardRepo, UserCardRepo, ReviewLogRepo,         │
│    ScanResultRepo, SessionRepo, DailyStatsRepo,   │
│    EventsRepo, AppMetaRepo                        │
└──────────────────────────────────────────────────┘
                       ↕
┌──────────────────────────────────────────────────┐
│  Infrastructure (expo-sqlite, expo-speech, ...)   │
└──────────────────────────────────────────────────┘
```

### 2.2 의존성 흐름
- Presentation → Service → Repository → Infrastructure (단방향)
- Service는 Repository **interface**에만 의존 (테스트 시 mock 가능)
- 도메인 객체 (Card, UserCard, ReviewLog 등)는 `src/types/` 공통

### 2.3 폴더 구조 (확정)
```
ashitakanji/
├─ app/                              # expo-router
│  ├─ (tabs)/
│  │  ├─ home.tsx                    # 오늘 복습, 시작 버튼, 더 공부하기
│  │  ├─ study.tsx                   # 카드 화면 (라우팅만, 컴포넌트는 features/study/)
│  │  ├─ stats.tsx                   # 레벨별 + 전체 진척
│  │  └─ settings.tsx                # 한도/TTS/내보내기/실험실
│  ├─ scan.tsx                       # 빠른 훑기
│  ├─ weakness.tsx                   # 약점 복습
│  ├─ done.tsx                       # 오늘 끝!
│  ├─ word/[id].tsx                  # 단어 상세 (예문 + author + TTS)
│  ├─ about.tsx                      # 라이선스 + Example Sources
│  └─ _layout.tsx                    # Root layout (QueryClient, theme, db init)
├─ src/
│  ├─ features/
│  │  ├─ study/
│  │  │  ├─ SessionEngine.ts        # 큐 우선순위, Main+Again 미니라운드
│  │  │  ├─ StudyScreen.tsx
│  │  │  └─ components/Card, RevealButton, GradeButtons, SessionProgress
│  │  ├─ scan/
│  │  │  ├─ ScanService.ts          # 분류 → SRS 편입 추천
│  │  │  └─ ScanScreen.tsx
│  │  ├─ weakness/
│  │  │  ├─ WeaknessService.ts      # 최근 Again + Leech + reveal_ms 긴 카드
│  │  │  └─ WeaknessScreen.tsx
│  │  ├─ stats/
│  │  │  ├─ StatsRollupService.ts   # lazy rollup
│  │  │  └─ StatsScreen.tsx
│  │  ├─ done/
│  │  │  └─ DoneScreen.tsx
│  │  └─ settings/
│  │     ├─ SettingsScreen.tsx
│  │     └─ ExportService.ts        # JSON 다운로드
│  ├─ srs/
│  │  └─ FsrsScheduler.ts           # ts-fsrs wrapper (4단계 등급 → next interval)
│  ├─ db/
│  │  ├─ schema.ts                  # CREATE TABLE 문
│  │  ├─ migrations/v1.ts           # initial
│  │  ├─ open.ts                    # DB 초기화 (assets/jlpt.db 복사)
│  │  └─ repos/
│  │     ├─ CardRepo.ts
│  │     ├─ UserCardRepo.ts
│  │     ├─ ReviewLogRepo.ts
│  │     ├─ ScanResultRepo.ts
│  │     ├─ SessionRepo.ts
│  │     ├─ DailyStatsRepo.ts
│  │     ├─ EventsRepo.ts
│  │     └─ AppMetaRepo.ts
│  ├─ stores/
│  │  ├─ SettingsStore.ts           # Zustand: 일일 한도, TTS 속도, 학습 레벨
│  │  └─ SessionStore.ts            # Zustand: 현재 세션 ID, 카드 인덱스, reveal 상태
│  ├─ hooks/
│  │  ├─ useStudySession.ts         # SessionEngine + TanStack Query
│  │  ├─ useTTS.ts                  # expo-speech 래핑
│  │  ├─ useDailyStats.ts           # lazy rollup 트리거
│  │  └─ useLevelProgress.ts        # 레벨별 진척률 계산
│  ├─ types/
│  │  ├─ Card.ts                    # word + user_card 결합 타입
│  │  ├─ ReviewLog.ts
│  │  ├─ Session.ts
│  │  └─ Grade.ts                   # 1=Again, 2=Hard, 3=Good, 4=Easy
│  ├─ lib/
│  │  ├─ queryClient.ts             # TanStack Query 설정
│  │  ├─ errorBoundary.tsx
│  │  └─ logger.ts                  # 로컬 events 로그 (제3자 분석 SDK X)
│  └─ utils/
│     ├─ time.ts                    # unix ms 유틸
│     ├─ random.ts                  # 인터리빙 셔플 (V1.2)
│     └─ cardType.ts                # A/B/C/D/E 분류 헬퍼
├─ assets/
│  ├─ jlpt.db                       # 빌드시 scripts/build-db.ts가 생성
│  └─ tatoeba-authors.txt           # About > Example Sources용
├─ scripts/                          # 데이터 파이프라인 (Track A)
│  ├─ normalize.ts                  # Kaggle → CSV 정규화
│  ├─ gpt-draft.ts                  # GPT-4o 초안
│  ├─ qa-cli.ts                     # 사람 검수 CLI
│  ├─ match-examples.ts             # Tatoeba 매핑
│  └─ build-db.ts                   # CSV → SQLite
├─ data/
│  ├─ raw/kaggle.csv
│  ├─ csv/{n1..5}.csv
│  ├─ csv/{n1..5}-verified.csv
│  ├─ gpt_responses/*.json
│  └─ qa_log.csv
├─ site/                             # GitHub Pages (배포 완료)
├─ docs/                             # PLAN, design, analysis, report
├─ LICENSE-data-kaggle-jlpt.txt
├─ app.json                          # Expo config (updates.enabled=false)
├─ eas.json                          # EAS Build profiles
├─ package.json
└─ tsconfig.json
```

---

## 3. Data Model

### 3.1 SQLite 스키마 (확정 — Plan §9 기반)
> Plan에 정의됨. 변경 사항만 명시:
- `is_beta` 컬럼 폐기됨 (v0.6)
- `example_jp_id`, `example_jp_author`, `example_ko_id`, `example_ko_author`, `example_license` 추가됨 (v0.7)
- daily_stats = **lazy rollup** (cron 없음)

### 3.2 Repository Interface (예시)
```typescript
// src/db/repos/UserCardRepo.ts
export interface UserCardRepo {
  findById(wordId: string): Promise<UserCard | null>;
  findDueByLevel(levels: JlptLevel[], limit: number): Promise<UserCard[]>;
  findNewByLevel(levels: JlptLevel[], dailyNewLimit: number): Promise<UserCard[]>;
  upsert(card: UserCard): Promise<void>;
  markLeech(wordId: string): Promise<void>;
  countByState(state: CardState): Promise<number>;
  countMatureByLevel(level: JlptLevel): Promise<number>; // stability >= 21d
}

// 구현체: SqliteUserCardRepo (src/db/repos/sqlite/)
// 테스트용: InMemoryUserCardRepo
```

### 3.3 도메인 타입
```typescript
// src/types/Card.ts
export type CardType = 'A' | 'B' | 'C' | 'D' | 'E';
export type JlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface Word {
  id: string;
  level: JlptLevel;
  surface: string;
  reading_kana: string;
  furigana?: string;
  meaning_ko: string;
  part_of_speech?: string;
  card_type: CardType;
  example_jp?: string;
  example_ko?: string;
  example_jp_id?: number;
  example_jp_author?: string;
  example_ko_id?: number;
  example_ko_author?: string;
  example_license?: string;
  alt_forms?: string[];
  disambig?: string;
  qa_status: 'verified' | 'auto' | 'needs_review' | 'rejected';
  deprecated: 0 | 1;
  tags?: string[];
}

export interface UserCard {
  word_id: string;
  difficulty: number;
  stability: number;
  scheduled_days: number;
  elapsed_days: number;
  reps: number;
  lapses: number;
  last_review: number;
  due: number;
  state: CardState;
  note?: string; // V1.1
  leech: 0 | 1;
}

export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
```

---

## 4. Core Services (API Contract)

> 백엔드 없음 → API 계약 = **로컬 서비스 함수 시그니처**.

### 4.1 FsrsScheduler (`src/srs/FsrsScheduler.ts`)
```typescript
import { FSRS, generatorParameters, createEmptyCard, Rating } from 'ts-fsrs';

export class FsrsScheduler {
  private fsrs: FSRS;

  constructor(params = generatorParameters({ enable_fuzz: true })) {
    this.fsrs = new FSRS(params);
  }

  /**
   * 신규 카드 초기화 (state='new')
   */
  initNew(wordId: string): UserCard;

  /**
   * 등급 처리 → 다음 스케줄 계산
   */
  review(card: UserCard, grade: Grade, now: number): {
    next: UserCard;
    log: ReviewLogRecord;
  };

  /**
   * 디버깅용: 카드의 stability/difficulty/due 예측 표시
   */
  preview(card: UserCard, grades: Grade[]): UserCard[];
}
```

### 4.2 SessionEngine (`src/features/study/SessionEngine.ts`)
```typescript
export interface SessionConfig {
  levels: JlptLevel[];           // 학습 레벨 선택 (다중)
  dailyNewLimit: number;          // 5-50
  highIntensityWarn: boolean;     // 30+ 선택 시 경고
}

export class SessionEngine {
  constructor(
    private cardRepo: CardRepo,
    private userCardRepo: UserCardRepo,
    private reviewLogRepo: ReviewLogRepo,
    private sessionRepo: SessionRepo,
    private fsrs: FsrsScheduler,
  ) {}

  /**
   * 세션 시작 → 큐 빌드 (오버듀 → 어제 학습 → 신규 N개)
   */
  async start(config: SessionConfig): Promise<SessionState>;

  /**
   * 현재 카드 가져오기
   */
  current(): Card | null;

  /**
   * 등급 입력 → FSRS 처리 → review_log 기록 → 다음 카드
   */
  async submitGrade(grade: Grade, revealMs: number): Promise<void>;

  /**
   * Main round 끝 → Again 미니 라운드 진입
   */
  async startAgainRound(): Promise<void>;

  /**
   * 세션 종료 (Done 화면 진입)
   */
  async end(reason: 'completed' | 'abandoned'): Promise<SessionSummary>;
}

interface SessionState {
  sessionId: number;
  mainQueue: Card[];      // overdue + yesterday + new
  againQueue: Card[];     // Main round 끝나면 채워짐
  phase: 'main' | 'again' | 'done';
  currentIndex: number;
  doneNew: number;
  doneReview: number;
  againSubmissions: Map<string, number>; // wordId → again 횟수 (2회면 내일로)
}
```

### 4.3 ScanService (`src/features/scan/ScanService.ts`)
```typescript
export type ScanGrade = 'known' | 'confused' | 'unknown' | 'later';

export class ScanService {
  /**
   * 사용 가능 풀에서 batchSize개 랜덤 추출 (verified만)
   * batchSize: 50/100/200/300
   * 25개 단위 세트로 나눠서 진행
   */
  async startScan(levels: JlptLevel[], batchSize: 50|100|200|300): Promise<ScanSession>;

  /**
   * 카드 분류 결과 저장 (scan_result 테이블)
   */
  async submitScanGrade(wordId: string, grade: ScanGrade): Promise<void>;

  /**
   * 스캔 종료 → SRS 편입 추천
   * - 모름 > 헷갈림 순서로 우선
   * - 기본 추천: 30개, 최대 50개
   * - 안다 = scan_result만 저장, SRS X
   */
  async endScan(): Promise<ScanSummary>;

  /**
   * 사용자가 선택한 N개를 SRS 신규 큐에 편입
   */
  async promoteToSrs(wordIds: string[]): Promise<void>;
}
```

### 4.4 WeaknessService (`src/features/weakness/WeaknessService.ts`)
```typescript
export class WeaknessService {
  /**
   * 약점 큐 산정 (신규 증가 X):
   * - 최근 7일 Again 카드
   * - reveal_ms 평균 > 8초 카드
   * - leech=1 카드
   * - scan_result로 confused/unknown 표시했지만 SRS 미편입 카드
   */
  async getWeaknessQueue(levels: JlptLevel[], limit: number): Promise<Card[]>;
}
```

### 4.5 StatsRollupService (`src/features/stats/StatsRollupService.ts`)
```typescript
export class StatsRollupService {
  /**
   * Lazy rollup: 마지막 집계 이후 review_log 차이만 daily_stats에 반영
   * 호출 시점:
   *   1) 앱 시작 (마지막 집계 이후 차이)
   *   2) 세션 종료 (오늘 행 갱신)
   *   3) 통계 화면 진입 (강제 재계산)
   * Idempotent — 여러 번 호출해도 결과 동일
   */
  async rollup(): Promise<void>;

  /**
   * 통계 화면용 데이터
   */
  async getLevelProgress(level: JlptLevel): Promise<LevelProgress>;
  async getOverallProgress(): Promise<OverallProgress>;
  async getStreak(): Promise<number>;
  async getMatureCount(level: JlptLevel): Promise<number>;
}
```

### 4.6 ExportService (`src/features/settings/ExportService.ts`)
```typescript
export class ExportService {
  /**
   * MVP JSON export
   * - user_card 전체
   * - daily_stats 전체
   * - app_meta
   * - review_log (선택, 큰 경우 옵션)
   * - (V1.1) note
   * 파일명: ashitakanji-backup-YYYYMMDD.json
   */
  async exportToJson(includeReviewLog: boolean): Promise<{
    path: string;        // FileSystem.documentDirectory + filename
    bytes: number;
  }>;

  /**
   * Share Sheet 호출 (expo-sharing)
   */
  async shareFile(path: string): Promise<void>;
}
```

---

## 5. UI/UX

### 5.1 화면 라우팅 (expo-router)
| 경로 | 컴포넌트 | 비고 |
|---|---|---|
| `/(tabs)/home` | HomeScreen | 첫 진입 |
| `/(tabs)/study` | StudyScreen | 카드 진행 |
| `/(tabs)/stats` | StatsScreen | 레벨별 + 전체 |
| `/(tabs)/settings` | SettingsScreen | 한도/TTS/Export/About |
| `/scan` | ScanScreen | 빠른 훑기 |
| `/weakness` | WeaknessScreen | 약점 복습 |
| `/done` | DoneScreen | 세션 완료 |
| `/word/[id]` | WordDetailScreen | 단어 상세 |
| `/about` | AboutScreen | 라이선스 + Example Sources |

### 5.2 Card UX (핵심)
```
┌──────────────────────┐
│      勉強             │   ← 한자 면 (surface)
│                      │   ← 카드 타입 A/B/E
│  [탭하여 보기]        │
│                      │
└──────────────────────┘

reveal 후:
┌──────────────────────┐
│      勉強             │
│   べんきょう           │   ← reading_kana
│      공부             │   ← meaning_ko
│ ─────────────────    │
│ 例: 毎日勉強する       │   ← example_jp
│   매일 공부한다        │   ← example_ko
│ © contrib123 · CC BY │   ← 작은 attribution
│                      │
│ [🔊]                  │   ← TTS
└──────────────────────┘
[Again] [Hard] [Good] [Easy]
```

### 5.3 카드 타입별 분기 (Plan §5)
```typescript
function renderKanjiFace(word: Word): string {
  switch (word.card_type) {
    case 'A': return word.surface;        // 勉強
    case 'B': return word.surface;        // 食べる (오쿠리가나 노출)
    case 'C': return word.surface;        // ありがとう (가나)
    case 'D': return word.surface;        // テレビ
    case 'E': return word.surface;        // お土産
  }
}

function shouldHideReading(word: Word): boolean {
  return word.card_type === 'A' || word.card_type === 'B' || word.card_type === 'E';
}
```

### 5.4 Home 정보 구조
```
오늘 할 일
[오늘 복습 시작]         due + 오늘 신규 N개

더 공부하기
[새 단어 외우기]         5/12/20/30/50
[시험 전 빠른 훑기]      50/100/200/300
[약점만 다시 보기]       Again/헷갈림/Leech 중심
```

### 5.5 "Done!" 화면 (도파민 루프)
```
┌────────────────────┐
│       🎉           │
│   오늘 끝!          │
│                    │
│  새 단어 12개       │
│  복습 28개          │
│  소요 14분          │
│                    │
│  연속 학습 5일째     │
│                    │
│  [통계 보기]        │
└────────────────────┘
```

---

## 6. State Management

### 6.1 Zustand Stores
```typescript
// src/stores/SettingsStore.ts
interface SettingsState {
  selectedLevels: JlptLevel[];     // 학습 레벨 (다중)
  dailyNewLimit: number;            // 5-50
  ttsSpeed: number;                 // 0.5-2.0
  ttsEnabled: boolean;
  highIntensityWarned: boolean;    // 30+ 경고 1회 표시 후 기억
  betaLabsEnabled: boolean;        // (현재 X, 미래용)
  setLevels: (l: JlptLevel[]) => void;
  setDailyNewLimit: (n: number) => void;
  // ...
}

// 저장: AsyncStorage 사용 (zustand/middleware persist)
```

```typescript
// src/stores/SessionStore.ts (실행 중 세션만, 메모리)
interface SessionStoreState {
  current: SessionState | null;
  reveal: boolean;            // 현재 카드 reveal 여부
  revealStartMs: number;      // reveal_ms 계산용
  startSession: (config: SessionConfig) => Promise<void>;
  showReveal: () => void;
  submitGrade: (grade: Grade) => Promise<void>;
  endSession: () => Promise<SessionSummary>;
}
```

### 6.2 TanStack Query 키 컨벤션
```typescript
// 통계
['stats', 'level-progress', level]
['stats', 'overall-progress']
['stats', 'streak']
['stats', 'mature', level]

// 단어
['word', wordId]
['user-card', wordId]

// 큐
['queue', 'due', levels]
['queue', 'new', levels, limit]
```

### 6.3 Invalidation 시점
- 등급 입력 후 → `['queue', '*']`, `['stats', '*']`, `['user-card', wordId]`
- 세션 종료 후 → `['stats', '*']`
- 설정 변경 후 → `['queue', '*']` (레벨 변경 시)

---

## 7. Error Handling

| 시나리오 | 처리 |
|---|---|
| DB 초기 복사 실패 | 에러 화면 + "재시도" + 진단 로그 |
| 마이그레이션 실패 | `app_meta.data_version` 안 올림 → 자동 미적용 + 사용자 알림 |
| review_log INSERT 실패 | 현재 등급은 user_card 업데이트 유지, 로그만 실패 → 다음에 복구 |
| TTS 미지원 언어 | 무음, 토스트 "TTS 사용 불가" 1회 |
| Export 파일 생성 실패 | 토스트 + 진단 ID 표시 |
| Export 파일 공유 취소 | 무시 |
| 빠른 훑기 중 앱 종료 | scan_result에 부분 저장, 다음 진입 시 "이어서 / 새로 시작" |

### Error Boundary
- `src/lib/errorBoundary.tsx` — 상위 Boundary 1개
- Fallback UI = "문제가 생겼어요" + 재시작 + 진단 ID
- 진단 ID = events 테이블에 type='crash'로 기록 (로컬만)

---

## 8. Test Plan

### 8.1 Unit 테스트 (Vitest 또는 Jest)
| 대상 | 테스트 |
|---|---|
| FsrsScheduler | 4단계 등급 → 다음 due 계산, 누적 stability 증가 |
| SessionEngine | 큐 우선순위, Again 미니 라운드, 2회 실패 시 내일로 |
| ScanService | 분류 → SRS 편입 추천 (모름 > 헷갈림 우선) |
| WeaknessService | 약점 큐 산정 (Again 7일/leech/reveal_ms) |
| StatsRollupService | Idempotent (여러 번 호출 = 동일 결과) |
| ExportService | JSON 스키마 검증 |
| cardType util | A/B/C/D/E 자동 분류 |

### 8.2 Integration 테스트
- In-memory SQLite로 Repository 동작 검증
- Session 전체 흐름: start → grade × N → end → daily_stats 확인

### 8.3 E2E (Detox 또는 Maestro, V1.1 검토)
- MVP는 본인 실기기 수동 시나리오만:
  1. 신규 카드 5개 학습 → reveal → Good → Done 도달
  2. Again 등급 → 미니 라운드 → 2회 실패 → 내일로 미뤄지는지
  3. 앱 강제 종료 → 재실행 → 학습 상태 유지
  4. 빠른 훑기 100개 분류 → SRS 30개 편입
  5. JSON export → 공유 시트 → 파일 검증

### 8.4 데이터 게이트 (Track A)
- 검수 오답률 ≤ 1% per level (N1/N2 ≤ 2%) — Plan §8 Go/No-Go

---

## 9. Security & Privacy

| 항목 | 처리 |
|---|---|
| 학습 데이터 | 로컬 SQLite만 |
| 외부 송신 | 0건 (사용자 학습) + MVP OTA off |
| API 키 보관 | (V1.2 OpenAI 도입 시) expo-secure-store |
| Export 파일 | 사용자 명시 공유 시에만 외부로 (Share Sheet) |
| 권한 요청 | MVP 0건 (TTS는 권한 불필요) |
| crash 로그 | 로컬 events 테이블, 외부 송신 X |

---

## 10. Performance

| 항목 | 목표 | 방법 |
|---|---|---|
| 콜드 스타트 → Home | < 1.5s | DB 첫 복사는 백그라운드, Home은 즉시 렌더 |
| 카드 등급 → 다음 카드 | < 50ms | FSRS 계산은 동기, DB write는 백그라운드 큐 |
| 통계 화면 진입 | < 200ms | lazy rollup, 캐시 + invalidation |
| DB 크기 | < 20MB | 6,200 단어 + 인덱스 8개 + 메타 = ~15MB 예상 |
| 빠른 훑기 300개 세션 | 메모리 < 50MB | 25개 청크 단위 스트리밍 |

---

## 11. Implementation Guide

### 11.1 의존성
```bash
pnpm add expo expo-router expo-sqlite expo-speech expo-sharing expo-secure-store \
        expo-file-system expo-asset \
        @tanstack/react-query zustand ts-fsrs \
        react-native-svg
pnpm add -D typescript @types/react @types/node vitest @testing-library/react-native
```

### 11.2 구현 순서 (Track B, 6.5일)
| 순번 | Phase | 산출물 | 일정 |
|---|---|---|---|
| 1 | B1 | Expo 골격 (expo-router, sqlite open, schema migration v1, QueryClient) | 0.5일 |
| 2 | B2 | 카드 타입 정책 (cardType util, Card 컴포넌트 분기) | 0.5일 |
| 3 | B3 | FsrsScheduler + SessionEngine + Again 미니 라운드 + review_log | 1.5일 |
| 4 | B4 | ScanService + WeaknessService + scan_result | 1일 |
| 5 | B5 | StudyScreen + RevealButton + GradeButtons + DoneScreen | 1일 |
| 6 | B6 | StatsRollupService + StatsScreen + TTS | 0.5일 |
| 7 | B7 | ExportService + 설정 화면 + About + tatoeba-authors | 0.5일 |
| 8 | B8 | 디자인 패스 + EAS dev build + 실기기 검증 | 1일 |

### 11.3 Session Guide (Module Map)

> `/pdca do ashitakanji --scope module-N` 으로 다중 세션 구현 지원.

| Module Key | 범위 | 의존 | 추정 |
|---|---|---|---|
| **module-1-skeleton** | B1: Expo init, expo-router, sqlite open, schema, QueryClient, theme | - | 0.5일 |
| **module-2-card-types** | B2: cardType util, Word/UserCard 타입, Card 컴포넌트 5종 분기 + 미니 스토리북 | module-1 | 0.5일 |
| **module-3-fsrs** | B3: FsrsScheduler wrapper + 단위 테스트 (등급별 due 계산) | module-1 | 0.5일 |
| **module-4-session** | B3: SessionEngine (큐 우선순위 + Main+Again 미니라운드 + 2회 실패 시 내일로) + review_log Repo | module-3 | 1일 |
| **module-5-scan** | B4: ScanService + scan_result Repo + 25개 청크 스트리밍 + SRS 편입 추천 | module-1, module-3 | 0.5일 |
| **module-6-weakness** | B4: WeaknessService (Again 7일/leech/reveal_ms) | module-1, module-4 | 0.5일 |
| **module-7-study-screen** | B5: StudyScreen + RevealButton + GradeButtons + SessionProgress | module-2, module-4 | 1일 |
| **module-8-done-screen** | B5: DoneScreen + 도파민 애니메이션 (Lottie/Reanimated 가벼움) | module-7 | 0.5일 (B5 1일에 포함) |
| **module-9-stats** | B6: StatsRollupService (lazy rollup, idempotent) + StatsScreen + 레벨별/전체 카드 | module-1, module-4 | 0.5일 |
| **module-10-tts** | B6: useTTS hook (expo-speech, ja-JP) | module-1 | 0.5일 (B6 0.5일에 포함) |
| **module-11-export** | B7: ExportService + 설정 화면 + 공유 시트 | module-1 | 0.5일 |
| **module-12-about** | B7: AboutScreen + 라이선스 + tatoeba-authors.txt 표시 + 단어 상세 author 표기 | module-1 | (B7 0.5일에 포함) |
| **module-13-polish** | B8: 디자인 패스 + EAS dev build + 실기기 시나리오 5건 검증 | 전체 | 1일 |

### 11.4 추천 세션 분할 (개인 작업 페이스)
| 세션 | 묶음 | 추정 |
|---|---|---|
| Day 1 AM | `--scope module-1-skeleton,module-2-card-types` | 1일 |
| Day 2 | `--scope module-3-fsrs,module-4-session` | 1.5일 |
| Day 3 | `--scope module-5-scan,module-6-weakness` | 1일 |
| Day 4 | `--scope module-7-study-screen,module-8-done-screen` | 1.5일 |
| Day 5 | `--scope module-9-stats,module-10-tts` | 0.5일 |
| Day 6 | `--scope module-11-export,module-12-about` | 0.5일 |
| Day 7 | `--scope module-13-polish` | 1일 |
| **합계** | | **7일** (Track B 6.5일 + 디자인 패스 0.5일 버퍼) |

---

## 12. Open Questions

| Q | 결정 시점 |
|---|---|
| 다크모드 = OS follow만? 토글? | V1.2 결정 (MVP는 OS follow만, light 우선) |
| 카드 swipe 제스처 = Tinder 스타일? 탭만? | module-7 구현 시 결정 (MVP는 탭만, V1.1 swipe 검토) |
| Done 화면 애니메이션 = Lottie vs Reanimated? | module-8에서 측정 (Lottie 무게 vs Reanimated 가벼움) |
| Export 형식 = JSON only vs CSV 옵션? | MVP는 JSON만, V1.1에서 CSV 검토 |
| EAS Production 빌드 시 minify 옵션 = 기본값 | EAS 기본 설정 사용 |
| 메인 폰트 = 시스템 vs Noto Sans JP 번들? | module-13 디자인 패스에서 결정 (한자 가독성 ↑하면 Noto 번들, +1MB) |

---

## 13. 다음 액션

1. **`/pdca do ashitakanji --scope module-1-skeleton`** → B1 시작
2. 병행: Track A의 `scripts/normalize.ts` 작성
3. 병행: GitHub Pages 활성화 + URL HTTP 200 확인
4. 병행: OpenAI 키 발급 + $50 한도

---

## Appendix A: Plan 결정 미반영 시 차이
- Plan에 있는 모든 결정은 Design에 반영됨. 만약 Plan 갱신 시 Design 재검토 필요.
- 특히 §5 카드 타입 정책, §7 데이터 파이프라인, §11 FSRS 알고리즘, §15 백업, §16 Privacy & AI 변경 시 본 Design 영향.
