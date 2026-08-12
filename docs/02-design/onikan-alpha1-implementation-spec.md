# Onikan 최신 디자인 → AshitaKanji 구현 스펙

> 대상 프로젝트: `/Users/tyoung/AshitaKanji`  
> 디자인 기준 저장소: `/Users/tyoung/dev/onikan` (읽기 전용)  
> 디자인 기준 커밋: `main@a2379f2`  
> 앱 분석 기준 커밋: `codex/jlpt-phrase-review@a8f97f2`  
> 작성일: 2026-08-12  
> 상태: 다음 명령에서 구현 가능한 수준으로 분석 완료

## 1. 목표

최신 Onikan 디자인을 **디자인 저장소가 아니라 AshitaKanji 앱 코드에 적용**한다.

구현 순서는 다음 네 묶음이다.

1. alpha.1 공통 토큰과 Pretendard JP
2. 학습 완료 보상 인터랙션
3. 기록 탭의 통계형 화면과 모션
4. 설정 탭의 공통 디자인 시스템 정합화

디자인 저장소는 근거 자료로만 읽고 수정하지 않는다.

## 2. 디자인 근거와 적용 우선순위

### 2.1 근거 파일

| 범위 | 디자인 근거 |
|---|---|
| 전역 색·타입·컴포넌트 의미 | `/Users/tyoung/dev/onikan/DESIGN.md` |
| 확정 화면 구성과 공통 탭바 | `/Users/tyoung/dev/onikan/handoff/README.md` 및 `handoff/screens/` |
| 완료 보상과 기록 화면 모션 | `/Users/tyoung/dev/onikan/handoff/interactions/MOTION.md` |
| 동작 예시 | `/Users/tyoung/dev/onikan/handoff/interactions/onikan-interactions.html` |
| 현재 앱 기능과 데이터 계약 | AshitaKanji의 `src/`, `app/`, SQLite 스키마와 테스트 |

### 2.2 충돌 해결 규칙

1. 전역 토큰과 글꼴은 `DESIGN.md` alpha.1 정의를 따른다.
2. 특정 화면·컴포넌트는 더 구체적인 handoff와 화면 시안을 따른다.
3. 추가된 완료 보상·기록 동작은 `MOTION.md`를 따른다.
4. handoff에서 “신규 제안”인 통계형 기록은 사용자가 이번 적용 범위로 명시했으므로 앱 구현안으로 채택한다.
5. 디자인에 데이터 의미가 없거나 현재 앱 기능과 충돌하면 가짜 기능을 만들지 않는다. 시각 구조는 유지하고 실제 앱 데이터에 연결하며, 변경된 의미를 이 문서에 고정한다.
6. 디자인 자료에 없는 설정 전용 레이아웃은 추측하지 않는다. 현재 기능·순서를 유지하며 전역 규칙으로 확정 가능한 부분만 변경한다.

### 2.3 탭바 문서 충돌

`DESIGN.md`의 오래된 설명에는 “텍스트 탭 + 밑줄”이 남아 있지만, 최신 handoff는 다음을 명시한다.

- 26px 아이콘 + 12px 라벨
- 활성 `tabActive`, 비활성 `body`
- 면·배지·밑줄 없이 틴트만 사용
- 설정 슬라이더 아이콘의 노브는 `softer`로 채움

현재 `AppTabBar`는 최신 handoff와 이미 일치한다. 탭바를 텍스트 전용으로 되돌리지 않고 회귀 테스트만 한다.

## 3. 설정 탭 포함 범위에 대한 확인

설정 탭은 이번 구현 범위에 **포함한다**.

다만 디자인 기준 커밋 `a2379f2`에는 설정의 독립 화면 프레임·스크린샷·인터랙션 시안이 없다. handoff도 설정 탭을 “아직 설계되지 않은 항목”으로 적고 있다. 존재하는 설정 관련 근거는 다음뿐이다.

- 공통 하단 탭의 설정 아이콘과 활성/비활성 규칙
- 시스템 테마를 따르되 설정에서 라이트/다크를 수동 전환한다는 기능
- 전역 토큰, 타이포, 간격, 터치 타깃, 다크 모드 규칙
- 설정 같은 목록형 화면에 적용하는 셰브론 관례

따라서 이번 설정 작업은 다음처럼 제한한다.

- 기존 설정 항목, 순서, 저장 동작, 경고, 내보내기, 정보 화면 이동을 모두 보존한다.
- alpha.1 토큰, 한글 화면 제목, 간격, 선택 상태, 최소 터치 타깃, 접근성을 적용한다.
- 새로운 카드 구성, 삽화, 설정 항목, 애니메이션은 만들지 않는다.
- 별도 설정 시안이 추가되면 이 범위를 다시 대조한다.

## 4. 현재 앱과의 갭

| 영역 | 현재 AshitaKanji | 최신 디자인 | 구현 판정 |
|---|---|---|---|
| 글꼴 | plain Pretendard OTF 5종 | Pretendard JP 400–800 | 교체 필수 |
| 회색 램프 | `g98`, `g70` 없음 | 두 토큰 추가 | 수정 필수 |
| 전경 토큰 | `onPrimary`만 있고 `onInk` 없음 | 두 토큰을 용도별 분리 | 수정 필수 |
| 라이트 `onPrimary` | 흰색 | `#1D1D21` | 수정 필수 |
| 상태색 | 일부 alpha 값 고정 | 모드별 AA 값 | 수정 필수 |
| 잉크 배경 전경 | `canvas`/`softer`를 문맥별로 임시 사용 | `onInk` | 전역 감사 필수 |
| 토스트 | 하드코딩 검정/흰색, 시스템 폰트 | `ink`/`onInk`, 디자인 타입 | 수정 필수 |
| 완료 화면 | 기본 rise/pop 위주 | 약 1.8초 보상 시퀀스 | 확장 필수 |
| 기록 탭 | streak·6 KPI·레벨 진행도 | 점수·스트릭·2×2·분포·CTA | 교체 필수 |
| 설정 제목 | `SETTINGS` 32/40 | 한글 `설정` 36/44 | 수정 |
| 설정 선택 전경 | `canvas` | `onInk` | 수정 필수 |
| 설정 터치 타깃 | 일부 40px | 최소 44px | 수정 필수 |
| 설정 보조색 | 셰브론·고지에 `mute` 사용 | 일반 정보는 `body`, `mute`는 잠김 전용 | 수정 필수 |
| 탭바 | 최신 handoff와 일치 | 아이콘+틴트 | 유지 |

## 5. 작업 W0 — alpha.1 공통 기반

W1–W3보다 먼저 끝낸다. 후속 화면들이 새 토큰과 글꼴을 기준으로 작성되어야 하기 때문이다.

### 5.1 Pretendard JP

공식 Pretendard JP 정적 OTF 5종을 앱 번들에 둔다.

| 굵기 | 앱 패밀리 키 | 파일 |
|---|---|---|
| 400 | `PretendardJP-Regular` | `assets/fonts/PretendardJP-Regular.otf` |
| 500 | `PretendardJP-Medium` | `assets/fonts/PretendardJP-Medium.otf` |
| 600 | `PretendardJP-SemiBold` | `assets/fonts/PretendardJP-SemiBold.otf` |
| 700 | `PretendardJP-Bold` | `assets/fonts/PretendardJP-Bold.otf` |
| 800 | `PretendardJP-ExtraBold` | `assets/fonts/PretendardJP-ExtraBold.otf` |

구현 규칙:

- 공식 `pretendard-jp` 1.3.9 정적 배포 파일을 사용한다.
- 런타임 CDN 로딩은 하지 않는다.
- `app/_layout.tsx`의 `useFonts` 키와 `src/design/tokens.ts`의 `font` 값을 모두 `PretendardJP-*`로 맞춘다.
- 새 폰트 로드와 한자 표시 확인 후 참조가 사라진 기존 `Pretendard-*.otf`만 제거한다.
- `AboutScreen` 라이선스 목록에 “Pretendard JP / SIL Open Font License 1.1”을 추가한다.
- 구현 시 받은 파일의 SHA-256을 작업 결과에 남긴다.

공식 근거:

- [Pretendard JP static files](https://github.com/orioncactus/pretendard/tree/main/packages/pretendard-jp/dist/public/static)
- [Pretendard JP package metadata](https://github.com/orioncactus/pretendard/blob/main/packages/pretendard-jp/package.json)

시각 검증 문자열은 `漢字 運 質 問 かな 한글 ABC 0123`으로 고정한다. 한자, 가나, 한글, 라틴이 모두 새 패밀리로 렌더되어야 한다.

### 5.2 토큰의 정확한 값

`src/design/tokens.ts`에 다음을 반영한다.

회색 램프 추가:

```ts
g98: '#F7F7F9'
g70: '#A9A9B2'
```

`ThemeColors` 추가:

```ts
onInk: string
```

라이트:

```ts
onPrimary: '#1D1D21'
onInk: '#F7F7F9'
success: '#15803D'
warning: '#B45309'
danger: '#DC2626'
info: '#2563EB'
```

다크:

```ts
ink: '#F7F7F9'
body: '#A9A9B2'
onPrimary: '#1D1D21'
onInk: '#1D1D21'
success: '#22C55E'
warning: '#F59E0B'
danger: '#F87171'
info: '#60A5FA'
```

기존 `primary`, `primaryPressed`, `tabActive`, `secondary` 등 나머지 값은 디자인 정의와 현재 구현이 일치하는지 함께 대조하되 임의로 재설계하지 않는다.

### 5.3 전경색 의미 감사

일괄 문자열 치환을 하지 않고 배경 의미를 보고 고친다.

- 주황 `primary` 배경 위 글자/아이콘 → `onPrimary`
- `ink` 배경 위 글자/아이콘 → `onInk`
- `canvas`는 카드 면이며 전경색 대용으로 사용하지 않음
- `softer`는 페이지 면이며 전경색 대용으로 사용하지 않음
- `mute`는 잠김·플레이스홀더만 사용

최소 감사 대상:

- `src/components/ui/Button.tsx`의 `inkLabel`
- `src/components/Toast.tsx`
- `src/features/scan/ScanScreen.tsx`의 잉크 선택 칩
- `src/features/reading/ReadingStudyScreen.tsx`의 잉크 버튼
- `src/features/reading/ReadingChaptersScreen.tsx`의 선택 레벨
- `src/features/word/WordDetailScreen.tsx`의 잉크 액션
- `src/features/settings/SettingsScreen.tsx`의 선택 칩과 스위치
- 새 기록·완료 컴포넌트

완료 시 다음 검색 결과에서 “전경색으로 사용된 `canvas`/`softer`”가 없어야 한다. 면 배경 용도는 유지한다.

```sh
rg -n "color: c\.(canvas|softer)|color: colors\.(canvas|softer)" src app
```

### 5.4 토스트

`ToastOverlay`를 테마 토큰 기반으로 변경한다.

- 배경 `ink`
- 글자 `onInk`
- `typography.bodyStrong` 또는 동일한 15/22/600
- 기존 iOS `FullWindowOverlay`, 타이머, 터치 비차단 동작은 보존
- 화면 읽기 도구가 새 메시지를 알 수 있도록 `accessibilityLiveRegion="polite"` 적용
- 하드코딩 `rgba(28,28,30,0.95)`와 `#fff` 제거

## 6. 작업 W1 — 완료 보상 인터랙션

### 6.1 보존해야 하는 기존 기능

`DoneScreen`의 다음 로직은 UI 개편 중에도 유지한다.

- `buildOnigiriProgressService()`로 현재 보상 조회
- 현재 세션과 `lastReward.sessionId` 일치 여부 확인
- `buildDoneRewardPresentation()`의 획득/완성/전체 수집/실패 문구 분기
- `SessionStore` 요약의 신규·복습·Again·Good/Easy 값
- 영수증 열기, 캡처, 앨범 저장, 공유, 홈 이동
- 보상 없는 완료 상태와 전체 컬렉션 완료 상태
- `useReducedMotion()`

### 6.2 화면 구조

위에서 아래 순서를 다음으로 고정한다.

1. 오버라인 `오늘의 학습`
2. 제목 `다 했어요`
3. 재료 카드: 재료 아트, 라임 체크, `새 재료`, 재료명, 설명
4. 레시피 진행: 레시피명, `획득 수 / 4`, 진행 셀, 안내
5. 통계 두 행: `새로 배운 단어`, `아직이라고 표시한 단어`
6. 안내문
7. 화면 유일 오렌지 CTA `영수증 받고 마치기`

기존 영수증 화면은 CTA 뒤의 두 번째 상태로 유지한다.

### 6.3 컴포넌트와 순수 로직 분리

권장 파일:

- 수정 `src/features/done/DoneScreen.tsx`
- 신규 `src/features/done/components/RewardBurst.tsx`
- 신규 `src/components/ui/AnimatedNumber.tsx`
- 신규 `src/features/done/rewardMotion.ts`
- 신규 `src/features/done/rewardMotion.test.ts`
- 필요 시 수정 `src/design/icons.tsx`의 체크 경로 재사용

`rewardMotion.ts`에는 타임라인 상수와 보간 함수만 둔다. 보상/세션 조회를 넣지 않는다.

### 6.4 정확한 타임라인

| 시작 | 길이 | 대상 | 최종 동작 |
|---:|---:|---|---|
| 50ms | 420ms | 재료 아트 | opacity 0→1, scale 0.8→1, 작은 오버슈트 |
| 340ms | 440ms | 체크 뱃지 | scale 0.3→1.15→1 |
| 340ms | 300ms | 체크 선 | stroke draw |
| 420ms | 700ms | 라임 링 | scale 0.7→2.1, opacity 0.55→0, 1회 |
| 420ms | 500ms | 스파크 5개 | 방사 이동, 라임 opacity는 250ms 안에 0 |
| 550ms | 500ms | 레시피 블록 | opacity 0→1, translateY 10→0 |
| 700ms | 600ms | 새 진행 셀 | outline→lime→ink |
| 700ms | 550ms | 진행 수·새 단어 수 | 0→목표, easeOutCubic |
| 1150ms | 400ms | 안내문 | opacity 0→1 |
| 1250ms | 450ms | CTA | opacity 0→1, translateY 24→0 |

스파크 벡터는 정확히 5개만 사용한다.

```ts
[
  { x: -34, y: -30 },
  { x: 30, y: -34 },
  { x: -40, y: 14 },
  { x: 38, y: 20 },
  { x: 0, y: -44 },
]
```

추가 규칙:

- 콘페티, 반복 파티클, 무한 펄스는 금지한다.
- 라임은 체크, 링, 스파크, 방금 획득한 진행 셀에만 쓴다.
- 숫자는 tabular figures를 유지한다.
- 애니메이션 키는 `sessionId + reward item id + ingredientIndex` 조합이다.
- 같은 마운트에서 영수증을 열었다 닫아도 보상 시퀀스를 재실행하지 않는다.
- 언마운트 시 listener와 animation을 모두 정리한다.
- 보상이 없으면 체크·링·스파크·라임 진행 셀을 렌더하지 않는다.
- `crafted` 상태도 재료 획득이 있으면 같은 시퀀스를 쓰고 기존 완성 문구를 보존한다.

### 6.5 모션 감소

`useReducedMotion() === true`이면:

- 카운트업, 체크 드로잉, 링, 스파크, 진행 셀 펄스를 실행하지 않는다.
- 모든 값은 즉시 최종값으로 둔다.
- 전체 콘텐츠에 150ms 이하의 단일 opacity 페이드만 허용한다.
- 레이아웃과 정보량은 일반 모드와 같아야 한다.

## 7. 작업 W2 — 기록 탭

### 7.1 라우트와 화면 성격

기존 `app/(tabs)/stats.tsx` 라우트와 탭 이름은 유지한다. 내부 `StatsScreen`을 통계형 기록 화면으로 교체한다.

앱에서는 영구 하단 탭으로 진입하므로 프로토타입의 닫기 버튼을 사용하지 않는다. 공유·더보기·셰브론도 실제 동작 대상이 없으면 표시하지 않는다. 눌리지 않는 인터랙션 암시는 금지한다.

### 7.2 화면 구조

1. 스크럽되는 큰 제목 `기록`과 sticky 인라인 제목
2. 최근 완료 학습 점수 카드
3. 연속 학습 카드와 이번 주 월–일 체크
4. 누적 통계 2×2 타일
5. 내 과거 학습 점수 분포 카드
6. 화면 유일 오렌지 CTA `지금 연습하기`

카드 그룹 간격은 28px, 같은 카드 내부 요소는 12px 또는 16px을 사용한다. 카드 안에 별도 카드를 중첩하지 않고 카드당 히어로 숫자는 하나만 둔다.

### 7.3 앱 데이터 계약

신규 타입을 `src/features/stats/recordTypes.ts`에 둔다.

```ts
export interface SessionScore {
  sessionId: number;
  correct: number;
  total: number;
  percent: number;
  endedAt: number;
}

export interface WeekDayActivity {
  date: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  active: boolean;
}

export interface RecordTotals {
  learnedWords: number;
  reviews: number;
  again: number;
  completedSessions: number;
}

export type PersonalComparison =
  | {
      kind: 'ready';
      percentile: number;
      mean: number;
      samples: readonly number[];
    }
  | {
      kind: 'insufficient';
      sampleCount: number;
    };

export interface RecordSnapshot {
  latest: SessionScore | null;
  streakDays: number;
  week: readonly WeekDayActivity[];
  totals: RecordTotals;
  comparison: PersonalComparison;
}
```

화면 상태는 `loading | ready | empty | error` 네 가지를 명시적으로 렌더한다. `latest === null`은 첫 학습용 empty 상태이며 네트워크 오류처럼 보이면 안 된다.

### 7.4 점수 계산

소스는 `session`과 `review_log`다.

- `ended_reason === 'completed'`인 세션만 대상
- 세션별 `review_log.session_id`로 그룹화
- 분모는 해당 세션의 로그 수
- 분자는 `Grade.Good` 또는 `Grade.Easy` 수
- 로그가 0개인 완료 세션은 점수 카드와 분포에서 제외
- 퍼센트는 `correct / total * 100`
- 최근 세션 정렬은 `ended_at DESC`, 동률이면 `started_at DESC`, 다시 동률이면 `id DESC`
- 날짜 표시는 기기 로컬 시간대 기준
- 화면 표시 `16 / 30`은 정수 원자료, 차트는 0–100 퍼센트를 사용

`ReviewLogRepo.findBySession`을 세션 수만큼 호출하지 않는다. `findAll` 한 번의 결과를 메모리에서 그룹화한다.

### 7.5 통계 타일의 실제 앱 매핑

디자인 프로토타입의 `즐겨찾기`, `저장`은 현재 앱 스키마와 기능에 존재하지 않는다. 화면 구조를 유지하되 가짜 숫자를 만들지 않고 아래 네 지표를 사용한다.

| 타일 | 값 |
|---|---|
| 읽은 단어 | 누적 신규 학습 수 `overall.totalNew` |
| 복습 | 누적 복습 수 `overall.totalReview` |
| 다시 본 것 | 누적 Again 수 `overall.totalAgain` |
| 학습 | 완료 세션 수 |

향후 즐겨찾기·저장 기능이 실제로 생기면 별도 제품 스펙과 DB 마이그레이션 후 타일 의미를 다시 바꾼다. 이번 디자인 적용에서는 새 데이터 모델을 만들지 않는다.

### 7.6 분포 카드의 실제 앱 매핑

앱은 로컬 전용이며 전체 사용자 점수 데이터나 백엔드가 없다. 따라서 `전체 학습자의 4%` 같은 모집단 문구를 표시하지 않는다.

- 비교 대상: 현재 세션 이전의 완료 세션 점수
- 이전 점수가 3개 이상이면 분포와 퍼센타일 표시
- 퍼센타일: `100 * (현재보다 낮은 이전 점수 수 / 이전 점수 수)`
- 동점은 “앞섰다”에 포함하지 않음
- 표시 문구: `지난 학습 기록의 N%보다 높아요`
- 이전 점수가 3개 미만이면 `학습 기록이 쌓이면 비교할 수 있어요`
- 평균 점선은 이전 점수의 산술평균
- `나` 마커는 현재 점수 위치

이 변경은 디자인 파일 수정이 아니라 AshitaKanji의 실제 데이터 바인딩 규칙이다.

### 7.7 분포 곡선

순수 함수는 `src/features/stats/recordChart.ts`에 둔다.

- x 범위 0–100
- 2.5 간격, 총 41개 샘플
- Gaussian kernel bandwidth 12
- 각 x의 원시 밀도: 모든 점수에 대해 `exp(-0.5 * ((x - score) / 12)^2)` 합산
- 최대 밀도로 나눠 0–1 정규화
- 권장 차트 높이 150
- plot y 범위 20–132, 좌우 inset 8
- SVG 면과 선은 잉크/그레이만 사용하고 그라데이션은 사용하지 않음
- `vectorEffect="non-scaling-stroke"`로 선 굵기 유지
- 곡선 드로잉은 clip rect의 폭을 0→전체로 확장
- `나` 마커는 SVG 밖의 React Native 원으로 렌더
- 마커 y는 같은 KDE 함수의 현재 점수 밀도를 사용해 계산하여 경로와 일치시킴
- 레이아웃 폭이 바뀌면 x/y를 다시 계산

### 7.8 서비스 구성

권장 파일:

- 수정 `src/features/stats/StatsScreen.tsx`
- 신규 `src/features/stats/RecordService.ts`
- 신규 `src/features/stats/buildRecordService.ts`
- 신규 `src/features/stats/recordTypes.ts`
- 신규 `src/features/stats/recordChart.ts`
- 신규 `src/features/stats/RecordService.test.ts`
- 신규 `src/features/stats/recordChart.test.ts`
- 필요 시 공통 카드 컴포넌트는 `src/features/stats/components/` 아래 배치

`RecordService.load(nowMs)`는 다음 순서로 동작한다.

1. 기존 `StatsRollupService.rollup()` 실행
2. `daily_stats`, `session`, `review_log`를 각각 한 번 조회
3. 세션 점수, streak, 주간 활동, 누적값, 개인 분포를 메모리에서 계산
4. 정렬된 불변 view model 반환

SQLite 마이그레이션은 추가하지 않는다.

### 7.9 스크롤과 진입 모션

- 스크롤 값 `t = clamp(scrollY / 48, 0, 1)`
- 큰 제목: opacity 1→0, translateY 0→-8, scale 1→0.88
- 인라인 제목: opacity 0→1
- `scrollY > 6`이면 sticky header hairline 표시
- header는 `expo-blur`의 `BlurView`를 사용하고 테마에 맞는 tint를 선택
- blur를 사용할 수 없는 플랫폼에서는 반투명 `softer` 면으로 폴백
- 카드 등장: opacity 0→1, translateY 12→0
- 카드 딜레이: 50ms부터 마지막 카드 420ms까지 순차
- 숫자 카운트업: 550ms, easeOutCubic, tabular figures
- 주간 라임 체크: 활동일만 왼쪽부터 60ms 간격 팝
- 곡선 reveal: 700ms, 500ms 지연
- `나` 마커: 1100ms에 1회 팝
- 라임은 주간 달성 체크에만 사용

`expo-blur`는 버전을 직접 추정하지 않고 구현 시 다음 명령으로 현재 Expo SDK와 맞춘다.

```sh
npx expo install expo-blur
```

모션 감소가 켜지면 모든 값과 차트를 최종 상태로 즉시 표시하고 150ms 이하의 전체 페이드만 허용한다.

### 7.10 CTA 라우팅

`지금 연습하기`는 홈의 큐 판정과 다른 로직을 만들지 않는다.

현재 `HomeScreen` 안의 `loadTodayCounts`와 시작 경로 판정을 공통 모듈로 추출한다.

권장 파일:

- 신규 `src/features/study/resolveStudyEntry.ts`
- 신규 `src/features/study/resolveStudyEntry.test.ts`
- 수정 `src/features/home/HomeScreen.tsx`

규칙:

- 오늘의 due 또는 신규 카드가 하나 이상 → `/study`
- 둘 다 0 → `/weakness`
- 설정의 선택 레벨과 일일 신규 한도를 그대로 사용
- 판정 중 중복 탭 방지와 로딩 상태 표시
- 실패 시 CTA를 조용히 무시하지 말고 토스트 후 재시도 가능 상태로 복귀

## 8. 작업 W3 — 설정 탭

### 8.1 보존 계약

`src/features/settings/SettingsScreen.tsx`의 다음 기능을 그대로 보존한다.

- JLPT 복수 레벨 선택, 최소 1개 유지
- 하루 신규 5–50개 stepper
- 30개 초과 진입 시 고강도 확인 경고 1회
- TTS 켜기
- TTS가 켜졌을 때 뜻 확인 자동 재생 설정
- TTS 속도 0.5–1.5
- 테마 `system | light | dark`
- JSON 백업 생성·공유와 성공/실패 Alert
- `/about` 이동
- 모든 설정의 기존 `SettingsStore` 영속화

설정 항목을 추가·삭제하거나 저장 키를 바꾸지 않는다. DB 마이그레이션도 없다.

### 8.2 확정 가능한 시각 변경

- 화면 제목 `SETTINGS` → `설정`
- 제목은 `typography.screenTitle` 36/44/700
- 배경 `softer`
- 좌우 gutter 20px, 상단 28px
- 섹션 사이는 28px로 분리
- 섹션 내부 제목·힌트·컨트롤은 proximity로 묶음
- 현재의 반복적인 상단 구분선은 제거하고 간격으로 그룹을 구분
- 새 카드 면이나 그림자는 추가하지 않음
- 선택된 레벨/테마: 배경 `ink`, 글자 `onInk`
- 비선택: 테두리 `pressed`, 글자 `body`
- 눌림: `soft`
- 고강도 안내: `warning`
- 정보 셰브론과 로컬 저장 안내: `body`
- `mute`는 disabled/placeholder 외에는 사용하지 않음
- 백업 버튼은 중립 outline 유지. 설정 화면의 관리 기능을 오렌지 전환 CTA로 만들지 않음
- 탭바 설정 아이콘은 현재 구현을 유지

### 8.3 컨트롤과 접근성

- 모든 Pressable 최소 높이/너비 44px
- 현재 40×40 stepper 버튼은 44×44로 변경
- 레벨 칩도 `minHeight: 44`
- Switch 활성 track `ink`, 활성 thumb `onInk`
- Switch 비활성 track `pressed`, 비활성 thumb `canvas`
- 각 stepper는 문맥을 포함한 라벨과 현재 값을 제공
  - `하루 새 단어 감소/증가, 현재 N개`
  - `발음 속도 감소/증가, 현재 Nx`
- disabled 버튼에 `accessibilityState.disabled` 제공
- 선택 칩에 `accessibilityState.selected` 유지
- 백업 중 버튼에 disabled/busy 의미와 중복 실행 차단 유지
- TTS 하위 옵션은 TTS가 꺼졌을 때 현재처럼 렌더하지 않음
- 동적 글자 크기에서 라벨이 잘리지 않도록 고정 height 대신 minHeight 사용

### 8.4 설정에서 하지 않을 것

설정 전용 디자인 근거가 추가되기 전에는 다음을 하지 않는다.

- 설정을 카드 대시보드로 재구성
- 항목 순서 변경
- 신규 아이콘·삽화·헤더 모션 추가
- 온보딩·알림 항목 추가
- 디자인에 없는 destructive data reset 추가
- 현재 동작하는 시스템/라이트/다크 선택 제거

## 9. 예상 파일 변경표

| 파일 | 변경 |
|---|---|
| `docs/02-design/onikan-alpha1-implementation-spec.md` | 이 구현 계약 |
| `assets/fonts/PretendardJP-*.otf` | 공식 JP 폰트 추가 |
| `app/_layout.tsx` | JP 폰트 로드 |
| `src/design/tokens.ts` | alpha.1 토큰과 font key |
| `src/design/tokens.test.ts` | 정확한 모드별 값 회귀 |
| `src/components/ui/Button.tsx` | `onInk` |
| `src/components/Toast.tsx` | 테마 토큰과 접근성 |
| `src/features/about/AboutScreen.tsx` | 폰트 라이선스 |
| `src/features/done/DoneScreen.tsx` | 보상 시퀀스 배선 |
| `src/features/done/components/RewardBurst.tsx` | 체크·링·스파크 |
| `src/features/done/rewardMotion.ts` | 순수 타임라인 |
| `src/components/ui/AnimatedNumber.tsx` | 숫자 카운트업 |
| `src/features/stats/StatsScreen.tsx` | 기록 화면 |
| `src/features/stats/RecordService.ts` | 기록 view model 계산 |
| `src/features/stats/buildRecordService.ts` | SQLite 의존성 조립 |
| `src/features/stats/recordTypes.ts` | 기록 타입 |
| `src/features/stats/recordChart.ts` | 분포 계산 |
| `src/features/study/resolveStudyEntry.ts` | 홈/기록 CTA 공통 판정 |
| `src/features/home/HomeScreen.tsx` | 공통 판정 사용 |
| `src/features/settings/SettingsScreen.tsx` | 설정 공통 디자인 정합화 |
| `package.json`, `package-lock.json` | Expo 호환 `expo-blur` |
| 전경색 감사 대상 화면 | `canvas/softer` 오용을 `onInk/onPrimary`로 교정 |

기존 plain Pretendard 파일은 JP 폰트 로드와 검색 검증이 끝난 뒤에만 제거한다.

## 10. 테스트 계획

현재 Vitest 설정은 `src/**/*.test.ts`의 순수 TypeScript 테스트만 실행한다. 이번 작업에서 별도 RN 컴포넌트 테스트 러너를 도입하지 않는다.

### 10.1 자동 테스트

`tokens.test.ts`:

- `g98`, `g70` 정확한 값
- 라이트/다크 `onPrimary`, `onInk`
- 8개 모드별 상태색
- font family가 모두 `PretendardJP-`로 시작

`rewardMotion.test.ts`:

- 시작/종료 시간과 총 시퀀스 범위
- easeOutCubic의 0, 중간, 1
- 스파크가 정확히 5개
- reduced motion 최종값
- reward 없음에서 lime effect 비활성

`RecordService.test.ts`:

- 완료 세션만 포함
- 0로그 세션 제외
- Good/Easy 분자 계산
- 최신 세션 결정 tie-break
- 월–일 주간 활동과 로컬 날짜 경계
- 오늘 미학습일 때 어제까지 streak 보존
- 누적 4개 타일
- 과거 3개 미만 insufficient
- 동점을 앞선 기록으로 세지 않는 퍼센타일
- repo별 정해진 횟수만 조회하여 N+1 없음
- 빈 데이터와 저장소 오류

`recordChart.test.ts`:

- 41개 점 생성
- x가 0, 2.5, …, 100
- 모든 density가 0–1
- 평균과 현재 마커가 범위 안
- 동일 점수·극단 점수에서도 NaN 없음

`resolveStudyEntry.test.ts`:

- due > 0 → `/study`
- new > 0 → `/study`
- 둘 다 0 → `/weakness`
- 선택 레벨 필터 유지

기존 회귀:

- `rewardPresentation.test.ts`
- `StatsRollupService.test.ts`
- `exportPayload.test.ts`
- `SettingsStore` 관련 기존 동작
- 전체 `npm run ci-check`

### 10.2 수동 시각·동작 QA

환경 조합:

- iOS / Android
- light / dark / system
- 기본 글자 크기 / 큰 글자 크기
- 모션 허용 / 모션 감소
- 작은 화면 폭 320–360 / 일반 화면 / 긴 화면
- 홈 인디케이터가 있는 기기와 없는 기기

필수 시나리오:

1. 한자가 포함된 학습 카드와 상세 화면에서 JP 글리프가 비지 않음
2. 주황 버튼 글자가 라이트·다크 모두 잉크색으로 읽힘
3. 잉크 칩 글자가 두 모드 모두 반전되어 읽힘
4. 완료 보상이 세션당 한 번만 재생
5. 영수증 열기/닫기로 보상 모션이 반복되지 않음
6. 보상 없음·전체 수집·보상 조회 실패에서도 CTA 사용 가능
7. 기록 진입, 스크롤 title collapse, 카드 스태거, 차트 reveal
8. 기록이 0개/1개/3개 이상일 때 각각 올바른 empty/comparison 상태
9. 기록 CTA가 홈과 같은 경로로 이동
10. 설정의 모든 기존 값이 앱 재시작 후 유지
11. 고강도 경고가 기존 조건에서 한 번만 노출
12. TTS가 꺼지면 자동 재생·속도 옵션이 숨겨짐
13. 테마를 system/light/dark로 바꾸면 즉시 반영
14. JSON 백업 성공/실패와 중복 탭 방지
15. 설정 stepper와 선택 칩 터치 영역이 최소 44px
16. 네 탭 아이콘·라벨이 밑줄 없이 틴트만 변경

## 11. 완료 조건

다음을 모두 만족해야 구현 완료다.

- [ ] 디자인 저장소 tracked 파일 변경 0
- [ ] Pretendard JP가 번들되고 plain Pretendard 참조 0
- [ ] alpha.1 토큰 정확히 반영
- [ ] 전경색 의미 감사 완료
- [ ] 완료 보상 일반/보상 없음/reduced-motion 상태 완료
- [ ] 기록 loading/ready/empty/error 상태 완료
- [ ] 기록 데이터에 가짜 즐겨찾기·저장·전체 사용자 수치 없음
- [ ] 설정의 기존 기능과 저장 키 보존
- [ ] 설정 화면이 alpha.1 토큰·타이포·44px 접근성 기준 충족
- [ ] 탭바 최신 handoff 형태 유지
- [ ] `npm run ci-check` 통과
- [ ] light/dark 및 iOS/Android 수동 QA 완료
- [ ] 구현 diff가 사용자 기존 작업 파일과 섞이지 않음

## 12. 다음 구현 명령의 실행 순서

1. 시작 전 AshitaKanji dirty worktree를 다시 확인하고 사용자 기존 변경을 보존
2. W0 토큰·폰트·전경색 감사
3. W1 완료 보상
4. W2 기록과 공통 CTA 판정
5. W3 설정
6. 단위 테스트와 `npm run ci-check`
7. 앱 구동 후 light/dark, 기록, 설정, reduced-motion 시각 QA
8. 디자인 저장소가 여전히 tracked diff 0인지 최종 확인

이 순서는 의존성 순서일 뿐 기록·설정을 후순위 범위로 제외한다는 의미가 아니다. 네 작업 묶음 모두 이번 적용 범위다.

