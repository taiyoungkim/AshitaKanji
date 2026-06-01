# ONIGIRI SHOP 리디자인 — 액션 플랜

> 기준 시안: `~/Downloads/index.html` (정적 목업 6화면 + 상태 변형)
> 토큰: `src/design/tokens.ts` (시안 `:root` 1:1 매핑 — 완료)
> 작성: 2026-06-01

## 갭 요약 (현황)

| # | 시안 화면 | 코드 | 상태 |
|---|---|---|---|
| 01 | Shop Home | `src/features/home/HomeScreen.tsx` | ✅ 적용 |
| 02 | Study Complete + Receipt | `src/features/done/DoneScreen.tsx` | ✅ 적용 |
| 03 | Onigiri Collection (Index) | 컴포넌트만 있음(`OnigiriIndexItem`), 화면/라우트 없음 | ❌ |
| 04 | Onigiri Detail | 컴포넌트만 있음(`OnigiriSketch`,`LabelValueRow`), 화면/라우트 없음 | ❌ |
| 05 | Cat Dialogue | 컴포넌트만 있음(`CatDialogue`), 사용처 없음 | ❌ |
| 탭 | Tab Bar | `app/(tabs)/_layout.tsx` 옛 스타일(파랑 `#0366d6`) | ❌ |
| 기타 | study/stats/settings/weakness/scan/word/about | 옛 하드코딩 색, 토큰 미적용 | ❌ |

**원인**: 토큰 + 공통 컴포넌트는 완성. 화면 배선/라우트 추가가 Home·Done 2개에서 멈춤.

---

## 액션 목록

### A1. Onigiri Collection 화면 + Index 탭 ✅
- 신규 `src/features/onigiri/CollectionScreen.tsx` — `progress.entries` map → `OnigiriIndexItem`
- 헤더 `ONIGIRI INDEX` + `NN / 24` 카운트
- 상태: 빈 컬렉션(`00 / 24` + 안내문), 일반, 전부 수집(`전부 모았네.`)
- 신규 탭 라우트 `app/(tabs)/collection.tsx` (re-export)
- `(tabs)/_layout.tsx`에 탭 추가, 항목 클릭 → A2 상세로 push
- 데이터: `buildOnigiriProgressService().getSnapshot()`

### A2. Onigiri Detail 화면 + 라우트 ✅
- 신규 `src/features/onigiri/OnigiriDetailScreen.tsx`
- 번호 + 이름 + `OnigiriSketch`(status별) + `LabelValueRow`(Completed/In progress) + Ingredients 리스트(획득분 진하게)
- 상태: completed / inProgress(`2 / 4`, 미획득 재료 tertiary) / locked(점선 스케치, `아직 잠겨 있어.`)
- 라우트 `app/onigiri/[id].tsx` 풀스택 스택, `_layout.tsx` Stack.Screen 등록

### A3. Tab Bar 무채색 교체 ✅
- `(tabs)/_layout.tsx` → 토큰 기반. `tabBarActiveTintColor: colors.text`, inactive `textTertiary`
- 파랑 `#0366d6` 제거, headerStyle 무채색
- 탭 라벨 영문(Shop/Index/Stats/Settings) or 기존 한글 유지 — 한글 유지 결정

### A4. Cat Dialogue 연결 ✅ (재배치)
- 기획 확정: **앱 인트로 — 매 실행마다 항상 첫 화면**
- `app/intro.tsx` → `IntroScreen`(CatDialogue calm, "시작하기") → `/home`
- `app/index.tsx`: 항상 `/intro`로 redirect
- 1회 제한 플래그 없음 (introSeen 미사용)
- (이전 done 완성 1컷 게이트는 제거 — 기획상 위치 아님)

### A5. 기존 화면 토큰 이식 ✅
- 완료: stats, settings, study(+RevealButton/GradeButtons/SessionProgress), Card/CardFace/CardReveal, weakness, scan, word/[id], about, `app/_layout.tsx`(로딩+Stack 헤더), `(tabs)/_layout.tsx`
- 옛 하드코딩 색 → `colors.*` 치환. 녹색/주황/빨강 → 무채색 농도 램프. 이모지 상태표시 → 타이포 kicker
- 제외: `app/_dev/cards.tsx` (개발 전용 디버그 화면 — 사용자 비노출, 의도적 보류)

### A6. Done 4/4 `Crafted` 태그 ✅
- `DoneScreen` 완성(`reward.crafted`) 시 이름 위 `CRAFTED` kicker 추가 (시안 02-완성)

---

## 진행 순서
A1 → A2 → A3 → A6 → A5 → A4 — **전부 완료 ✅ (2026-06-01)**
검증: typecheck ✅ · lint 0 error · 53 tests 통과 ✅

## 결정 사항
- 탭 구성: `home(Shop) / collection(Index) / stats / settings` 4탭 (stats 유지)
- 탭 라벨: 한글 유지 (오늘 / 컬렉션 / 통계 / 설정)
- 검증: 각 액션 후 `npm run typecheck` + 목업 대조
