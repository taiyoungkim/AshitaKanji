# 단어 학습 2단계 플로우 + 학습 완료 후 홈 (learning-flow-home-ux)

> 브랜치 `feat/learning-flow-home-ux` · 1차 구현 · 2026-11-01
> DB 스키마 변경 없음 · FSRS 파라미터·카드 선정 로직 변경 없음

## 1. 학습 플로우

```
1차 학습(main) ──큐 소진──▶ 중간 결과(interim) ──기억 확인하기──▶ 2차 기억 확인(recall) ──마지막 카드──▶ 최종 완료(/done)
   다시 볼래요 / 한 번 익혔어요        오늘의 단어를 한 번 살펴봤어요!   뜻 확인하기 → 헷갈렸어요 / 기억났어요
```

| 단계 | 화면 | 버튼 | 기록 |
|---|---|---|---|
| main | 기존 학습 카드(디자인 유지) | 다시 볼래요(Again) / 한 번 익혔어요(Good) | FSRS + review_log — 기존과 동일 |
| interim | `FirstPassResult` (최종 완료 화면과 별도, 고양이 사장님 이미지 `assets/onigiri/cat-thanks.png`, Figma 610-7404) | 기억 확인하기 | 세션 레코드를 `completed`로 저장 |
| recall | 학습 카드 `variant="recall"` | 뜻 확인하기 → 헷갈렸어요 / 기억났어요 | **기록 안 함** (세션 메모리만) |
| done | 기존 `/done` (재료·영수증·광고) | — | 1차 종료 때 저장한 요약을 그대로 씀 |

### 2차 기억 확인 대상

- '다시 볼래요' 단어 전체 + '한 번 익혔어요' 단어 중 최대 5개(`RECALL_LEARNED_SAMPLE`)
- 1차 종료 시점(`SessionEngine.completeCurrentRound`)에 **한 번만** 계산하고 `SessionState.recallQueue`에 고정한다. 중복이 없고, 진행 중에 다시 섞이지 않는다.
- 런타임 순서는 기존 큐와 같은 셔플(Fisher-Yates)이다. 테스트에는 항등 셔플을 넣는다.
- 2차 카드는 앞면에 단어만 보여준다(읽기 미리보기 설정은 무시). 공개하면 읽는 법과 뜻만 보이고, 예문·상세 링크는 없다.

## 2. 기존 학습 알고리즘과의 연결

| 정책 | 처리 |
|---|---|
| 버튼 → FSRS 등급 | 매핑은 그대로 Again / Good. 라벨만 바뀌었다. '한 번 익혔어요'(Good)도 FSRS 일정상 다음 복습 대상에 남는다. 제외 로직은 없다. |
| Again 같은 세션 재출제 금지(`Grade.ts`) | FSRS 재채점은 여전히 하지 않는다. 2차는 '확인'일 뿐이고 일정을 바꾸지 않는다. |
| 같은 날 재확인 = 보강 복습(`supplementalReview`, scheduling_applied=0) | `enable_short_term:false`라서 1차 채점 직후 due는 항상 미래다. 기존 정책을 그대로 따라도 일정은 바뀌지 않는다. 같은 세션에 로그를 두 번 남기지 않으려고 2차는 review_log도 쓰지 않는다. |
| 학습 수 / again_count | 1차 기준만 센다(`done_new`, `done_review`, `again_count`). 2차는 더하지 않는다. |
| 오늘 배운 단어 / 오늘 복습(weakness?source=today) | 둘 다 1차 review_log 기준이라 동작이 같다. |

## 3. 저장·재진입·보상 중복 방지

- **세션 저장 시점**: 1차 큐를 다 풀면 `SessionStore.submitGrade`가 곧바로 `engine.end('completed')`를 부른다. 1차 소진은 기존 "오늘 완료" 기준과 같다.
- **`SessionEngine.end`는 한 번만 저장**: 두 번째 호출부터는 캐시된 요약을 돌려준다. 그래서 2차 도중 이탈해도(`abandon`) `abandoned`로 덮어쓰지 않고, 최종 완료 때 다시 저장하지도 않는다.
- **재료·도장**: 둘 다 completed 세션 수에서 계산되는 값이다(`computeOnigiriProgress`, streak). 세션 레코드가 1개이고 completed 저장도 1회라서 중복 지급이 구조적으로 생기지 않는다.
- **앱 종료 / 이탈**

| 시점 | 결과 |
|---|---|
| 1차 도중 | 기존과 동일. 채점한 카드는 저장되고, 세션은 미완료라 재료가 없다. 재진입하면 남은 카드로 새 세션을 만든다. |
| 중간 결과 · 2차 도중 | 학습 기록·재료·도장 유지. 홈은 '학습 완료' 상태가 된다. `/done` 화면과 전면광고는 건너뛴다. |
| 1차 종료 저장 실패 | 경고 로그만 남긴다. 최종 완료 단계의 `endSession`이 다시 저장을 시도한다. |

## 4. 학습 완료 후 홈

학습 전 화면은 바뀌지 않았다(오늘 학습 카드 + 학습 시작하기).

학습 후 순서:

1. **히어로** `HomeStudyCompleteHero`: 오늘 학습 완료 / 오늘도 잘 먹었다. / 단어 N개를 익혔어요. / 기존 고양이 사장님 이미지 / 오늘 획득한 재료
   - 재료는 `findIngredientRewardForSession(sessions, studySessionId)`로 구한다. 오늘 학습 세션이 받은 재료를 정확히 찾는다(마지막 재료가 아니어도 된다). 재료가 없으면 이 행을 숨긴다.
   - 다시 볼 단어가 있으면 기존 '오늘 복습' 진입 버튼을 유지한다.
2. **오늘 배운 단어** `HomeActionCard` → `/today-words?sessionId=` (보기 전용). 학습한 단어가 0개면 카드를 숨긴다.
3. **이어서 회독해요** `HomeActionCard` → `/reading-study?level=&chapter=`. 진행률은 회독 허브와 같은 known 기준이다. 챕터 통계가 없거나 현재 챕터가 완료됐으면 숨긴다. `allDone` 단계에서는 기존 `HomeAllDoneCard`를 유지한다.
4. 단골 도장 · 최근 획득 · 메뉴판: 기존 유지

기존 `ReadingContinueSection`(학습 후에만 쓰임)은 3번 카드로 대체되어 삭제했다.

## 5. 변경 파일

| 파일 | 내용 |
|---|---|
| `src/types/Session.ts` | `SessionPhase`에 `interim`·`recall` 추가, 1차/2차 카운터와 `recallQueue` 추가 |
| `src/features/study/SessionEngine.ts` | 2차 큐 생성·고정, `startRecall`/`submitRecall`/`currentRecall`, `end` 1회 저장 |
| `src/stores/SessionStore.ts` | 1차 종료 시 completed 저장, `recallCard`·`startRecall`·`submitRecall` |
| `src/features/study/StudyScreen.tsx` | interim / recall 단계 렌더 |
| `src/features/study/components/FirstPassResult.tsx` | 신규. 중간 결과 화면 |
| `src/features/study/components/StudyCard.tsx` | `variant="recall"` |
| `src/features/study/components/StudyActions.tsx`, `StudyActionBar.tsx`, `src/types/Grade.ts` | 라벨: 다시 볼래요 / 한 번 익혔어요 |
| `src/features/onigiri/TutorialScreen.tsx` | 튜토리얼 버튼 라벨을 새 라벨로 맞춤 |
| `src/features/done/DoneScreen.tsx` | "오늘 외운" → "오늘 익힌", "아직이라고 표시한 단어" → "다시 볼 단어" |
| `src/features/onigiri/progress.ts` | `findIngredientRewardForSession` |
| `src/features/home/HomeScreen.tsx`, `components/HomeSections.tsx` | 히어로 개편, `HomeActionCard` 2장 |
| `src/visual/captureFixtures.ts` | 늘어난 `SessionState` 필드 반영 |
| `src/features/weakness/TodayReviewService.ts` | 주석의 라벨만 변경 |
| 테스트 | `SessionEngine.test.ts`, `SessionStore.test.ts`, `progress.test.ts`, `studySessionLifecycle.test.ts` |

## 6. 개발자 확인 필요

- **2차 결과의 활용**: 지금은 메모리에만 있다. '한 번 익혔어요' → '헷갈렸어요'로 바뀐 단어를 오늘 복습 큐에 넣으려면 보강 로그(scheduling_applied=0)를 별도 세션에 남기는 방식을 검토해야 한다.
- **2차 도중 이탈 시 `/done`·광고 생략**: 의도한 동작인지 확인이 필요하다.
- **세션 소요 시간**: 1차 종료 시점까지만 기록된다. 2차 시간은 빠진다.
- **홈 '복습하기' 버튼**: 2차 기억 확인과 역할이 일부 겹친다. 유지할지 기획 확인이 필요하다.
- **`Grade.ts`의 "Again 재출제 금지" 정책 문구**: FSRS 기준으로는 유지되지만, 화면상으로는 같은 세션에 다시 보인다. 정책 문서 갱신이 필요하다.
