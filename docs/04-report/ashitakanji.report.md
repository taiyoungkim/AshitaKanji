# 아시타칸지 (明日漢字) — PDCA Completion Report

> Date: 2026-05-30 · Phase: Report (cycle complete) · Match Rate: ~99%
> Chain: Plan v0.7.4 → Design v1.0 (Option C) → Do (13 modules) → Check (~99%) → Report

## 1. Executive Summary

| 항목 | 내용 |
|---|---|
| Product | 아시타칸지 (明日漢字) — JLPT N5–N1 단어 학습 앱 |
| Platform | React Native + Expo SDK 53 (iOS/Android), 로컬 SQLite, 백엔드 없음 |
| Scope | 6,200 검수 단어 + FSRS 회독 + 빠른 훑기 + 약점 복습 + 통계 + TTS + JSON export |
| Architecture | Option C — Feature-first + thin service + Repository(interface/InMemory/Sqlite) |
| Result | 13/13 모듈 구현, tsc 0 / vitest 41 / lint 0, jlpt.db verified=6200 |
| Match Rate | ~99% (Critical/Important gap 0) |

### 1.3 Value Delivered (4-perspective)
| 관점 | 전달 가치 | 지표 |
|---|---|---|
| **Problem** | 한자 노출→reveal 강제로 수동읽기 차단, 능동 회상 유도 | 5종 카드타입 정확 분기 (A/B/E hide · C/D show), 테스트 4 |
| **Solution** | FSRS 간격반복 + 빠른훑기(50/100/200/300) + 약점 우선순위 큐 | FSRS 4단계 due 단조성, Scan/Weakness 서비스 테스트 9 |
| **Function UX Effect** | "오늘 복습 끝내는 경험" — Home 카운트→Study→Done→Stats 흐름, TTS, 백업 | 통계 streak/level/mature, useTTS ja-JP, export PURE 테스트 9 |
| **Core Value** | "평생 함께 가는 단어장" — 로컬 우선, 학습데이터 외부송신 0, 6,200 사람검수 | 네트워크 호출 0, verified=6200/non_verified=0 |

## 2. Key Decisions & Outcomes
| 결정 (Plan/Design) | 준수 | 결과 |
|---|---|---|
| ts-fsrs 직접 wrapping (자체 알고리즘 X) | ✅ | FsrsScheduler initNew/review/preview, now-injection 결정성 |
| Option C 레이어 (feature-first + thin service + repo) | ✅ | 도메인 7종 repo 쌍(Sqlite/InMemory), srs/ 순수계층 |
| Pure/native 분리 (vitest 격리) | ✅ | exportPayload/Scan/Weakness/Stats 순수화 → 41 테스트 |
| 학습데이터 송신 0 + OTA off | ✅ | 네트워크 0, errorBoundary console-only, updates.enabled=false |
| GPT 초안 + 100% 사람 검수 | ✅ (검수 반영) | jlpt.db verified=6200, word-salad 24건 사람-교정 후 0 |
| 카피 "편집자 큐레이션 핵심선별" | ✅ | About/스토어 "빈도 상위/JLPT 전체" 미사용 |

## 3. Success Criteria — Final Status
| SC | 상태 | 근거 |
|---|---|---|
| 5종 카드타입 정확 분기 | ✅ Met | cardType.ts + 테스트 |
| FSRS 4단계 등급별 due | ✅ Met | FsrsScheduler.review + 단조성 테스트 |
| 학습데이터 송신 0 | ✅ Met | 네트워크 0, export=사용자 명시행위 |
| reveal 전/후 레이아웃 | ✅ Met | CardFace/CardReveal 분리 |
| 빠른훑기 50/100/200/300 | ✅ Met | ScanService |
| 약점 복습 우선순위 큐 | ✅ Met | WeaknessService |
| 통계 streak/level/mature | ✅ Met | StatsRollupService idempotent |
| TTS ja-JP | ✅ Met | useTTS (미지원 silent) |
| JSON export/백업 | ✅ Met | exportPayload + ExportService |
| 6,200 verified | ✅ Met | jlpt.db verified=6200 |
| **Success Rate** | **10/10** | |

## 4. Modules Delivered (13)
skeleton · card-types · fsrs · session · scan · weakness · study-screen · done · stats · tts · settings · export · about+word-detail · home

## 5. Quality Evidence
- `npx tsc --noEmit` → 0 errors
- `vitest run` → 41/41 pass (7 files)
- `expo lint` → 0/0
- `release-gate` data block → 8/8 PASS (verified 6200, level counts, 5 assets, git)

## 6. Release Status (Go/No-Go)
| 영역 | 상태 | 비고 |
|---|---|---|
| 코드 + 데이터 | ✅ Go | Match ~99%, 6200 verified |
| eas.json submit.ios | ❌ No-Go | ascAppId + appleTeamId TBD (App Store Connect 값 필요) |
| Privacy/Support/Home URL | ❌ No-Go | HTTP 404 — git remote push + GitHub Pages 활성화 필요 (workflow ready) |
| 앱 아이콘/스플래시 | ⚠ TEMP | placeholder — 실제 디자인 교체 필요 |

→ 잔여 No-Go는 **코드 외 계정/인프라/디자인 산출물**. 개발 사이클은 완료.

## 7. Next Actions
1. App Store Connect 앱 생성 → eas.json ascAppId + appleTeamId 기입
2. git remote 추가 + push → GitHub Pages Source='GitHub Actions' 활성화 → URL 404→200
3. 실제 앱 아이콘/스플래시 디자인 교체 (gen-placeholder-icons.mjs 산출물 대체)
4. `npm run release-check` 전체 PASS 확인 → EAS Build → TestFlight/Play Internal
5. (선택) `/pdca archive ashitakanji` — 문서 아카이브
