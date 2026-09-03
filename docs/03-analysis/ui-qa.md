# Onikan `fa259e7` UI 정합·시각 QA

> 상태: 구현 완료와 시각 QA 완료를 분리한다. 이 문서에서 `actual` 캡처와 diff가 있는 화면만 시각 QA 대상으로 인정한다. TypeScript·lint·단위 테스트 통과만으로 시각 정합 완료로 판정하지 않는다.

## 정본과 판정 규칙

- 디자인 커밋: `fa259e772c05efaa884b97cc822f89c0d6ad62a2`
- 1순위: `handoff/redesign-2026-08/final-screens/*.png` 20종
- 2순위: `handoff/redesign-2026-08/README.md`
- 3순위: `DESIGN.md`, `COMPONENTS.md`
- 보조: final-screens에 없는 화면만 `handoff/redesign-2026-08/screens/`
- HTML은 전환·상태·모션 참고 전용이다. PNG와 충돌하면 PNG가 이긴다. 이번 감사에서 HTML을 더 최신 정본으로 채택한 항목은 없다.
- 구버전 기준: `a2379f2`, `/Users/tyoung/Downloads/index.html`, `~/Downloads/index.html`은 이번 정본이 아니다. 관련 기존 문서 상단에 구버전 배너를 추가했다.

정본 PNG는 모두 폭 390px이다. 높이는 844px이 기본이고, 스크롤 전체 길이 export는 867–1365px이다. 회귀 baseline은 논리 viewport `390×844`로 정규화한다. 긴 탭 화면은 상단 content 756px + 정본의 하단 tab 88px을 결합하며, 긴 상세 화면은 상단 844px을 사용한다. 원본 PNG는 수정하지 않는다.

## 토큰·공통 컴포넌트 감사

| 항목 | 정본 | 앱 적용·검증 |
|---|---|---|
| 색 | ink `#1D1D21`, body `#56565E`, mute `#8E8E97`, soft `#E8E8EC`, softer `#F2F2F4`, canvas `#FFF`, primary `#EF5112`, secondary `#A3E635` | `src/design/tokens.ts`와 theme alias 사용. Primary CTA=ink, orange=브랜드/상태, lime=진척/보상 역할 유지 |
| 폰트 | Pretendard JP; word 44/53 Bold, meaning 26/34 Bold, title 17/24 SB, body 16/24 R, strong 16/22 SB, tab 12/16 | Regular/Medium/SemiBold/Bold/ExtraBold OTF 번들 및 루트 layout에서 로딩. 시스템 기본 font에 의존하지 않음 |
| 간격·radius | 4px 계열 spacing, 화면 좌우 20px, card radius 24px | 화면 값 대신 `tokens.ts`; 반복 카드/버튼/탭/상태 UI는 공용 컴포넌트 경유 |
| shadow | Level 1: y 6, blur 14, `#0000000D` | iOS shadow와 Android elevation 차이에 기대지 않고 공용 card shadow 정의 사용 |
| Safe Area | 디자인 viewport와 별개; content는 status/home indicator 침범 금지 | iOS 390×844: top 47/bottom 34, Android 390×844: system bar를 별도 insets로 측정. `useScreenInsets`와 공용 tab bar 사용 |
| 탭 | 26px icon + 12/16 label, active orange, tab 88px | `MainTabBar`/`AppTabBar`의 모든 사용 화면 영향 확인 |

## final-screens 20종 1:1 화면 감사

표기 `20/24/1`은 family/size/weight/lineHeight/letterSpacing 순이며 family를 생략한 행은 모두 Pretendard JP, letterSpacing 0이다. 화면 배경은 별도 표기가 없으면 `softer #F2F2F4`, 좌우 inset 20px, card radius 24px이다.

| # / 정본 | 앱 라우트·fixture | 화면 상태 | viewport · Safe Area | 헤더·주요 크기·간격 | 타이포 | border·radius·shadow | asset | 문구·줄바꿈 | CTA → 다음 라우트 |
|---|---|---|---|---|---|---|---|---|---|
| 01 홈 학습 전 | `/home`, `01-home-study-before` | 신규 20, 재료 2/5, 단골 5일 | 390×844; iOS 47/34, Android system inset | 날짜/H1 좌상단, N5 우측; hero 350w; section gap 20 | H1 26/34/B, title 17/24/SB, body 16/24/R | elevated hero, flat streak/menu | 사장 mascot, 재료 원본, 보호권/도장 | `왔네. 오늘은 참치마요야.` 고정 1–2행; 실제 N5 데이터 | `학습 시작하기` → `/study` |
| 02 학습 앞면 | `/study`, `02-study-front` | 1/10, reveal 전 | 390×844; top safe + progress, bottom safe + actions | 닫기 44, progress 연속바, card, 2버튼 고정 | word 44/53/B, reading 18/26/M, meaning 26/34/B | elevated card 24; action outline 1.5 | speaker icon은 공용 원본 icon | `勉強 / べんきょう / 공부, 학습`; 줄바꿈 고정 | `외웠어요`/`아직이에요` → 같은 `/study` 다음 카드 |
| 03 학습 공개 | `/study`, `03-study-reveal` | 1/10, reveal 후 | 390×844; 02와 동일 | 본문 scroll, 평가 버튼 bottom | 02 + hint 14/20, example 16/24 | hint=soft flat, example card, CTA 규격 동일 | speaker/icon; emoji 대체 없음 | 유사 발음·일/한 예문 deterministic | `단어 상세` → `/word/:id`; 평가 → 다음 카드 |
| 04 단어 상세 | `/word/w_80121247ba5c6668`, `04-study-word-detail` | 11c 상세, 음독 브리지 | 390×844 viewport; source 390×1165 top crop; top/bottom safe | 44 close + centered title; stacked cards 20 gap | word 44/53/B, meaning 26/34/B, body 16/24 | 카드 border 없음, radius 24, Level 1 | 발음·사전 공용 icon; 한자 glyph는 Pretendard JP | 실제 DB의 勉強/뜻/한자 정보, 긴 뜻 wrap 허용 | 닫기 → 이전 `/study`; 사전 → 외부 사전 |
| 05 학습 결과 | `/done`, `05-study-result` | 새 12, again 3, 4/4 | 390×844; safe top/bottom | 결과 header, 재료 plate, 지표; button bottom | title 26/34/B, number 강조, body 16/24 | result card/elevated; fill track radius 공용 | 참치 ingredient 원본, green check | `오늘의 학습 / 다 했어요`; 실제 summary 연결 | 2초 fill `확인` → 완성 시 `/done` complete, 아니면 `/home` |
| 06 오니기리 완성 | `/done`, `06-onigiri-complete` | 이번 세션 4/4 완성 | 390×844; safe areas | 중앙 recipe image/완성 badge, 3지표, dialogue | title 26/34/B, ratio number 20/B | badge pill; card radius 24/shadow token | tuna-mayo recipe, mascot; confetti brand palette | `새 주먹밥을 만들었어요.`와 recipe 명 | `영수증 받고 마치기` → receipt state |
| 07 영수증 | `/done`, `07-receipt` | receipt overlay open | 390×844; dimmer 포함, receipt safe | centered receipt, serrated edge, actions bottom | mono 표현도 Pretendard JP로 고정 | receipt 전용 dimmer #000/60%, blur 7; 일반 modal과 분리 | receipt decoration/recipe asset | 날짜 2026.08.07 09:41, 학습 수 고정 | 저장/공유는 실제 기능, `확인했어` → `/home` |
| 08 홈 복습 완료 | `/home`, `08-home-review-done` | 오늘 학습+복습 완료 | 390×844; source 390×1365 tab 합성 | Review completion card + home hero + tab | overline 11/16/M, hero 26/34/B | 완료 tint `#EAF6DD`, green check; CTA outline | check/mascot/recipe assets | 실제 오늘 summary를 레이아웃 유지해 연결 | 회독 CTA → `/reading`; 단어 보기 → `/today-words` |
| 09 홈 복습 없음 | `/home`, `09-home-no-review` | today again=0 | 390×844; source 390×1365 tab 합성 | empty-review 상태가 hero 흐름 유지 | 08과 동일 | 빈 상태도 추가 card 중첩 없음 | 공용 mascot/recipe | `복습할 단어가 없어요` 상태 문구, 실제 count | 회독 CTA → `/reading` |
| 10 홈 모두 완료 | `/home`, `10-home-all-done` | 복습 완료 + N5 50/50 | 390×844; source 390×1365 tab 합성 | completion emphasis, bottom tab 88 | 08과 동일 | 완료 tint/green, primary CTA 없음 또는 약한 action | completion icon/mascot | `오늘 공부 끝!` 완료감 유지 | 다음 회독/단어 보기 → 실제 상설 track |
| 11 회독 hub | `/reading`, `11-review-hub` | N5 32/50, 학습 20회 | 390×844; source 390×1158 tab 합성 | H1, arc gauge, current linear bar, chapter list | H1 26/34/B, count 20/B, body 15–16 | summary elevated; chapter rows flat; badge pills | `assets/reading/review-complete.png`, 공용 icons | chapter 실제 DB 진도, 디자인 예시 32/50 fixture | `이어서 회독하기` → `/reading-study`; chapter row 동일 |
| 12 회독 필터 | `/reading`, `12-review-hub-filter` | 11 + filter sheet open | 390×844; source 390×867 tab 합성 | filter control/overlay가 header 아래 정렬 | chip 14/20/SB | 선택 chip ink/on-ink, sheet/card token | filter/check icons | N5/chapter 상태 필터 문구 고정 | 선택 → 같은 `/reading`; 회독 → `/reading-study` |
| 13 메뉴 목록 | `/collection`, `13-menu-list` | 9 ingredients, list | 390×844; source 390×1365 tab 합성 | H1 + list/grid switch, 1열 rows | title 17/24/SB, meta 14/20 | list cards flat/elevated 정본대로 | recipe/ingredient 원본 PNG | 실제 catalog 이름·재료를 연결(예시와 차이 기록) | row → `/onigiri/:id` |
| 14 메뉴 그리드 | `/collection`, `14-menu-grid` | 9 ingredients, grid | 390×844; source 390×1365 tab 합성 | 2열 grid, 동일 switch/tab | 13과 동일 | cell radius/shadow token | 13과 동일 원본 PNG | 실제 catalog, 긴 한국어 2행 제한 | cell → `/onigiri/:id` |
| 15 레시피 상세 | `/onigiri/onigiri-003`, `15-recipe-detail` | recipe 003 진행 | 390×844; safe top/bottom | top nav, image plate, checklist | title 26/34/B, row 16/24 | plate/card/list divider token | recipe 003 + ingredient PNG | 실제 catalog recipe/재료명 연결 | 뒤로 → `/collection` |
| 16 기록 | `/stats`, `16-stats` | 2026-08-07, 6일/55로그/12점 | 390×844; source 390×1204 tab 합성 | date/H1, score, week, 2×2 tiles, histogram | H1 26/34/B, number/display, body 14–16 | flat/elevated cards; orange는 histogram `나` 1개 | calendar/stats 공용 vector icon | 날짜·점수·횟수 fixture 고정; 실제 통계 계산 | `지금 연습하기` → `/study` |
| 17 설정 main | `/settings`, `17-settings` | light, N5 | 390×844; source 390×844; tab 88 | H1, grouped rows, tab | H1 26/34/B, row 16/24 | group card 24, 1px dividers, no platform shadow | chevron/toggle 공용 icon | 실제 앱 설정 항목 유지, 디자인에 없는 UI 추가 안 함 | row → 18/19/20; about → `/about` |
| 18 학습 설정 | `/settings-learning`, `18-settings-learning` | N5, 하루 12 | 390×844; safe top/bottom | 44 back + centered title; grouped controls | nav 17/24/SB, label 16/24 | selected level chip ink, stepper/token border | minus/plus/check 공용 icon | 실제 저장값 연결, 긴 설명 wrap | back → `/settings` |
| 19 발음 설정 | `/settings-pronunciation`, `19-settings-pronun` | TTS on, 0.9×, 자동재생 on | 390×844; safe top/bottom | 18과 같은 TopNav/rows | 18과 동일 | toggle/segment를 공용 control로 통일 | speaker/play icons | 기기 TTS 실제 기능과 문구 연결 | 발음 테스트는 같은 화면; back → `/settings` |
| 20 데이터 백업 | `/settings-backup`, `20-settings-backup` | export/import idle | 390×844; safe top/bottom | 18과 같은 TopNav, 설명+2 actions | 18과 동일 | primary ink, secondary white outline 1.5 | export/import 공용 icons | 실제 SQLite 백업 기능 문구; 예시 데이터 없음 | 내보내기/가져오기 수행; back → `/settings` |

## final-screens 밖의 현재 사용자 화면

| 현재 라우트 | final 20 매핑 | 판정 근거 |
|---|---|---|
| `/intro`, `/tutorial` | 없음 | `handoff/redesign-2026-08/onboarding/screens/`만 보조 정본으로 사용. production onboarding 기능 유지 |
| `/reading-study` | 없음 | 보조 `screens/13-review-front.png`, `14-review-back.png`; Chapter Hub CTA의 실제 목적지 |
| `/weakness` | 없음 | 오늘 `아직이에요` 복습이라는 실제 기능. final 08–10 진입점 레이아웃만 정본 |
| `/today-words` | 없음 | O-2 도감형 단어 목록의 실제 데이터 화면; 임의 신규 카드 없음 |
| `/trace/[literal]` | 없음 | 한자 쓰기 실제 기능 유지; final 04의 한자 상세에서 진입 가능 |
| `/scan` | 없음 | 기존 사용자 기능이며 final 20에 시각 정본 없음. 기존 레이아웃 유지 |
| `/about` | 없음 | 설정의 실제 법적/앱 정보 목적지. final 17 row 스타일만 공유 |

`/_dev/*`는 사용자 화면이 아니며 production UI에 진입 컨트롤이 없다. `/_dev/ui-capture`는 compile-time `EXPO_PUBLIC_UI_CAPTURE=1`과 앱 private Documents marker가 동시에 있어야 fixture를 준비한다.

## deterministic fixture

- 기준 시각: 2026-08-07 09:41 KST 상당의 local timestamp
- 단어: `勉強 / べんきょう / 공부, 학습`, N5, 예문 고정
- 학습: 1/10, 완료 12, again 3, 6분, 단골 5일
- 회독: N5 Chapter 1 32/50, 20회
- 기록: 최근 6일 세션과 review logs 고정
- 설정: N5, 하루 12(홈은 정본 상태를 위해 20), TTS 0.9×
- capture 화면에서는 `now`, 날짜, fill progress와 초기 modal/filter 상태를 고정한다. 실제 production 데이터 모델과 CTA route는 바꾸지 않는다.

## 실제 데이터와 디자인 예시의 의도적 차이

| 범위 | 차이 | 이유 |
|---|---|---|
| 단어 상세/학습 | 정본 예시를 fixture에서 재현하되 production은 현재 JLPT DB 값을 사용 | 레이아웃을 유지하면서 실제 데이터가 source of truth |
| 메뉴/레시피 | 정본의 예시 순서·획득 수와 실제 catalog/session 파생 값이 달라질 수 있음 | 가짜 획득 상태나 별도 catalog를 만들지 않음 |
| 통계 | 정본 숫자는 fixture로만 고정, production은 review/session 집계 | 통계 의미 보존 |
| iOS/Android | glyph rasterization/AA의 미세 차이 | pixelmatch `includeAA:false`; 위치·크기·줄바꿈·색·asset·safe area 차이는 허용하지 않음 |

## 시각 회귀 산출물과 결과

- baseline: `ui/baseline/{ios,android}/`
- actual: `ui/actual/{ios,android}/`
- 50% overlay: `ui/overlay/{ios,android}/`
- pixel/perceptual diff: `ui/diff/{ios,android}/`, 수치 `ui/diff/report.json`
- 기준: AA 제외 pixel mismatch 3.5% 이하. 단, 비율과 무관하게 위치/크기, 줄바꿈, 색·font·asset, Safe Area, CTA/tab 불일치는 육안 실패다.

화면별 최종 수치와 실패 화면은 캡처 후 `ui/diff/report.json`을 기준으로 이 절에 기록한다.

### iOS 390×844 캡처 결과 (2026-09-03)

`UI_DIFF_MAX_RATIO=0.035`, `pixelmatch threshold=0.15`, `includeAA=false`로 실행했다.

| 화면 | pixel diff | perceptual luma | 결과 |
|---|---:|---:|---|
| 01 | 12.41% | 10.15% | 실패 — hero 수직 배치·레시피/단골 상태 |
| 02 | 8.14% | 7.95% | 실패 — 카드/진행 위치 |
| 03 | 6.63% | 7.42% | 실패 — 공개 카드 위치 |
| 04 | 9.30% | 6.80% | 실패 — 상세 카드 배치 |
| 05 | 10.88% | 8.55% | 실패 — 결과 보상 레이아웃 |
| 06 | 12.48% | 13.84% | 실패 — 완성 art/지표 |
| 07 | 12.03% | 12.46% | 실패 — receipt overlay |
| 08 | 11.80% | 9.25% | 실패 — 완료 hero 상태 |
| 09 | 15.43% | 12.03% | 실패 — empty review 상태 |
| 10 | 11.08% | 8.99% | 실패 — all-done 상태 |
| 11 | 10.11% | 7.95% | 실패 — arc/chapter 위치 |
| 12 | 2.96% | 4.51% | 통과 |
| 13 | 2.77% | 3.41% | 통과 |
| 14 | 3.95% | 4.15% | 실패 — grid 셀 위치 |
| 15 | 9.07% | 8.83% | 실패 — recipe 상세 배치 |
| 16 | 6.68% | 5.26% | 실패 — 차트/상단 간격 |
| 17 | 1.59% | 2.16% | 통과 |
| 18 | 3.18% | 4.11% | 통과 |
| 19 | 2.77% | 4.08% | 통과 |
| 20 | 2.88% | 3.72% | 통과 |

iOS 결과는 20개 actual/overlay/diff 파일과 함께 보존한다. 실패는 시각 정합 미완료로 분류하며, 임계치를 올려 숨기지 않는다. Android 결과가 생성되면 같은 표에 플랫폼 열을 추가한다.

### Android 390×844 정규화 캡처 결과 (2026-09-03)

| 화면 | pixel diff | perceptual luma | 결과 |
|---|---:|---:|---|
| 01 | 14.65% | 12.61% | 실패 |
| 02 | 3.86% | 4.06% | 실패 |
| 03 | 4.57% | 5.49% | 실패 |
| 04 | 9.25% | 6.58% | 실패 |
| 05 | 6.95% | 6.74% | 실패 |
| 06 | 7.63% | 10.06% | 실패 |
| 07 | 13.07% | 13.46% | 실패 |
| 08 | 14.69% | 11.72% | 실패 |
| 09 | 12.33% | 7.99% | 실패 |
| 10 | 11.10% | 8.03% | 실패 |
| 11 | 11.79% | 11.04% | 실패 |
| 12 | 13.01% | 9.65% | 실패 |
| 13 | 3.71% | 4.63% | 실패 |
| 14 | 5.25% | 5.80% | 실패 |
| 15 | 5.52% | 6.19% | 실패 |
| 16 | 5.38% | 4.72% | 실패 |
| 17 | 1.84% | 3.00% | 통과 |
| 18 | 3.50% | 4.74% | 실패 |
| 19 | 2.77% | 4.34% | 통과 |
| 20 | 2.61% | 3.67% | 통과 |

Android도 20개 actual/overlay/diff 파일을 생성했다. iOS와 Android 모두 설정 계열은 대부분 정합하지만, 홈·보상·회독의 정본 배치/상태 차이가 남아 있어 `npm run ui:diff`는 의도적으로 실패 상태다.

## 재현 명령

```sh
# 캡처 플래그를 번들한 Release 앱을 각 전용 simulator/emulator에 설치
EXPO_PUBLIC_UI_CAPTURE=1 npx expo run:ios --configuration Release --device "AshitaKanji UI iPhone"
EXPO_PUBLIC_UI_CAPTURE=1 npx expo run:android --variant release

npm run ui:capture
npm run ui:diff

# baseline 변경은 review 후 아래 명시적 명령으로만 수행
npm run ui:approve
```

정본에서 baseline을 재구성할 때만 `npm run ui:approve -- --from-design`을 사용한다. CI는 `ui:diff`만 실행하며 baseline을 갱신하지 않는다.

## Android 릴리즈 콜드 스타트 검증 (2026-09-03)

초기화한 `emulator-5554`에 `android/app/build/outputs/apk/release/app-release.apk`를 새로 설치하고 검증했다.

| 항목 | 결과 | 근거 |
|---|---|---|
| 설치/콜드 스타트 | 통과 | `adb install` 성공, `MainActivity` 표시까지 약 7.8초 |
| 온보딩→홈 | 통과 | `시작하기`→`건너뛰기` 후 홈의 `오니기리 가게`·하단 탭 확인 |
| 첫 학습 카드 | 통과 | `학습 시작하기` 후 `1 / 12`, `上着`, `うわぎ`, `뜻 보기` 확인 |
| 단어 발음 | 통과 | ExoPlayer 초기화 및 `audio/opus` 디코드·AudioTrack 출력 로그 확인 |
| 원격 업데이트 | 의도된 경고 | 네트워크 미연결 에뮬레이터에서 `UpdateFailedToLoad`; embedded bundle fallback으로 앱은 계속 실행 |

이번 검증에서는 fatal exception/ANR을 확인하지 않았다. 예문 발음 버튼도 UI에 존재하며 동일한 오디오 경로를 사용하므로, 실제 기기 청취 품질은 별도 실기기 확인 대상으로 남긴다.

## 저높이 학습 카드 검증 (2026-09-03)

`StudyCard`의 카드/스크롤 flex 제약을 보정한 release APK(`060d4f23b3f36288eff1a5bf0e7d129c06b36fe5c0844c82117ee71d1bb1a9a2`)를 Android 에뮬레이터 viewport `1344×2200`으로 검증했다. 공개 상태에서 예문 카드(`예문을 들어보세요`)와 `단어 상세 ›`가 액션바 위에 표시되고, 액션 버튼이 하단에 고정되는 것을 확인했다. 카드에 `minHeight: 0`, 내부 `ScrollView`에 `flex: 1/minHeight: 0`, `nestedScrollEnabled`를 적용했다.

최종 중앙 정렬 수정 APK(`868f774d2422700da0a9f9a2a919c0ac17c4716c1d2ce3ec15d854a00dab02ff`)를 정상 높이 Android 에뮬레이터에 직접 설치해 `食塩` 카드(한자·뜻·유사 발음·예문)를 캡처했다. 네 요소가 모두 카드 안에 표시되고 하단 평가 버튼과 겹치지 않는 것을 확인했다.
