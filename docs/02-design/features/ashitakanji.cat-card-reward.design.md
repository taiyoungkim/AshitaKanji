# cat-card-reward Design Document

> 작성일: 2026-10-26 (v0.1)
> 기반: Plan v0.3 (`docs/01-plan/features/ashitakanji.cat-card-reward.plan.md`)
> 브랜치: `feature/cat-card-reward` (main 역머지 완료, `f023c5e`)
> 다음 단계: `/pdca do cat-card-reward --scope M1`

---

## Context Anchor (Plan에서 복사)

| 축 | 내용 |
|---|---|
| **WHY** | 출석도장에 보상이 없어 지속 학습 동기가 약함 |
| **WHO** | 장기 학습자 |
| **RISK** | 첫 네트워크 의존 / 이미지 권리 / 저사양 Android blend mode 성능 |
| **SUCCESS** | 시즌1 10종 100일 내 완주 · 오프라인 뽑기 100% 성공 |
| **SCOPE** | 도감·뽑기·카드 연출·홀로·기울기·공유. 서버/동기화/승급 제외 |

### 프로토타입에서 이미 있는 것

| 파일 | 상태 | 이번 설계에서 |
|---|---|---|
| `src/features/cat-card/catalog.ts` | 시즌1 10종, 등급 가중치 | 그대로 사용 |
| `src/features/cat-card/gacha.ts` (+test) | 순수 뽑기 + 도장 계산 | 그대로 사용. `spendStamps`는 D1로 불필요 → 프로토타입 삭제(M2) 때 함께 삭제 |
| `src/features/cat-card/components/HoloCard.tsx` | 홀로 + 기울기 | M3에서 정리해 재사용 |
| `src/features/cat-card/PrototypeScreen.tsx`, `app/_dev/cat-card.tsx`, 설정 진입 | 메모리 state 프로토타입 | M2 완료 시 삭제 |

---

## 1. 핵심 설계 결정

### D1. 도장은 저장하지 않고 파생한다

현재 기록 탭 도장(`StreakStamps days={streakDays}`)은 **연속** 학습일이라 하루 빠지면 0이 된다.
Plan FR-01은 **누적**(끊겨도 유지)을 요구한다. 둘은 다른 값이다.

```
earnedStamps   = epoch 이후 completed 세션이 있는 로컬 날짜 수   (session 테이블에서 파생)
spentStamps    = 뽑기 횟수 × STAMPS_PER_DRAW                    (cat_card_draw 행 수)
availableStamps = earnedStamps − spentStamps
```

- 카운터 컬럼을 두지 않는다. 세션 기록과 뽑기 기록이 진실 원천이고, 도장 수는 언제든 재계산된다
  → 증감 버그·이중 적립·롤백 불일치가 구조적으로 불가능
- 날짜 키는 기존 `dayKey()`(`StatsRollupService`)를 재사용. streak과 같은 날짜 경계를 쓴다
- 비용: 세션 전체 조회 1회. `RecordService.load`가 이미 같은 조회를 하므로 그 결과를 공유한다

### D2. 도장 시작일(epoch) — 기존 사용자 소급 안 함 (기본값)

기존 사용자 학습일을 전부 소급하면 200일 학습자는 즉시 20뽑기 → 시즌1이 첫날 끝난다.
Plan의 "100일 완주" 루프가 성립하지 않는다.

- `app_meta.cat_card_epoch` = 기능 첫 로드 시점의 **오늘 dayKey**. 한 번 쓰면 바꾸지 않는다
- epoch 당일 학습분부터 적립 (출시일에 공부한 날도 1도장)
- 신규 사용자는 epoch = 첫 실행일이라 차이 없음

> ❓ **사용자 결정 필요** — 기존 사용자에게 환영 뽑기 1회를 줄지. 주려면 `spentStamps`에서
> `STAMPS_PER_DRAW`만큼 빼는 상수 1개로 끝난다. 기본값: 안 줌.

### D3. 저장은 테이블 1개 (스키마 v8)

```sql
CREATE TABLE IF NOT EXISTS cat_card_draw (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id   TEXT    NOT NULL,   -- catalog id. 변경 금지 (cat-001 ...)
  drawn_at  INTEGER NOT NULL,   -- unix ms
  duplicate INTEGER NOT NULL CHECK (duplicate IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_cat_card_draw_card ON cat_card_draw(card_id);
```

뽑기 1회 = 행 1개(append-only). 나머지는 전부 파생:

| 필요한 값 | 계산 |
|---|---|
| 보유 카드 | `SELECT DISTINCT card_id` |
| 만난 횟수 (FR-05) | `COUNT(*) GROUP BY card_id` |
| 첫 획득일 | `MIN(drawn_at) GROUP BY card_id` |
| 소비 도장 | `COUNT(*) × 10` |

- 카탈로그에 없는 `card_id`(미래 시즌에서 되돌린 경우 등)는 도감에서 무시. 삭제하지 않는다
- 사진 경로 컬럼은 **두지 않는다**. API 사진(D7)이 들어갈 때 v9에서 추가

### D4. 뽑기는 트랜잭션 하나

```
CatCardService.draw(nowMs):
  BEGIN EXCLUSIVE
    available = earned − COUNT(cat_card_draw) × 10
    if available < 10 → ROLLBACK, return null
    owned = DISTINCT card_id
    result = gacha.draw(SEASON_1, RARITY_WEIGHTS, owned)
    INSERT cat_card_draw
  COMMIT
  return result
```

- 버튼 연타·두 화면 동시 진입에도 도장이 음수가 되지 않는다. 기존 `SqliteReviewWriter`는
  `withTransactionAsync`를 쓰지만 이건 같은 연결의 다른 쿼리가 끼어들 수 있어,
  여기서는 `withExclusiveTransactionAsync` + 버튼 pending 비활성을 함께 쓴다
- `gacha.draw`는 순수 함수 그대로. random 주입으로 서비스 테스트도 결정적

### D5. 화면 구성

| 위치 | 변경 |
|---|---|
| 기록 탭 `StatsScreen` 단골 카드 | 상단 "단골 N일차"(streak)는 유지. **도장 10칸은 `availableStamps`(최대 10)로 교체**. 10칸이 차면 아래 문구 자리에 `카드 뽑기` 버튼 |
| 기록 탭 | 단골 카드 아래 `고양이 도감 3/?` 진입 행. 총량은 표기 안 함(FR-09) → `모은 카드 3장` |
| 홈 `StreakCard` (7칸) | **변경 없음** (Plan §6.2) |
| `app/cat-card/index.tsx` | 도감 그리드 (2열, 미보유는 실루엣 + `???`) |
| `app/cat-card/[id].tsx` | 카드 상세 — 큰 카드, 홀로/기울기, 만난 횟수, 공유 |
| `app/cat-card/draw.tsx` | 뽑기 연출 modal (뒷면 → 뒤집기 → 등급 연출 → `도감에 넣기`) |

> 주의: 단골 카드의 도장 의미가 "연속일"에서 "카드까지 남은 도장"으로 바뀐다.
> "단골 혜택 · 다음 학습 재료 2배" 문구는 streak 기준이므로 도장 줄과 분리해 상단 타이틀 옆으로 옮긴다.

### D6. 뽑기 결과 유실 방지

뽑기 직후 앱이 죽어도 카드는 이미 DB에 있다(D4가 연출보다 먼저 커밋).
연출 화면은 `drawId`를 파라미터로 받아 DB에서 읽기만 한다 → 재진입·뒤로가기에 안전.

### D7. TheCatAPI 보너스 사진 — 이번 범위에서 뺀다 (M5로 연기)

Plan의 9번 항목이지만 앱 최초 네트워크 통신이 된다:
개인정보 처리방침·Data Safety·App Privacy 갱신, API 키 주입, 파일 저장/정리가 한꺼번에 따라온다.
M1–M4는 번들 사진만으로 Plan의 SC-01~SC-07을 전부 만족한다. 출시 후 반응 보고 별도 PR.

### D8. 백업 export

`ExportPayload`에 `catCardDraws?: CatCardDraw[]` 추가. `EXPORT_SCHEMA_VERSION` 유지(선택 필드).
import 기능이 아직 없으므로 export만.

---

## 2. 모듈 구조

```
src/db/
  schema.ts                      + SCHEMA_V8_ADDITIONS, CURRENT_SCHEMA_VERSION = 8
  migrations/v8.ts               신규 (v7과 같은 형태)
  repos/CatCardDrawRepo.ts       인터페이스
  repos/sqlite/SqliteCatCardDrawRepo.ts
  repos/memory/InMemoryCatCardDrawRepo.ts
src/types/CatCardDraw.ts
src/features/cat-card/
  catalog.ts gacha.ts cardAssets.ts   (기존)
  stamps.ts                      earnedStamps(sessions, epochKey) — 순수
  CatCardService.ts              stampState() / draw() / collection()
  buildCatCardService.ts         getDatabase() 배선 (buildOnigiriProgressService 패턴)
  DexScreen.tsx  CardDetailScreen.tsx  DrawScreen.tsx
  components/HoloCard.tsx CardBack.tsx CardReveal.tsx useTilt.ts
app/cat-card/index.tsx [id].tsx draw.tsx
```

### 인터페이스

```ts
// src/db/repos/CatCardDrawRepo.ts
export interface CatCardDrawRepo {
  findAll(): Promise<CatCardDraw[]>;           // drawn_at ASC
  count(): Promise<number>;
  /** available 재확인 + insert 를 한 트랜잭션에서. 도장 부족이면 null. */
  insertIfAffordable(
    row: Omit<CatCardDraw, 'id'>,
    canAfford: (drawCount: number) => boolean,
  ): Promise<number | null>;
}

// src/features/cat-card/CatCardService.ts
export interface StampState {
  earned: number;
  available: number;   // earned − draws × 10
  canDraw: boolean;
  /** 다음 카드까지 남은 도장 (0이면 뽑기 가능) */
  untilNext: number;
}
export interface CollectionEntry { card: CatCard; count: number; firstDrawnAt: number | null; }
```

`epoch`은 `AppMetaRepo`에서 읽고 없으면 그 자리에서 기록한다(`ensureEpoch(nowMs)`).

### 데이터 흐름 (뽑기)

```
StatsScreen ─(TanStack Query: ['catCard','stamps'])→ CatCardService.stampState()
  └ [카드 뽑기] → CatCardService.draw() → router.push('/cat-card/draw?drawId=N')
                  └ invalidate ['catCard', *] , ['record']
DrawScreen(drawId) → repo.findAll() 에서 해당 행 → CardReveal
```

---

## 3. 테스트 계획

| 대상 | 케이스 |
|---|---|
| `stamps.test.ts` | 같은 날 여러 세션 = 1도장 · 미완료 세션 제외 · epoch 이전 제외 · 연속 끊겨도 누적 유지 · 자정 경계(dayKey) |
| `CatCardService.test.ts` (InMemory repo) | 9도장 → null · 10도장 → 1뽑기 후 available 0 · 25도장 → 2뽑기, 5 이월 · 10뽑기 후 전종 보유 · 11번째 duplicate=1 · epoch 최초 기록 후 불변 |
| `SqliteCatCardDrawRepo.test.ts` | 기존 `SqliteCardRepo.test.ts`의 `node:sqlite` 하네스로 도장 10개일 때 insertIfAffordable 연속 2회 → 두 번째 null. (동시성 자체는 단일 연결 하네스로 재현 불가 → 버튼 pending 비활성 + exclusive 트랜잭션으로 막고 실기기 연타 QA) |
| `schema.test.ts` | v8 포함 확인, v7 DB에 migrateToV8 후 기존 행 보존 |
| `gacha.test.ts` | 기존 유지 (2,000회 시뮬레이션) |

수동 QA: Plan SC-02(비행기 모드 10연속), SC-04(재시작·업데이트 후 보존), SC-05(저사양 Android fps), SC-06(reduced motion).

---

## 4. 구현 순서

| 모듈 | 범위 | 완료 기준 |
|---|---|---|
| **M1** | v8 마이그레이션 · repo 3종 · `stamps.ts` · `CatCardService` · export 필드 | §3 단위 테스트 통과, `npm run ci-check` |
| **M2** | 기록 탭 도장 교체 + 뽑기 버튼 · 도감 · 상세(정적) · 뽑기 연출(뒤집기) · 프로토타입 화면/설정 진입 삭제 | SC-01, SC-03, SC-06 |
| **M3** | `HoloCard` 정리 → 상세/연출에 적용 · `useTilt` 분리 · 등급별 홀로 · fps 폴백 | SC-05 |
| **M4** | 공유 (번들 사진 카드만). 설치된 `react-native-view-shot`으로 카드 캡처 → `expo-sharing` | SC-07 |
| M5 (보류) | TheCatAPI 사진 · 개인정보 문서 | D7 |

**M2 착수 전 차단 요소**: 실제 고양이 사진 10장 + 라이선스 근거 (Plan §9-1, 사용자 진행).
지금은 `cardAssets.ts`가 사진 1장을 10종이 공유한다. M1은 사진 없이 진행 가능.

---

## 5. 열린 질문

| # | 질문 | 기본값 |
|---|---|---|
| Q1 | 기존 사용자 환영 뽑기 1회? (D2) | 안 줌 |
| Q2 | 도장 10칸이 꽉 찬 상태로 뽑지 않고 계속 학습하면? | 계속 누적. 칸은 10에서 멈추고 `카드 뽑기 ×2` 표시 |
| Q3 | 출시 빌드에 포함할지 — `RELEASE_DECISIONS.md`가 현재 "Excluded" | M2 완료 + 사진 확보 후 결정 문서 갱신 |

---

## Version History

| 버전 | 날짜 | 변경 |
|---|---|---|
| v0.1 | 2026-10-26 | 최초 작성. 도장 파생(D1), epoch(D2), 단일 테이블(D3), TheCatAPI 연기(D7) |
