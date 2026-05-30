# 아시타칸지 — Gap Analysis (Check)

> Scope: **전체 기능 (13 modules) + Track A 데이터**
> Date: 2026-05-30 · Phase: Check · Method: Static + Runtime(vitest 41) + Release-gate
> (이전 v1 분석은 module-1/2/3 기반 스코프였음 — 본 문서가 정본)

## Context Anchor
| | |
|---|---|
| WHY | 한자만 노출 → reveal 강제 → 능동 회상 + FSRS 간격반복 |
| WHO | 평생 학습자 (N5→N1) |
| RISK | ts-fsrs Card(Date/enum) ↔ UserCard(ms/string) 매핑; 학습데이터 외부 송신 |
| SUCCESS | 5종 카드타입 / FSRS 4단계 due / 학습데이터 송신 0 / 6,200 verified |
| SCOPE | MVP 핵심기능 전량 (scan/weakness/stats/tts/export/about 포함) |

## Strategic Alignment
- PRD 없음 (Plan→Design→Do 체인). Plan WHY 충실 구현.
- **학습데이터 외부 송신 0**: 네트워크 호출 0건, errorBoundary console-only, DB 로컬(expo-sqlite), export=사용자 명시행위(expo-sharing) — ✅ 유지.
- OTA off (expo.updates.enabled=false) — ✅.
- 스토어/About 카피 "편집자 큐레이션 6,200 핵심선별" (NOT "빈도 상위/JLPT 전체") — ✅.

## Match Rate (전체 기능)
| 축 | 비율 | 비고 |
|---|---|---|
| Structural | 100% | 11 routes + 9 screens + 4 services(+factory) + 7 repo도메인 ×(interface/InMemory/Sqlite) 전부 존재 |
| Functional | 98% | 핵심 로직 실구현. 잔여 TODO 1건(events table persist, 비차단) |
| Contract | 100% | repo interface ↔ Sqlite/InMemory ↔ service 시그니처 일치 (tsc 0 errors) |
| Runtime | 100% | vitest 41/41 통과 (cardType4 + FSRS6 + Session8 + Scan4 + Weakness5 + Stats5 + Export9) |
| **Overall** | **~99%** | S×0.15 + F×0.25 + C×0.25 + Runtime×0.35 = 99.5 |

## Success Criteria (Plan)
| SC | 상태 | 근거 |
|---|---|---|
| 5종 카드타입 정확 분기 | ✅ Met | `cardType.ts` + 테스트 (A/B/E hide, C/D show) |
| FSRS 4단계 등급별 due 계산 | ✅ Met | `FsrsScheduler.review` + due 단조성 테스트 |
| 학습데이터 송신 0 | ✅ Met | 네트워크 0, errorBoundary console-only, export=사용자행위 |
| reveal 전/후 레이아웃 | ✅ Met | CardFace/CardReveal 분리 |
| 빠른 훑기(scan) 50/100/200/300 | ✅ Met | ScanService + 테스트 4 |
| 약점 복습 우선순위 큐 | ✅ Met | WeaknessService + 테스트 5 |
| 통계(streak/level/mature) | ✅ Met | StatsRollupService idempotent + 테스트 5 |
| TTS (ja-JP) | ✅ Met | useTTS (expo-speech, 미지원 silent) |
| JSON export/백업 | ✅ Met | exportPayload PURE + 테스트 9, ExportService |
| **6,200 verified** | ✅ Met | jlpt.db verified=6200, non_verified=0 (Track A 검수 반영) |

## Track A 데이터 검증 (신규 — 본 사이클 핵심 변경)
| 항목 | 상태 | 근거 |
|---|---|---|
| 레벨 수량 | ✅ | N5=300 N4=600 N3=1100 N2=1700 N1=2500 |
| qa_status | ✅ | verified=6200, needs_review=0, auto=0 |
| meaning_ko 채움 | ✅ | 0 empty |
| 깨진 번역(word-salad) | ✅ 해소 | 검수 후 24건 사람-교정(부재중/결석/체납/미정...) → 재스캔 0건 |
| QA 오류율 게이트 | ✅ | 교정 후 잔여 word-salad 0 (≤1% 예산 내) |

## Decision Record Verification
| 결정 | 준수 | 비고 |
|---|---|---|
| ts-fsrs 직접 wrapping | ✅ | 자체 알고리즘 X |
| Option C (feature-first + thin service + repo) | ✅ | 도메인 분리, srs/ 순수계층 |
| presentational Card | ✅ | reveal props, 소유 module-7 |
| Pure/native 분리 (vitest) | ✅ | exportPayload/ScanService 등 순수화 |
| Sqlite/InMemory repo 쌍 | ✅ | 테스트는 InMemory, 런타임은 Sqlite |

## Gaps / Deviations
| # | 항목 | 심각도 | 설명 | 조치 |
|---|---|---|---|---|
| G1 | errorBoundary events-table persist TODO | Trivial | 현재 console-only (학습데이터 외부송신 0 정책엔 부합) | 수용/후속 |
| G2 | Sqlite repos vitest 미실행 | None | RN 런타임 의존 → typecheck-only. 로직은 InMemory로 검증 | 설계 의도 |
| G3 | `fsrs()` vs `new FSRS()` | Trivial | v4 권장 factory. 동작 동일 | 수용 |

## 출시 게이트 (Release Gate)
| | 상태 |
|---|---|
| 데이터/자산 (jlpt.db verified 6200, level counts, icon/splash/adaptive, tatoeba-authors) | ✅ PASS (8/8) |
| git repo | ✅ |
| eas.json submit.ios (ascAppId, appleTeamId) | ❌ TBD — App Store Connect 값 필요 |
| Privacy/Support/Home URL HTTP 200 | ❌ 404 — GitHub Pages 미배포 (remote push + Pages 활성화 필요) |
| ⚠ icon/splash | TEMP placeholder — 실제 디자인 교체 필요 |

## 결론
**코드/데이터 = Go (Match ~99%, Critical/Important 0건).** 전 13모듈 구현 완료, 41/41 테스트 통과, tsc/lint clean, 6,200 verified 데이터 반영. 잔여 No-Go는 **코드 외 계정/인프라 산출물 2종** (eas 제출값, Pages 배포 URL) + TEMP 아이콘 교체 — 사용자 액션 영역. 다음: `/pdca report ashitakanji` (완료 보고서) 또는 출시 산출물 처리.
