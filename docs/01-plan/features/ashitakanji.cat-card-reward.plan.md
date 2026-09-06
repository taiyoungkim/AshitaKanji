# cat-card-reward Planning Document

> 작성일: 2026-09-07 (v0.2 — 시즌1 10종으로 축소)
> 상태: Draft — Design 대기
> 다음 단계: `/pdca design cat-card-reward`
>
> v0.1: 도장 사이클 10일(누적), 도감 24종 + 등급 확률 뽑기, 개별 고양이 이름,
>      서버 없음(로컬 SQLite + 번들 사진 + TheCatAPI 보너스),
>      홀로/기울기/공유 v1 포함, Skia 불채택(RN 0.81 네이티브 blend mode 사용)
> **v0.2**: 시즌 개념 도입. 시즌1을 10종으로 축소, 등급 4단계 → 3단계.
>      도감 총량 고정 표기 금지(확장 대비). 완주 기댓값 36뽑기 → 14뽑기
> **v0.3**: 프로토타입 구현 중 실측으로 완주 계산 정정 — 정확히 10뽑기(100일).
>      미보유 우선 + tier 재분배를 함께 쓰면 완주 전 중복이 구조적으로 0이다

---

## Executive Summary

| 항목 | 내용 |
|---|---|
| **Feature** | cat-card-reward (고양이 카드 보상) |
| **한 줄** | 출석도장 10개를 모으면 포켓몬 카드 형태의 고양이 카드를 1장 뽑는다 |
| **보상 주기** | 학습한 날 1도장 누적, 10도장 = 1뽑기 (연 최대 36.5회) |
| **도감 규모** | **시즌1 10종** (N 6 / R 3 / SR 1). 시즌2 이후 이어붙임 |
| **완주 기댓값** | **정확히 10뽑기** = 매일 출석 시 100일 (3.3개월). 완주 전 중복 없음 |
| **Backend** | **없음** — 로컬 SQLite + 번들 이미지, TheCatAPI는 선택적 보너스 |
| **신규 의존성** | `expo-sensors` 1개 (Skia 불필요) |
| **기존 시스템 관계** | 오니기리 재료 수집과 **무관**. 출석도장 전용 보상 |

### Value Delivered

| 관점 | 내용 |
|---|---|
| **Problem** | 출석도장 10칸을 채워도 보상이 없다. 도장이 진행률 표시로만 존재해서 채울 이유가 약하다. |
| **Solution** | 도장 완성 = 카드 뽑기. 등급별로 빛나는 실사 고양이 카드를 도감에 모은다. |
| **Function UX Effect** | 도장 10칸이 "다음 카드까지 3일"로 읽힌다. 학습 재개 트리거가 매일 눈에 보이는 카운트다운이 된다. |
| **Core Value** | 하루 학습의 보상이 소모되지 않고 **영구히 쌓이는 소유물**이 된다. 도감이 곧 학습 기록. |

---

## Context Anchor

| 항목 | 내용 |
|---|---|
| **WHY** | 출석도장에 보상이 없어 지속 학습 동기가 약함 |
| **WHO** | 장기 학습자 (기존 앱 페르소나와 동일) |
| **RISK** | 첫 네트워크 의존 도입 / 이미지 권리 / 저사양 안드로이드 blend mode 성능 |
| **SUCCESS** | 시즌1 10종이 100일 내 완주 가능 · 오프라인에서도 뽑기 100% 성공 |
| **SCOPE** | 도감·뽑기·카드 연출·홀로·기울기·공유. 서버/동기화/승급 제외 |

---

## 1. Overview

### 1.1 Purpose

출석도장(`StreakStamps`, 기록 탭 10칸)의 완성에 영구 소장형 보상을 붙인다.
보상은 포켓몬 카드 컨셉의 고양이 카드이며, 등급에 따라 카드가 빛난다.

### 1.2 Background

- 현재 도장은 진행률 시각화만 담당하고 보상이 없음
- 기존 오니기리 재료 수집은 **세션 단위 즉시 보상**으로 별도 존재. 본 기능과 역할이 겹치지 않음
- 앱은 현재 네트워크 호출이 0건인 완전 오프라인 구조 (`fetch` 미사용)

### 1.3 Related Documents

- `docs/01-plan/features/ashitakanji.plan.md` — 제품 전체 Plan
- `docs/01-plan/features/ashitakanji.onigiri-redesign.plan.md` — 오니기리 보상 (별개 시스템)
- 레퍼런스: https://poke-holo.simey.me/ (홀로 연출 컨셉)

---

## 2. Scope

### 2.1 In Scope

| # | 항목 |
|---|---|
| 1 | 고양이 도감 **시즌1 10종** 카탈로그 (이름·설명·등급·품종 매핑·번들 이미지) |
| 2 | 도장 누적 카운터 + 10도장 소진 뽑기 |
| 3 | 등급 확률 뽑기 (tier 완성 시 확률 재분배 + 등급 내 미보유 우선) |
| 4 | 카드 획득 연출 (뒤집기) |
| 5 | 등급별 홀로 연출 (`mixBlendMode` + SVG Mask) |
| 6 | 기울기 연동 (`expo-sensors` DeviceMotion) |
| 7 | 도감 그리드 화면 + 카드 상세 |
| 8 | 카드 이미지 공유 (번들 사진 한정) |
| 9 | TheCatAPI 보너스 사진 (온라인 시에만, 실패해도 무해) |

### 2.2 Out of Scope

| 항목 | 사유 |
|---|---|
| 백엔드 서버 / 계정 동기화 | v1 불필요. 기기 로컬로 충분 |
| 중복 카드 승급·변환 시스템 | 도감 완주 전엔 중복 자체가 드묾 |
| 시즌2 카드 (11종~) | 시즌1 완주 지표 확인 후. **목표: 출시 3개월 내 추가** |
| 친구 도감 비교 / 랭킹 | 서버 필요 |
| `@shopify/react-native-skia` | RN 0.81 네이티브 스타일로 홀로 구현 가능 (§7.2) |

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 |
|---|---|
| FR-01 | 학습 완료한 날마다 출석도장 1개 **누적**. 연속 끊겨도 초기화되지 않는다 |
| FR-02 | 도장 10개 도달 시 뽑기 1회 가능. 뽑으면 도장 10개 차감, 잔여는 이월 |
| FR-03 | 뽑기는 등급을 먼저 확률로 결정하고, 해당 등급 내 **미보유 카드 우선** 선택 |
| FR-04 | 등급 tier가 완주되면 그 tier 가중치를 남은 tier로 정규화 재분배 |
| FR-05 | 모든 등급이 완주되면 중복 획득. 도감엔 "만난 횟수"만 증가 |
| FR-06 | 획득한 카드는 이름·설명·등급·사진과 함께 **영구 저장**된다 |
| FR-07 | 오프라인에서도 뽑기가 반드시 성공한다 (번들 이미지 사용) |
| FR-08 | 온라인이면 TheCatAPI에서 해당 카드의 품종 사진을 받아 갱신 시도. 실패 시 무시 |
| FR-09 | 도감 그리드에서 보유/미보유 카드를 구분해 보여준다. **총 카드 수를 고정 문구로 표기하지 않는다** (시즌 확장 대비) |
| FR-10 | 카드 상세에서 등급별 홀로 효과가 기기 기울기에 반응한다 |
| FR-11 | 번들 사진 카드는 이미지로 저장·공유할 수 있다. API 사진 카드는 공유 비활성 |
| FR-12 | 시즌1 전종 보유 시 "시즌1 완주" 상태를 표시한다. 이후 뽑기는 중복 처리로 계속 동작 |

### 3.2 Non-Functional Requirements

| ID | 요구사항 |
|---|---|
| NFR-01 | 홀로 연출은 저사양 Android에서 **최소 30fps** 유지. 미달 시 정적 그라디언트로 폴백 |
| NFR-02 | `useReducedMotion`이 true면 뒤집기·홀로·기울기 전부 정적 표현으로 대체 |
| NFR-03 | 센서 구독은 카드 화면 진입 시 시작, 이탈 시 즉시 해제 (배터리) |
| NFR-04 | 번들 이미지 10장 추가로 인한 앱 용량 증가 **3MB 이내** |
| NFR-05 | 네트워크 요청 타임아웃 3초. 실패는 조용히 무시하고 번들 사진 유지 |
| NFR-06 | 도감·카드 화면은 기존 `design/tokens` 및 라이트/다크 테마를 따른다 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] SC-01 도장 10개 도달 → 뽑기 → 카드 획득 → 도감 반영이 한 흐름으로 동작
- [ ] SC-02 비행기 모드에서 뽑기 10회 연속 성공 (실패 0건)
- [ ] SC-03 시즌1 10종 전부 보유 상태에서 뽑으면 중복 처리로 정상 종료
- [ ] SC-04 앱 삭제 전까지 획득 카드·사진이 유실되지 않음 (재시작·업데이트 후 검증)
- [ ] SC-05 저사양 Android 실기기에서 홀로 연출 30fps 이상, 미달 시 폴백 동작 확인
- [ ] SC-06 `useReducedMotion` on 상태에서 모든 애니메이션이 정적으로 대체됨
- [ ] SC-07 공유 버튼이 번들 사진 카드에서만 활성화됨

### 4.2 Quality Criteria

- 뽑기 로직 단위 테스트: 확률 재분배 · 미보유 우선 · 도장 차감/이월
- 시뮬레이션 테스트: 2,000회 뽑기로 완주가 정확히 카드 수만큼 걸리고 중복이 0인지 검증 ✅
- 카탈로그 확장 테스트: 카드를 11종 이상으로 늘려도 뽑기·도감이 코드 변경 없이 동작
- 기존 `vitest` 스위트 및 `npm run ci-check` 통과

---

## 5. Risks and Mitigation

| # | 위험 | 영향 | 완화 |
|---|---|---|---|
| R-01 | **첫 네트워크 의존 도입** — 지금까지 완전 오프라인 앱 | 높음 | 번들 이미지를 기본값으로. 네트워크는 순수 보너스. 실패해도 기능 무손실 |
| R-02 | **이미지 권리** — 공유 시 앱이 배포 주체가 됨 | 높음 | 공유는 직접 선정·권리 확인한 번들 24장만 허용. 선정 시 라이선스 근거를 문서에 기록 |
| R-03 | **`mixBlendMode` 성능** — Android 오프스크린 렌더링 | 중간 | 구현 착수 전 실기기 프로토타입으로 프레임 측정. 미달 시 정적 폴백 또는 Skia 재검토 |
| R-04 | **`experimental_backgroundImage` API 변경** | 중간 | Expo SDK 업그레이드 시 회귀 테스트 대상으로 등록. 그라디언트는 SVG로 대체 가능 |
| R-05 | **개인정보 처리방침 미갱신** — 제3자 통신 추가 | 중간 | TheCatAPI 통신을 `site/privacy` 문서에 명시. 스토어 Data Safety 항목 갱신 |
| R-06 | **시즌1 완주 후 보상 공백** — 100일 뒤 중복만 나옴 | 높음 | 완주 후에도 중복이 무해하게 동작(FR-12). **출시 3개월 내 시즌2 추가**를 로드맵에 고정. 미달 시 이탈 구간 발생 |
| R-07 | **개별 이름과 랜덤 사진의 정체성 충돌** | 중간 | 카드마다 품종을 숨은 필드로 매핑. API 사진도 같은 품종에서만 가져옴 |
| R-08 | **저장 공간 누수** — 다운로드 사진 누적 | 낮음 | 카드당 사진 1장만 유지. 갱신 시 이전 파일 삭제 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| 리소스 | 변경 |
|---|---|
| `src/features/cat-card/` | 신규 — catalog, 뽑기 로직, 화면, 컴포넌트 |
| `src/db/migrations/v8.ts` | 신규 — 카드 보유 테이블, 도장 카운터 |
| `src/db/repos/` | 신규 Repo 1개 (기존 `UserCardRepo` 패턴 준용) |
| `src/features/home/components/StreakStamps.tsx` | 수정 — 뽑기 가능 상태 표시 |
| `src/features/stats/StatsScreen.tsx` | 수정 — 도감 진입점 |
| `assets/` | 신규 — 고양이 사진 10장 (WebP) |
| `package.json` | `expo-sensors` 추가 |
| `site/privacy` | 수정 — 제3자 통신 명시 |

### 6.2 Current Consumers

- `StreakStamps`는 홈(`StreakCard`, 7칸)과 기록 탭(10칸) 두 곳에서 쓰임.
  **뽑기 기준은 기록 탭의 10칸.** 홈 7칸은 주간 표시로 역할이 다르므로 건드리지 않는다
- 도장 계산은 `DailyStatsRepo` / `SessionRepo` 기반. 신규 카운터는 여기서 파생

### 6.3 Verification

- `npm run ci-check` (typecheck + vitest + lint)
- 오프라인 시나리오 수동 QA (비행기 모드)
- 저사양 Android 실기기 프레임 측정
- 마이그레이션 v7 → v8 업그레이드 경로 검증 (기존 사용자 데이터 보존)

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

**Dynamic** — 단, 백엔드 없음. 기존 로컬 SQLite 구조를 그대로 확장한다.

### 7.2 Key Architectural Decisions

**AD-01 서버 없음**
이름·설명은 24종 고정 데이터 → `catalog.ts` 상수로 번들.
`src/features/onigiri/catalog.ts`가 동일 패턴(24종, id/name/description/imageKey).
보유 상태는 `expo-sqlite`(마이그레이션 v7 운영 중), 사진은 `expo-file-system`.
→ 서버·DB 신설 불필요.

**AD-02 Skia 불채택**
RN 0.81 스타일이 poke-holo의 CSS 원시 요소를 이미 제공:

| 필요 | RN 0.81 |
|---|---|
| `mix-blend-mode` | `mixBlendMode` (16종. color-dodge / overlay / hard-light / exclusion 포함) |
| `linear-gradient` | `experimental_backgroundImage` |
| `filter` | `filter` (brightness / contrast / saturate / hue-rotate) |
| `mask-image` | `react-native-svg`의 `<Mask>` (설치 완료) |

→ 네이티브 의존성 0개, 용량 증가 0 (Skia는 iOS ~10MB / Android ABI당 ~6MB).
R-03 프레임 측정에서 미달하면 그때 재검토.

**AD-03 등급 확률 + tier 완성 시 재분배**

시즌1은 **3등급**. 10종에 4등급을 쓰면 SR·UR이 각 1종이 되어
"SR이 떴다 = 무조건 그 카드"가 되고 등급이 의미를 잃는다.

```
초기       N 65%  · R 30% · SR  5%      (6 / 3 / 1종)
N 완주 후          R 86% · SR 14%
R 완주 후                  SR 100%
```

등급 결정 후 해당 등급 내 **미보유 우선** 선택.

> **실측 정정 (v0.3)** — 미보유 우선과 tier 재분배를 함께 쓰면 완주 전에는 중복이
> 구조적으로 나올 수 없다. 따라서 완주는 **정확히 카드 수만큼(10뽑기 = 100일)**이고,
> 등급 확률은 완주 시점이 아니라 **획득 순서**만 정한다.
> (`gacha.test.ts` 2,000회 시뮬레이션으로 검증)
>
> 중복을 허용해 완주를 늦추려면 미보유 우선을 확률적으로 약화시켜야 한다.
> 시즌1은 "중복 없이 100일 완주"로 두고, 프로토타입 반응을 보고 결정한다.

초기 SR 5% 확률은 그대로 살아 있어 초반 뽑기 스릴은 유지된다.

**등급 테이블·카드 수는 전부 데이터.** 시즌2에서 종 수를 늘리거나
4등급으로 확장해도 `gacha.ts` 로직은 그대로 쓴다.

**AD-04 개별 이름 + 숨은 품종 매핑**
카드는 개별 고양이(예: `타마`)로 제시하고 이름·설명은 창작.
각 카드에 품종을 숨은 필드로 매핑(`타마 → Russian Blue`)해 API 사진을 그 품종으로 한정.
→ "같은 고양이의 다른 순간"으로 읽혀 정체성이 유지된다.

**AD-05 오프라인 우선**
번들 사진이 기본, API 사진은 덮어쓰기 보너스.
앱의 기존 완전 오프라인 성격을 깨지 않고, API 종료·다운에도 기능이 무손실.

**AD-06 기울기 처리**
`DeviceMotion` 사용, 권한 불필요.
- **상대 기울기**: 카드가 열리는 순간의 자세를 0점으로. 누워서 봐도 정상 동작. 길게 눌러 재보정
- **드리프트 방지**: 자이로 적분 대신 가속도계 중력 벡터 기준 + low-pass 필터
- **샘플링**: 30~40Hz (60Hz 불필요)

### 7.3 Clean Architecture Approach

```
src/features/cat-card/
  catalog.ts          카드 고정 데이터 (id/name/description/rarity/breed/imageKey/season)
  types.ts
  gacha.ts            순수 함수 — 확률 재분배 + 미보유 우선 선택
  gacha.test.ts       단위 + 시뮬레이션 테스트
  stampCycle.ts       도장 누적/차감/이월 계산
  photoService.ts     번들 폴백 + TheCatAPI 갱신 + 파일 저장
  DexScreen.tsx       도감 그리드
  components/
    CatCard.tsx       카드 본체
    HoloLayer.tsx     mixBlendMode + SVG Mask
    useTilt.ts        DeviceMotion 훅
    CardReveal.tsx    뒤집기 연출
```

뽑기 로직은 순수 함수로 분리해 UI·DB 없이 테스트 가능하게 한다.
`gacha.ts`는 카탈로그와 등급 테이블을 인자로 받는다 — 종 수·등급 수를 하드코딩하지 않는다.

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- 기능 단위 `src/features/{name}/` 구성
- 카탈로그 상수는 `catalog.ts`, 타입은 `types.ts`
- 테마·간격은 `~/design/tokens`, `useThemedStyles`
- 애니메이션은 `useReducedMotion` 필수 확인
- 테스트는 `vitest`, 파일명 `*.test.ts`
- DB 변경은 `src/db/migrations/vN.ts` 추가

### 8.2 Conventions to Define/Verify

- [ ] 카드 id 체계 (시즌1 `cat-001` ~ `cat-010`, 시즌2는 `cat-011`~ 로 이어붙임. 진행도가 매달리므로 변경 금지)
- [ ] 등급 표기 통일 (시즌1 내부 `N/R/SR` ↔ 사용자 노출 문구)
- [ ] 사진 파일 저장 경로·명명 규칙
- [ ] 번들 이미지 규격 (해상도·WebP 품질·용량 상한)

### 8.3 Environment Variables Needed

- `THE_CAT_API_KEY` — `app.config.js`의 `extra`로 주입.
  무료 키이며 클라이언트 노출 시 실질 손해 없음. 프록시 서버 불필요

### 8.4 Pipeline Integration

Phase 1(스키마) → Phase 3(목업) → Phase 5(디자인 시스템) → Phase 6(UI 통합) 순.
백엔드 없으므로 Phase 4는 건너뜀.

---

## 9. Next Steps

| 순서 | 작업 | 비고 |
|---|---|---|
| 1 | 고양이 사진 **10장** 선정 + 라이선스 근거 기록 | **사용자 직접 진행** |
| 2 | 10종 이름·설명·등급·품종 매핑 확정 | 사진 선정과 함께 |
| 3 | `mixBlendMode` 저사양 Android 프로토타입 프레임 측정 | R-03 해소. 3단계 착수 전 필수 |
| 4 | `/pdca design cat-card-reward` | 설계 문서 |

**구현 순서** (Design에서 모듈로 분해):

| 모듈 | 내용 |
|---|---|
| M1 | catalog(10종) + SQLite v8 + 뽑기 로직 (테스트 포함) |
| M2 | 카드 뒤집기 연출 + 등급별 테두리 + 도감 그리드 |
| M3 | 홀로 + 기울기 (한 덩어리). 등급 3종 연출 |
| M4 | 공유 (번들 사진 한정) |

M1·M2 없이는 M3·M4를 얹을 곳이 없다. 순서 고정.

---

## Version History

| 버전 | 날짜 | 변경 |
|---|---|---|
| v0.1 | 2026-09-07 | 최초 작성. 기획 확정 사항 반영 |
| v0.2 | 2026-09-07 | 시즌1 10종으로 축소. 등급 3단계. 도감 총량 표기 금지. 시즌2 데드라인 명문화 |
| v0.3 | 2026-09-07 | 프로토타입 실측 반영 — 완주 = 정확히 10뽑기(100일), 완주 전 중복 0 |
