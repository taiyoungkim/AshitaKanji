# JLPT 단어 학습 앱 - Plan

> ⛔ **SUPERSEDED (정본 아님)** — 이 문서는 v0.7.3 스냅샷입니다.
> **정본**: `docs/01-plan/features/ashitakanji.plan.md` (v0.7.4 이상).
> 출시 판단·요구사항은 정본만 참조하세요. 본 파일은 이력 보존용.

> 작성일: 2026-05-29 (**v0.7.3 - GitHub Pages 배포 준비 + grep gate 자기참조 해소**)
> 상태: Release-Ready Draft (출시 결정 항목 명문화)
> 다음 단계: `/pdca plan jlpt-vocab-app` → 정식 Plan 등록 → `/pdca design`
>
> v0.3: 수학적 일관성, QA 게이트 강화, KPI 격하, 스키마 보강, Again/Done 명문화, 7→8일
> v0.4: 헤비 유저용 학습 모드 분리 (SRS 신규 vs 빠른 훑기), 50/300 정책
> v0.5: **출시용 전환** — Feature 명명 명확화, 진척률 2종 분리, 데이터셋/저작권/
>      스토어 체크리스트/Data Safety/Device QA/Known Limitations/Support/Hotfix Plan
> v0.5.1: 데이터셋 1순위 Kaggle Robin Pourtaud (확인 후), fallback elzup MIT
> v0.5.2: ✅ Kaggle CC BY 4.0 확정. LICENSE-data-kaggle-jlpt.txt 작성. fallback 폐기
> v0.6: **MVP scope 200 → 6,200**, 스토어 명 = 아시타칸지(明日漢字),
>      페르소나 = 장기 학습자, GPT 초안 + 100% 사람 검수
> v0.6.1: ✅ Kaggle 원본 N1 포함 확인. 단일 출처 6,200 모두 커버
> v0.6.2: 출시 운영 결정 — 개인 개발자/개인 이메일/회사·도메인 없음,
>      Privacy·Support GitHub Pages 호스팅, OpenAI 사용자 기능 = 구독+서버 프록시,
>      검수 페이스 풀타임, Kaggle 레벨별 실측 카운트 확인
> v0.7: 리뷰 P0/P1/P2 반영 — "빈도 상위" → "편집자 큐레이션",
>      AI disclosure 표현 제거, OTA off + 네트워크 표현 정확화,
>      Tatoeba attribution 강화 (sentence_id/author/license),
>      검수 Go/No-Go 게이트, JSON export MVP 당김, is_beta 잔재 제거,
>      플레이스홀더 release blocker, V1.2 잔재 정리
> v0.7.1: LICENSE 파일 "top-frequency" → "curated", AI disclosure 회피 표현
>      완전 제거 (2곳), OTA 정책 충돌 해소 (MVP 핫픽스 = Store 빌드 재제출),
>      SUPPORT/PRIVACY draft 라벨 + export 정책 동기화,
>      RELEASE_DECISIONS v0.7 변경사항 추가, Tatoeba UX 경량화,
>      다음 액션 stale 제거, Known Limitations 표현 정확화
> v0.7.2: ✅ 모든 placeholder 실제 값으로 치환 완료.
>      GitHub = taiyoungkim/AshitaKanji, 이메일 = datin0214@gmail.com,
>      Privacy/Support URL = https://taiyoungkim.github.io/AshitaKanji/{privacy,support}/,
>      OpenAI 데이터 초안 한도 = $50.
>      SUPPORT/PRIVACY draft 라벨 제거. Placeholder 회귀 게이트만 CI에 유지.
> **v0.7.3**: GitHub Pages 배포 자산 생성 (`~/jlpt-app/site/`),
>      `deploy-pages.sh` 스크립트 (gh-pages 브랜치 자동 푸시),
>      grep gate 자기참조 해소 (스캔 대상 = site/ + docs/release/{PRIVACY,SUPPORT}.md + app/ + store-assets/),
>      404 해결 절차 명문화.

---

## 1. Executive Summary

| 항목 | 내용 |
|---|---|
| **Product Name (internal)** | ashitakanji (jlpt-vocab-app) |
| **Store Product Name** | **"아시타칸지 (明日漢字)"** |
| **부제 (안)** | 매일 한 자, JLPT N5-N1 단어를 평생 함께 |
| **MVP Scope 한 줄** | JLPT 전 레벨 6,200 검수 단어 + FSRS 회독 + 빠른 훑기 + 약점 복습 |
| **레벨별 단어 수** | N5: 300 / N4: 600 / N3: 1,100 / N2: 1,700 / N1: 2,500 / **합계 6,200** |
| **Platform** | React Native + Expo (iOS/Android) |
| **Backend** | MVP 없음 (로컬 SQLite). V1.2+ AI 구독 기능 도입 시 서버 프록시 필요 |
| **핵심 UX** | 한자만 노출 → 탭하면 히라가나/뜻 reveal → FSRS 등급 입력 |
| **MVP 초점** | **"오늘의 복습을 끝내게 만드는 경험"** + **"평생 함께 가는 단어장"** |
| **MVP 추정** | **데이터 9-11일 + 구현 6일 + 출시 준비 2일 = 약 14-18일** (풀타임 검수 + 병행 기준, 스토어 심사 제외) |
| **데이터 검수 정책** | GPT 초안 + 100% 사람 검수 (도구 사용, 콘텐츠는 사람 책임) |

> ⚠️ **명명 원칙**: "아시타칸지(明日漢字)" 단일 브랜드. 모든 스토어/스크린샷/마케팅 통일.
> 부제는 "JLPT N5-N1 단어장" 명시. 합격 보장/공식 등 과장 표현 금지.

### Value Delivered (4-perspective)

| 관점 | 내용 |
|---|---|
| **Problem** | 한자/히라가나/뜻 동시 노출 = 수동 읽기. 레벨 올라가도 같은 앱 못 씀 = 재구매/재학습 비용 |
| **Solution** | reveal UX + FSRS. N5부터 N1까지 한 앱에서 평생 함께. 레벨업 시 데이터 자동 확장 |
| **Function/UX Effect** | 1) 한자만 카드 2) 4단계 FSRS 등급 3) 레벨 선택 4) 5단계 동시 학습/혼합 5) 빠른 훑기 |
| **Core Value** | 매일 15분으로 JLPT 어휘 전체 6,200 장기기억화. **레벨업할 때마다 새 앱 안 받아도 됨** |

---

## 2. Primary Persona (v0.6 재정의)

### 1차 페르소나: **"장기 학습자"** (수년에 걸쳐 N5→N1)

| 항목 | 내용 |
|---|---|
| **이름 가칭** | 박서연, 27세, 회사원/대학생 (한국인) |
| **현재 일본어 수준** | N5~N4 진행 중 (단계는 사용자마다 다름) |
| **장기 목표** | 2-3년 안에 N1까지 도달 |
| **단기 목표** | 다음 JLPT 시험에서 한 레벨 합격 |
| **하루 학습 시간** | 15-30분 (시험 임박 시 1-2시간 가능) |
| **앱 사용 기간** | **수년 (앱 갈아탈 의향 거의 없음)** |
| **디바이스** | 단일 기기 사용자 (MVP 동기화 없음) |
| **기존 도구 불만** | 레벨별로 다른 앱 써야 함 / 학습 데이터 안 옮겨감 / 광고 |
| **돈 쓸 의향** | 광고 제거 5천원-1만원 1회. 구독 거부감 |
| **포기 사유 1순위** | "오늘 양 너무 많음" → 이탈 |

### 2차 페르소나 (서브): "시험 임박 헤비유저"
- N1 시험 1-2개월 남음, 하루 1-2시간 학습
- 빠른 훑기/약점 복습 모드 주 사용
- "단기 폭주" 가능한 도구 필요

### 페르소나 → 설계 결정 매핑
- **수년 사용** → user_card 보존 절대 원칙, 백업/export 우선 V1.1
- **레벨업 시 같은 앱 사용** → 레벨 선택/혼합 화면 MVP 포함
- **세션 15분 기본** → 일일 신규 12개 기본, 모드별 한도 설정
- **시험 임박 헤비유저** → 빠른 훑기 50/100/200/300개 모드 MVP
- **장기 학습** → 잔디 그래프(V1.1), 평생 통계
- **광고 거부** → MVP 광고 X

### 비대상 (Out of Persona)
- 단발성 학습자 (1주 안에 N5 끝내고 앱 삭제)
- 회화/문법 우선 학습자 (단어 외 기능은 V1.3+)
- 일본 거주자 현지 컨텍스트 학습자 (다른 앱)
- 어린이 (보호자 UX 필요)

---

## 3. 배경 & 레퍼런스

### 참조 앱
- **JLPT 회독** (com.yongcalcompany.jlptkanji)
  - 회독법 + 단순 UI + 무료/유료 모델

### 후기 인사이트
- "자주 보는 것이 왕도" → 반복 노출 우선
- "차근차근" → 점진적 누적이 핵심

### 본 앱 차별점
- **FSRS 간격반복** (단순 회독 → 과학적 스케줄)
- **reveal UX** (능동 회상 강제)
- **한자 분해 + 연상 노트** (정교화 부호화, V1.1)
- **취침 전 알림** (수면 통합, V1.1)

---

## 4. MVP / V1.1 / Later Scope (NEW)

### 🟢 MVP (약 14-18일, **JLPT N5-N1 전 레벨 6,200개**)
**원칙: "오늘 복습 끝낼 수 있는 경험" + "평생 함께 가는 단어장". 양·신뢰 모두 충족.**

| 기능 | 이유 |
|---|---|
| **N5-N1 전 레벨 6,200개 verified** | 페르소나 = 장기 학습자, 레벨업 시 같은 앱 |
| 레벨별: N5 300 / N4 600 / N3 1100 / N2 1700 / N1 2500 | 핵심 단어 선별 정책 |
| **레벨 선택 + 혼합 학습 화면** | 사용자가 현재 학습 레벨 선택 + 인접 레벨 혼합 가능 |
| 카드 reveal UX (한자→가나/뜻) | 핵심 UX |
| FSRS 4단계 등급 (Again/Hard/Good/Easy) | 알고리즘 효율 |
| **일일 신규 한도 (기본 12개, 고강도 최대 50개)** | 모드별 한도 |
| 오늘 복습 큐 + "끝!" 화면 | 도파민 루프 |
| Again 카드 세션 끝 미니 재도전 정책 | "오늘 끝" 명확화 |
| 학습 모드: 오늘 복습 / 신규 암기 / 빠른 훑기 / 약점 복습 | 장기·시험 임박 모두 대응 |
| 회독수/진척 통계 (**레벨별 + 전체**) | 장기 학습자 동기 유지 |
| 카드 타입 정책 (한자/가나/혼합 5종) | 데이터 정확성 |
| 로컬 SQLite + 학습 상태 영속화 + review_log | 데이터 보존 + 디버깅 |
| TTS 발음 (expo-speech) | 가벼움, 핵심 학습 보조 |
| **데이터 내보내기 (JSON export)** | 장기 학습 = 데이터 안전망 필수 (v0.7 MVP 당김) |

### 🟡 V1.1 (MVP 후 2-3주)
| 기능 | 사유 |
|---|---|
| 푸시 알림 (취침 전/기상 후) | 장기 retention ↑ |
| 한자 분해 보기 (Kanjidic2) | 정교화 부호화 |
| 연상 노트 필드 | 개인화 부호화 |
| Leech 감지 + 격리 | 학습 효율 |
| 빠른 훑기/분류 모드 고도화 | 시험 전 대량 스캔 |
| 약점 복습 모드 고도화 | 최근 Again/헷갈림 카드 집중 |
| Young/Mature 통계 분리 | 진척 가시화 |
| 잔디 그래프 (장기 학습자 핵심) | 동기 유지 |
| ~~데이터 내보내기 (JSON export)~~ | v0.7에서 **MVP로 당김** (장기 학습 = 데이터 안전망 필수) |
| 단어 검색 | 특정 단어 찾기 |
| 카드 오류 신고 버튼 | 6,200개 미세 오류 누적 대응 |
| **Opt-in 익명 분석** (Sentry/PostHog) | 제품 KPI 측정 시작 |

### 🔵 V1.2+ (Later)
| 기능 | 사유 |
|---|---|
| 네이버 사전 WebView | 학습 보조, 핵심은 아님 |
| GPT 질문 기능 (구독권 + 서버 프록시) | API 비용 통제, 키 노출 방지, 오답 리스크 |
| 인터리빙 모드 (레벨 혼합) | 중급 이상 필요 |
| 다크모드 | iOS/Android 시스템 follow 우선 자동 |
| 홈스크린 위젯 | OS별 구현 비용 큼 |
| 광고 제거 1회 결제 (IAP) | 수익화 |
| 클라우드 동기화 (bkend.ai) | 다기기 사용자 |
| 데이터 가져오기 (JSON import) | export 후 |
| 사용자 커스텀 단어장 | 고급 사용자 |

### 컷 사유 정리
- **GPT**: 클라 키 노출 + 오답 리스크 + 입력 UX 부담 = MVP 부적합
- **네이버 WebView**: 외부 의존, MVP는 자체 데이터로 충족
- **알림**: 권한 요청 UX = 첫 인상 부담. 본 사용 1주 후 제안이 자연스러움

---

## 5. Card Type Policy (NEW) ⭐ 데이터 작업 전 확정

### 카드 타입 5종

| 타입 | 예시 | 한자 면 표시 | reveal 면 표시 | 특이사항 |
|---|---|---|---|---|
| **A. 순수 한자** | 勉強 | `勉強` | `べんきょう` / 공부 | 표준 케이스 |
| **B. 한자+오쿠리가나** | 食べる | `食べる` | `たべる` / 먹다 | 활용형 어미 노출 OK |
| **C. 순수 가나** | ありがとう | `ありがとう` | (가림 없음) / 감사 | reveal = 뜻만 |
| **D. 가타카나 외래어** | テレビ | `テレビ` | (가림 없음) / TV | C와 동일 처리 |
| **E. 혼합/오쿠리가나 다수** | お土産 | `お土産` | `おみやげ` / 선물 | B와 동일 처리 |

### 다중 읽기 단어 (生 = せい/しょう/なま/いきる)
- **단어 단위로 등록** → 각 읽기는 별도 카드
  - 生徒 → せいと / 학생
  - 生 (なま) → なま / 날것
  - 生きる → いきる / 살다
- 동형이의어는 `id`로 구분 (예: `sei_to_001`, `nama_002`)

### 한자 없는 단어 reveal 동작
- 한자 면 = reveal 면 텍스트 동일 (가나)
- reveal 버튼 = **뜻만 노출**
- "이미 보임" 표시로 사용자 혼란 방지

### 동형이의어 (Homograph) vs 동음이의어 (Homophone)
용어 분리해서 데이터 모델 깨끗하게.

**동형이의어 (Homograph)** = 표기 같음, 읽기/뜻 다름
- 예: 生 → せい(생명) / なま(날것) / いきる(살다)
- 처리: **별도 카드**, `surface` 동일, `reading_kana`+`meaning_ko` 다름, `disambig` 필드로 구분

**동음이의어 (Homophone)** = 표기 다름, 발음 같음
- 예: はし → 橋(다리) / 箸(젓가락) / 端(끝)
- 처리: **각각 별도 단어**, `surface` 다름. 카드 모델상 특별 처리 불필요
- 학습 보조: V1.1에서 "비슷한 발음" 섹션으로 함께 보여주기 가능

### 가나 변환 정책
- 데이터셋에 가타카나로 들어온 외래어 그대로
- 히라가나 변환 X (의미 손실)
- 후리가나는 별도 필드 (`furigana`) 추가 검토

### 표시 우선순위
1. **한자가 있으면 한자 우선** (B형 포함)
2. 한자 없으면 원형(가나) 그대로
3. JLPT 공식 표기 기준 따름

---

## 6. 기술 스택

| 영역 | 선택 | 사유 |
|---|---|---|
| Framework | Expo (managed) + RN + TypeScript | iOS/Android 동시, OTA |
| Navigation | expo-router | 파일 기반 |
| 로컬 DB | **expo-sqlite** | 수백~수천 단어 + SRS 큐 |
| KV 설정 | AsyncStorage | 가벼움 |
| 보안 보관 | expo-secure-store | (V1.2 구독 토큰/세션 등 필요 시) |
| TTS | expo-speech (`ja-JP`) | 내장 무료 |
| 푸시 | expo-notifications | (V1.1) |
| WebView | react-native-webview | (V1.2 네이버) |
| **SRS** | **`ts-fsrs` npm** | FSRS 표준 |
| 차트 | victory-native | 통계 |

---

## 7. 데이터 파이프라인

### 데이터셋 선정 — **출시 전 결정 필수 (보류 X)**

| 후보 | 라이선스 | 단어 수 | 한국어 뜻 | 예문 | 평가 |
|---|---|---|---|---|---|
| **Kaggle `robinpourtaud/jlpt-words-by-level`** ✅ | **CC BY 4.0** | 8,130 (N1-N5 모두 포함) | X (영어) | X | **채택 확정** (상업 OK, attribution 필수) |
| `elzup/jlpt-word-list` | MIT | ~700 (N5) | X (영어) | X | 라이선스 안전, fallback |
| `jonathanlevitan/jlpt-vocab` | 미명시 | ~600 | X | X | 라이선스 미명시 = **사용 금지** |
| JMdict | CC-BY-SA | 풍부 | 일부 | 일부 | 파생물도 SA, 신중 |
| Tatoeba | CC-BY | - | 한국어 일부 | ✅ 풍부 | **예문용 채택** |

### 결정 (v0.6 — 전 레벨 확장)
- **단어 마스터**: ✅ **Kaggle Robin Pourtaud `jlpt-words-by-level` (CC BY 4.0)** — 채택 확정
  - 출처: https://www.kaggle.com/datasets/robinpourtaud/jlpt-words-by-level
  - 라이선스: https://creativecommons.org/licenses/by/4.0/
  - 원본: 8,130개 (✅ **N1-N5 모두 포함 확인 완료**)
  - 사용 범위: 레벨별 **편집자 큐레이션 세트** (N5 300 / N4 600 / N3 1,100 / N2 1,700 / N1 2,500 = **6,200**)
  - 단일 출처 = 단일 라이선스 작업으로 단순화
  - **선별 기준** (Kaggle 원본에 빈도 컬럼 없음):
    1. 카드 타입 균형 (A 한자 / C 가나 비율 자연스럽게)
    2. 품사 균형 (명사 편중 방지)
    3. 학습자 단계 적합도 (편집자 판단)
    4. 외래어/속어/금기어 필터
    5. V1.1+ 빈도 보조 데이터 결합 검토 (Tanos / JMdict ke_pri)
  - **스토어 표기 의무**: "빈도 상위", "JLPT 전체" 같은 표현 금지. "**핵심 선별 6,200개**", "**편집자 큐레이션**"으로 표기

### Kaggle CSV 실측 결과 (2026-05-28, `/Users/tyoung/Downloads/jlpt_vocab.csv`)

| 레벨 | CSV 실제 수 | 선별 목표 | 여유분 | 충족 여부 |
|---|---:|---:|---:|---|
| N5 | 718 | 300 | +418 | ✅ |
| N4 | 668 | 600 | +68 | ✅ |
| N3 | 2,139 | 1,100 | +1,039 | ✅ |
| N2 | 1,906 | 1,700 | +206 | ✅ |
| N1 | 2,699 | 2,500 | +199 | ✅ |
| **합계** | **8,130** | **6,200** | **+1,930** | ✅ |

데이터 품질 메모:
- 컬럼: `Original`, `Furigana`, `English`, `JLPT Level`
- 한국어 뜻 없음 → `English` 기반 GPT 초안 + 사람 검수 필요
- 빈 필드: `Furigana` 2건
- 완전 중복 행: 1건
- 같은 `Original+Furigana` 중복/레벨 중복 후보: 97건 → 정규화 단계에서 대표 레벨/alt 처리 필요

### CC BY 4.0 의무사항 (전부 충족 필수)
1. 원저작자 표시: Robin Pourtaud
2. 출처 링크: Kaggle URL
3. 라이선스 링크: CC BY 4.0 URL
4. **변경 사항 명시**: "JLPT 레벨별 핵심 선별 세트 (6,200, 편집자 큐레이션), 한국어 뜻 추가 (GPT 초안 + 사람 검수), 카드 타입 분류 추가, 예문 외부 출처 결합 (Tatoeba)"

표기 위치: ① LICENSE-data-kaggle-jlpt.txt ② 앱 내 "정보 > 라이선스" ③ 스토어 설명 (선택)
- **한국어 뜻**: **GPT-4o 초안 + 100% 사람 검수 (6,200개)** + 사전 교차 검증
  - v0.6 정책 변경: scope 200 → 6,200으로 늘면서 GPT 도구 활용이 합리적
  - GPT = 도구 (input boost), 콘텐츠 책임 = 사람 (검수자)
  - GPT는 **내부 초안 생성 도구**이며, 출시 콘텐츠는 사람 검수 완료 데이터로 관리
  - Google Play AI policy 준수: 사용자 직접 노출 AI 생성 콘텐츠 X (검수 통과만 노출)
- **예문**: **Tatoeba CC-BY** (일본어 + 한국어 일부) + 부족 시 자체 작성

### 블로그 참고 분석 (irukai.tistory.com/11)
같은 Kaggle 원본을 GPT-4o-mini로 가공하는 사례. **워크플로 일부 채택, 출시 정책은 우리 식으로 강화**:
- 채택: GPT 초안 자동 생성 (단어 마스터 → 한국어 뜻 매핑)
- 차별: **모든 단어 100% 사람 검수 필수** (블로그는 자동 가공만)
- 차별: 신뢰도 점수로 우선순위 검수 (CLI 도구)
- 차별: 출시 콘텐츠는 사람 검수 완료 데이터로 관리

### 출시 전 결정/책임 매트릭스 (전부 채워야 출시 가능)

| 항목 | 결정 | 책임자 | 증거/링크 |
|---|---|---|---|
| 단어 마스터 데이터셋 | ✅ **Kaggle Robin Pourtaud (CC BY 4.0)** | 본인 | Kaggle URL + 스크린샷 |
| 데이터셋 라이선스 텍스트 사본 | `LICENSE-data-kaggle-jlpt.txt` 작성 | 본인 | 리포 루트 |
| 데이터셋 attribution 표기 | 4항목 (저자/출처/라이선스/변경 사항) | 본인 | 앱 정보 화면 + LICENSE 파일 |
| 한국어 뜻 생성 방식 | **GPT-4o 초안 + 100% 사람 검수** (6,200) | 본인 | qa_log.csv, gpt_responses/ |
| 한국어 뜻 검수 책임자 | 본인 (qa-cli 사용) | 본인 | `qa_log.csv` |
| 예문 출처 | **Tatoeba CC BY 2.0 FR** (부족분 자체) | 본인 | sentence_id/author 컬럼 5개 + 단어 상세 author 표기 + About > Example Sources 총괄 attribution + author 목록 파일 |
| 한자 폰트 저작권 | 시스템 폰트 사용 | - | 별도 라이선스 불필요 |
| 앱 내 크레딧 화면 | "정보 > 라이선스" | 본인 | MVP 포함 |
| 데이터셋 README 출처 표기 | "Powered by {dataset} ({license})" | 본인 | About 화면 |
| GPL/AGPL 데이터 사용 여부 | **사용 금지** (앱 폐쇄소스 충돌) | - | - |
| GPT/AI 가공 사용 여부 | **데이터 초안 생성에 사용** (출시 콘텐츠는 100% 사람 검수) | 본인 | `gpt_responses/`, `qa_log.csv` |
| 사용자향 AI 질문 기능 | **MVP 제외, V1.2+ 구독권 + 서버 프록시** | 본인 | 별도 PRD |

### 빌드 파이프라인
```
data/csv/{n1,n2,n3,n4,n5}.csv  (총 6,200개, GPT 초안 + 100% 사람 검수 verified)
    ↓ scripts/build-db.ts
assets/jlpt.db (앱 번들)
    ↓ 첫 실행 시 documentDir 복사
user_card 테이블 생성 (학습 상태)
```

### 정규화 CSV 스키마
```
id, level, surface, reading_kana, furigana, meaning_ko, 
part_of_speech, card_type, example_jp, example_ko, 
source, qa_status, tags
```

---

## 8. Data QA Plan (v0.6 — GPT 초안 + 100% 사람 검수)

### 정책 변경 (v0.6)
- 이전: 100% 자체 작성, 200개
- **현재: GPT 초안 + 100% 사람 검수, 6,200개**
- GPT = 도구 (input boost), 검수자 = 사람 (content owner)
- 모든 단어가 사람 검수 거침 = 출시 콘텐츠는 사람 검수 완료 데이터로 관리
- 출시 시 사용자 노출 = `qa_status='verified'`만

### 워크플로 (단어당 평균 15초)
```
1. Kaggle 원본 import
   → kanji, hiragana, English, level
2. 자동 정규화 (scripts/normalize.ts)
   → 중복 제거 (surface+reading_kana+meaning_ko 해시)
   → 빈 필드 검출
   → 카드 타입 자동 분류 (A/B/C/D/E)
   → 레벨별 핵심 선별 (300/600/1100/1700/2500, 편집자 큐레이션 기준)
3. GPT-4o 초안 생성 (scripts/gpt-draft.ts, 배치)
   → 영어 뜻 + 한자/가나 → 한국어 뜻 초안
   → 품사 분류 초안
   → 신뢰도 점수 (0-1) 함께 저장
   → 비용 추정: 6,200 × 0.0001$ ≈ $1-3 (4o-mini), $20-50 (4o)
   → qa_status='gpt_draft'
4. 사람 검수 CLI (scripts/qa-cli.ts)
   → 신뢰도 낮은 단어부터 표시
   → 사전 교차 (외부 링크 자동 열기 옵션)
   → 키 입력: y(accept) / e(edit) / r(reject) / s(skip)
   → 단어당 평균 15초 (의심 단어는 30-60초)
   → 6,200 × 15초 ≈ 26시간 = 4-5일 (집중 시)
   → qa_status='verified' 또는 'rejected'
5. 출시 = verified만 노출
```

### 검수 항목 (단어당)
- [ ] 한국어 뜻 정확성 (사전 교차)
- [ ] 히라가나/가타카나 정확성
- [ ] 카드 타입 분류 (A/B/C/D/E) 맞는지
- [ ] 품사 적절한지
- [ ] 부정적 의미/속어/금기어 필터 (출시 부적합)
- [ ] (선택) 예문 1개 자연스러움

### 검수 페이스 (결정: 풀타임)
- 검수 모드: **풀타임 집중**
- 1세션 50-100개 단어 (15-25분), 세션 사이 5-10분 휴식
- 목표 처리량: 800-1,000개/일 (N5-N4) / 500-700개/일 (N3-N1, 뉘앙스 복잡)
- 6,200 추정 = **약 8-10일** (레벨별 차등 반영)
- 품질 가드:
  - 하루 마지막 50개는 다음 날 샘플 재검수
  - 신뢰도 < 0.7 또는 사람이 수정한 항목은 별도 재검수 큐
  - 레벨별 5% 랜덤 샘플 2차 검수

### Go/No-Go 게이트 (출시 차단 기준)
| 단계 | 통과 기준 | 실패 시 |
|---|---|---|
| **레벨별 5% 샘플 2차 검수** | 오답률 ≤ 1% | 해당 레벨 100% 재검수 |
| **N1/N2 샘플 별도 강화** | 뉘앙스 오답률 ≤ 2% (관용/문맥 의존 단어 별도) | 단어당 검수 시간 30초 → 60초로 상향, 재검수 |
| **금기어/속어/오류 출시 부적합** | 0건 | 즉시 제거 |
| **카드 타입 분류 오류** | ≤ 0.5% | 자동 분류 알고리즘 재조정 |
| **레벨 잘못 분류 (Kaggle 원본 오류)** | ≤ 1% | 단어 제외 또는 레벨 이동 |

게이트 미통과 = MVP 출시 차단. 재검수 완료까지 출시 보류.

### 검수 가이드라인 문서 (`docs/qa-guide.md`)
- 단어당 검수 체크리스트
- 한국어 뜻 작성 규칙 (길이/품사/예외)
- 사전 교차 검증 절차 (jisho.org, 네이버 일본어 사전)
- 뉘앙스 표현 (관용/속어/방언) 처리 방침
- V1.1 외주 검수자 인계 대비

### 자동 검증 게이트 (모든 데이터, GPT 전후)
- 빈 필드 X
- 한자 정규식 검증
- 히라가나/가타카나 문자 검증
- meaning_ko 길이 1-50자
- GPT 답변 JSON schema 검증

### 신뢰도 낮은 GPT 초안 (직접 작성)
- 신뢰도 < 0.7 = 검수 화면에서 빈 칸으로 표시, 사람이 직접 작성
- 신뢰도 ≥ 0.7 = GPT 초안 표시, 검수자가 accept/edit/reject

### 사용자 신고 루프 (V1.1)
- 카드 상세 "오류 신고" 버튼
- 신고 → 로컬 로그 → 다음 데이터 업데이트에 반영

### 베타 단어 정책 (v0.6 변경)
- 이전: 200 verified + 500 beta로 분리
- 현재: **6,200 모두 verified만 출시** = 베타 개념 폐기
- 검수 미완료 단어는 출시 시 단순 제외 (사용자 입장 = 보이지 않음)
- V1.1 이후 검수 누적 시 점진 추가

### 중복 처리 규칙
- 완전 중복 → 제거
- 동형이의어 → `disambig` 필드로 구분 유지 (별도 카드)
- 같은 단어 다른 표기 → 대표 표기 1개 + `alt_forms` 필드

### 예문 출처 정책
- 자체 작성 또는 CC 라이선스만 사용 (Tatoeba CC BY 2.0 FR)
- Tatoeba 예문은 **개별 attribution 필수** (sentence_id, author, license)
- 컬럼: `example_jp_id`, `example_jp_author`, `example_ko_id`, `example_ko_author`, `example_license`
- **UX 분리** (6,200 규모 → 화면 비대 방지):
  - **단어 상세 화면**: 노출 예문의 **author만** 작게 표시 (예: "예문 © contrib123 · Tatoeba CC BY")
  - **설정 > About > Example Sources**: Tatoeba 총괄 attribution + 전체 author 목록 파일 링크 (`assets/tatoeba-authors.txt`, 앱 번들 동봉)
- 빈 attribution = 예문 미노출 (안 보여줌)
- 출처 불명 예문은 비워두고 V1.1에서 보강

### QA 도구
- 간단한 CLI: `scripts/qa-cli.ts`
- 입력: CSV → 한 줄씩 표시 → y/n/edit 선택
- 출력: `data/csv/n{1..5}-verified.csv`

---

## 9. DB 스키마

```sql
-- 단어 마스터
CREATE TABLE word (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  surface TEXT NOT NULL,           -- 표기 (한자 또는 가나, 한자 면에 표시)
  reading_kana TEXT NOT NULL,      -- 읽기 (히라가나/가타카나)
  furigana TEXT,                   -- 후리가나 (B형 한자+오쿠리가나 용)
  meaning_ko TEXT NOT NULL,
  part_of_speech TEXT,
  card_type TEXT NOT NULL,         -- A/B/C/D/E
  example_jp TEXT,
  example_ko TEXT,
  -- Tatoeba attribution (CC BY 2.0 FR 요구사항)
  example_jp_id INTEGER,           -- Tatoeba sentence ID (일본어)
  example_jp_author TEXT,          -- Tatoeba 저자명
  example_ko_id INTEGER,           -- Tatoeba 번역 ID (한국어)
  example_ko_author TEXT,          -- Tatoeba 번역 저자명
  example_license TEXT,            -- 기본 'CC-BY-2.0-FR' 또는 'self'
  alt_forms TEXT,                  -- JSON array
  disambig TEXT,                   -- 동형이의어 구분 (생명/날것/살다)
  source TEXT,                     -- 데이터셋 출처
  qa_status TEXT NOT NULL,         -- verified / auto / needs_review / rejected
  deprecated INTEGER DEFAULT 0,    -- 업데이트로 폐기된 단어
  tags TEXT,                       -- JSON array
  data_version INTEGER NOT NULL
);

CREATE INDEX idx_word_level ON word(level);
CREATE INDEX idx_word_qa ON word(qa_status);

-- 사용자 학습 상태 (FSRS)
CREATE TABLE user_card (
  word_id TEXT PRIMARY KEY,
  difficulty REAL,                 -- FSRS D
  stability REAL,                  -- FSRS S
  scheduled_days INTEGER,          -- FSRS 마지막 스케줄 간격
  elapsed_days INTEGER,            -- FSRS 마지막 리뷰부터 경과
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_review INTEGER,             -- unix ms
  due INTEGER,
  state TEXT,                      -- new/learning/review/relearning
  note TEXT,                       -- (V1.1)
  leech INTEGER DEFAULT 0,
  FOREIGN KEY(word_id) REFERENCES word(id)
);

CREATE INDEX idx_due ON user_card(due);
CREATE INDEX idx_state ON user_card(state);

-- 리뷰 로그 (모든 등급 입력 기록 - FSRS 검증, undo, 통계용)
CREATE TABLE review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id TEXT NOT NULL,
  reviewed_at INTEGER NOT NULL,    -- unix ms
  grade INTEGER NOT NULL,          -- 1=Again, 2=Hard, 3=Good, 4=Easy
  state_before TEXT,
  state_after TEXT,
  scheduled_days INTEGER,
  elapsed_days INTEGER,
  stability_after REAL,
  difficulty_after REAL,
  reveal_ms INTEGER,               -- 한자 노출 → reveal 시간 (능동 회상 지표)
  session_id INTEGER,
  FOREIGN KEY(word_id) REFERENCES word(id),
  FOREIGN KEY(session_id) REFERENCES session(id)
);

CREATE INDEX idx_log_word ON review_log(word_id);
CREATE INDEX idx_log_session ON review_log(session_id);
CREATE INDEX idx_log_time ON review_log(reviewed_at);

-- 빠른 훑기/분류 결과 (대량 노출은 FSRS에 바로 넣지 않음)
CREATE TABLE scan_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id TEXT NOT NULL,
  scanned_at INTEGER NOT NULL,     -- unix ms
  result TEXT NOT NULL,            -- 'known' / 'confused' / 'unknown' / 'later'
  batch_size INTEGER,              -- 50/100/200/300
  promoted_to_srs INTEGER DEFAULT 0,
  session_id INTEGER,
  FOREIGN KEY(word_id) REFERENCES word(id),
  FOREIGN KEY(session_id) REFERENCES session(id)
);

CREATE INDEX idx_scan_word ON scan_result(word_id);
CREATE INDEX idx_scan_result ON scan_result(result);
CREATE INDEX idx_scan_session ON scan_result(session_id);

-- 학습 세션 (세션 완료율, 중도 이탈률 측정용)
CREATE TABLE session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,               -- 'review' / 'new' / 'scan' / 'weakness'
  started_at INTEGER NOT NULL,
  ended_at INTEGER,                -- NULL = 진행 중 또는 비정상 종료
  ended_reason TEXT,               -- 'completed' / 'abandoned' / 'app_killed'
  planned_new INTEGER,
  planned_review INTEGER,
  planned_scan INTEGER,
  done_new INTEGER DEFAULT 0,
  done_review INTEGER DEFAULT 0,
  done_scan INTEGER DEFAULT 0,
  again_count INTEGER DEFAULT 0
);

-- 이벤트 로그 (UI 인터랙션, 모달 열기 등 - 가벼운 분석용)
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,              -- 'app_open' / 'tts_play' / 'done_screen' / 'settings_change' 등
  payload TEXT                     -- JSON (선택)
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_ts ON events(ts);

-- 일일 집계 (lazy rollup: 앱 시작/세션 종료/통계 화면 진입 시 계산)
-- 모바일 자정 백그라운드 작업은 OS가 죽이면 보장 안 되므로 lazy 채택
CREATE TABLE daily_stats (
  date TEXT PRIMARY KEY,           -- YYYY-MM-DD
  new_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  scan_count INTEGER DEFAULT 0,
  scan_promoted_count INTEGER DEFAULT 0,
  again_count INTEGER DEFAULT 0,
  good_easy_count INTEGER DEFAULT 0,
  total_time_sec INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  completed_session_count INTEGER DEFAULT 0,
  avg_reveal_ms REAL
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- 예: data_version, app_install_date, last_export_date, beta_words_unlocked
```

---

## 10. 핵심 화면 (MVP)

| 화면 | MVP 기능 |
|---|---|
| **Home** | 오늘 복습 카운트, 신규 할당량, "시작" 버튼, 더 공부하기 진입 |
| **Study (카드)** | 한자 면 → reveal → 4단계 등급. 카드 타입별 분기 |
| **Done!** | "오늘 끝!" 축하 화면 + 회독수 증가 표시 |
| **Stats** | 회독 합계, N5 학습 진척률 (단순) |
| **Settings** | 학습 강도(신규 한도), TTS 속도, 베타 단어 포함 |

### Home 정보 구조
```
오늘 할 일
[오늘 복습 시작]         due + 오늘 신규 12개

더 공부하기
[새 단어 외우기]         5/12/20/30/50개
[시험 전 빠른 훑기]      50/100/200/300개 (분류 모드)
[약점만 다시 보기]       Again/헷갈림/Leech 중심
```

원칙:
- 첫 CTA는 항상 **오늘 복습 시작**. 앱이 권장하는 최소 성공 루틴.
- "새 단어 외우기"는 FSRS에 정식 등록되는 장기기억 모드.
- "시험 전 빠른 훑기"는 대량 노출/분류 모드. 모든 카드를 FSRS에 바로 넣지 않음.
- "약점만 다시 보기"는 신규를 늘리지 않고 효율을 높이는 보조 모드.

### "Done!" 화면 = MVP 핵심
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
이 화면 도달 = 도파민 = retention. **이거 못 만들면 MVP 실패.**

### "오늘 완료" 정의 (Again 정책과의 충돌 해소)
세션 진행 단계:
1. **Main round**: 오버듀 복습 + 어제 학습 + 신규 N개 처리. 모두 일단 한 번씩 등급 매김
2. **Again 미니 라운드**: Main round에서 Again 받은 카드만 다시 (세션 끝, 한 번 더)
3. **완료 조건**:
   - Again 미니 라운드까지 큐 비면 → **"오늘 끝!" 화면**
   - **같은 세션에서 같은 카드 2회 Again** → 자동으로 lapses+1 처리 후 내일 학습 큐로 미룸 (강제 휴식)
4. **무한 루프 방지**: 세션 내 단일 카드 최대 2회 노출

즉 "Again <10분 재등장"은 **세션 끝의 미니 라운드** 형태로 구현. Main round 도중에 즉시 재삽입 X. → 사용자는 "지금 보는 카드 다 끝나면 진행도 100%" 예측 가능.

---

## 11. FSRS 알고리즘

### 4단계 등급
| 버튼 | 의미 | 효과 |
|---|---|---|
| Again | 못 떠올림 | 세션 끝 미니 라운드에서 재시도. 2회 실패 시 lapses+1, 내일로 |
| Hard | 떠올렸지만 힘듦 | 짧은 간격 |
| Good | 정상 회상 | 표준 간격 |
| Easy | 즉답 | 긴 간격 ×1.3 |

### 일일 한도 기본값 **12개**, 5-50 조절 가능
- 12개 선택 근거: 페르소나 하루 15-30분 학습 시간 부합
- N5 300 ÷ 12 ≈ 25일, N1 2500 ÷ 12 ≈ 7개월 = 장기 학습 페르소나 부합
- 30개 이상: 고강도 경고 표시
- 50개: SRS 신규 암기 최대치. 50개 초과는 빠른 훑기 모드로 안내
- 시험 임박 헤비유저는 빠른 훑기 + 약점 복습 모드로 보강

### 큐 우선순위
1. 오버듀 복습 (가장 중요)
2. 어제 학습 재확인
3. 신규 N개
4. (세션 끝) Again 미니 라운드

### 고강도 학습 정책 (50개/day, 300개/day 대응)

핵심 원칙: **암기 등록(SRS)과 대량 노출(크램/스캔)을 분리한다.**

하루 300개를 모두 FSRS 신규 카드로 등록하면 며칠 뒤 복습 부채가 폭증하고 "오늘 끝" 경험이 무너진다. 따라서 앱은 사용자의 학습 의도를 숫자가 아니라 목적별 모드로 분류한다.

| 모드 | 목적 | 권장량 | FSRS 반영 |
|---|---|---|---|
| **오늘의 복습** | 장기기억 유지 | due + 오늘 신규 | 정식 반영 |
| **신규 암기** | 새 단어를 장기기억 큐에 추가 | 5 / 12 / 20 / 30 / 50 | 정식 등록 |
| **빠른 훑기** | 시험 전 대량 스캔, 모르는 단어 선별 | 50 / 100 / 200 / 300 | 전부 등록 X, 후보만 편입 |
| **약점 복습** | 최근 Again/헷갈림/Leech 집중 | 자동 산정 | 신규 증가 없음 |

#### 신규 암기 모드
- 5개: 가볍게
- 12개: 기본 추천
- 20개: 빠르게
- 30개: 고강도
- 50개: 매우 고강도 (경고 후 허용)
- 50개 초과는 선택 불가. "시험 전 빠른 훑기"로 안내

50개 선택 시 경고 문구:
```
고강도 모드는 며칠 뒤 복습량이 크게 늘어납니다.
시험 준비 중이 아니라면 12-20개를 추천합니다.
```

#### 빠른 훑기 모드
- 50/100/200/300개 선택 가능
- MVP 6,200개 모두 verified → 어떤 모드 풀에서도 300개까지 가능
- 25개 단위 세트로 쪼개서 진행 (예: 300개 = 25개 × 12세트)
- 기본적으로 FSRS에 전체 등록하지 않음
- 카드 버튼은 4개:
  - **안다**: known 처리. SRS 미등록 또는 긴 간격 후보
  - **헷갈림**: SRS 편입 후보
  - **모름**: SRS 편입 후보, 우선순위 높음
  - **나중에**: 미등록 보류

세션 종료 화면:
```
300개 훑기 완료
안다 180개
헷갈림 70개
모름 35개
나중에 15개

오늘 SRS에 넣을 추천 단어: 30개
[30개만 암기 큐에 추가] [50개까지 추가]
```

SRS 편입 규칙:
- `모름` > `헷갈림` 순서로 우선 편입
- 기본 추천 편입량 30개, 최대 50개
- 편입되지 않은 카드는 `scan_result`만 저장하고 due 큐에는 넣지 않음
- "안다" 카드는 기본적으로 `scan_result='known'`으로만 남기고 SRS에는 넣지 않음. 사용자가 원할 때만 긴 간격 카드로 전환

#### 약점 복습 모드
- 최근 7일 Again 카드
- reveal 시간이 긴 카드
- Leech 카드
- 빠른 훑기에서 `헷갈림`/`모름`으로 표시했지만 아직 SRS에 편입하지 않은 카드

약점 복습은 신규 학습량을 늘리지 않고 사용자의 "더 공부하고 싶다"는 욕구를 흡수하는 안전한 출구로 사용한다.

---

## 12. 장기기억 최적화 원리 → 앱 반영 매핑

| 원리 | 반영 시점 |
|---|---|
| 망각곡선 | MVP (FSRS) |
| 능동 회상 | MVP (reveal) |
| 바람직한 어려움 | MVP (한자만 노출) |
| 이중부호화 | MVP (TTS) |
| 정교화 부호화 | V1.1 (연상 노트, 한자 분해) |
| 수면 통합 | V1.1 (알림) |
| 인터리빙 | V1.2 (레벨 혼합) |

---

## 13. 외부 연동 (V1.2+, MVP 아님)

| 기능 | 방식 | 시점 |
|---|---|---|
| 네이버 사전 | WebView | V1.2 |
| GPT 질문 | 구독권 + 서버 프록시 + 사용량 제한 | V1.2 |
| 푸시 알림 | expo-notifications | V1.1 |

---

## 14. Learning Success Metrics (NEW)

### 📌 측정 가능 범위 명시 (중요)
- **MVP**: 클라우드 분석 X → **본인 데이터만 측정 가능**. 전체 사용자 KPI는 V1.1+ opt-in 분석 후
- 따라서 MVP 지표 = "개인 학습 지속 지표"로 격하. 제품 KPI는 V1.1+

### A. 개인 학습 지속 지표 (MVP, 로컬 측정)
사용자 자신이 통계 화면에서 보는 지표. 외부 송신 X.

| 지표 | 개인 목표 (가이드) | 측정 (로컬) |
|---|---|---|
| **연속 학습일 (streak)** | 5일+ 유지 | `daily_stats` 빈 날 카운트 |
| **세션 완료율** | 본인 평균 70%+ | `session.ended_reason='completed'` / 전체 |
| **세션 정답률** | 본인 80%+ (Good+Easy) | `review_log` 등급 비율 |
| **Mature 카드 수** | 30일 내 학습 단어의 50%+ | `user_card.stability ≥ 21d` |
| **Leech 비율** | <5% | `user_card.leech=1` 카드 |
| **레벨별 진척률** | 자율 (선택 레벨 기준) | 레벨 내 학습 시작 카드 / 레벨 단어 수 |
| **전체 진척률** | 장기 (수년) | 6,200 중 학습 카드 비율 |
| **평균 reveal 시간** | 2-8초 | `review_log.reveal_ms` 평균 |

**진척률 표시 원칙**:
- 통계 화면 = **레벨별 막대 5개 (N5/N4/N3/N2/N1) + 전체 합계 1개** 별도 카드
- 현재 학습 중 레벨 = 강조 표시
- 미시작 레벨 = 비활성/회색
- "JLPT 합격 보장" 문구 앱 내 사용 금지 → "N5 단어 N% 학습", "전체 진척률 N%"

**진척률 추정 (단순 가이드)**:
| 레벨 | 단어 수 | 12개/일 시 신규 완주 | 추천 학습 기간 |
|---|---|---|---|
| N5 | 300 | 25일 | 1-2개월 |
| N4 | 600 | 50일 | 2-4개월 |
| N3 | 1,100 | 92일 | 4-6개월 |
| N2 | 1,700 | 142일 | 6-12개월 |
| N1 | 2,500 | 208일 | 8-18개월 |
| **합계** | **6,200** | **517일 = 약 1.5년** | **2-3년 장기 학습** |
- 신규만 카운트, 복습 + Mature까지는 +50% 시간 추가

### B. 제품 KPI (V1.1+ opt-in 분석 도입 후)
| 지표 | 목표 | 측정 도구 |
|---|---|---|
| D1/D7/D30 retention | 50/30/15% | PostHog/Mixpanel 익명 이벤트 |
| 평균 세션 길이 | 12-18분 | 위와 동일 |
| 신규 사용자 1주 내 "Done!" 도달률 | 60%+ | 위와 동일 |
| 크래시 프리 세션 | 99.5%+ | Sentry |

### C. 안티 지표 (UX 재검토 트리거, 로컬도 측정 가능)
- 평균 reveal 시간 <1초 → 능동 회상 실패 → reveal 강제 딜레이 검토
- 본인 Again 비율 >40% → 신규 한도 자동 하향 제안 알림
- 본인 세션 중도 이탈률 >50% → "신규 줄이기" 제안 알림

### 측정 데이터 흐름
```
사용자 액션
  → review_log / session / events 기록 (로컬, 실시간)
  → daily_stats lazy rollup 트리거:
      a) 앱 시작 시 (마지막 집계 이후 차이만)
      b) 세션 종료 시 (오늘 행 갱신)
      c) 통계 화면 진입 시 (강제 재계산)
  → 통계 화면에서 사용자 본인이 확인
  → (V1.1+ opt-in) 익명화 후 PostHog 전송
```
**원칙**: 모바일은 백그라운드 cron 신뢰 X. lazy + idempotent rollup이 표준.

---

## 15. App Update & Backup Policy (NEW)

### 단어 DB 업데이트 (앱 버전업 시)
- `word.data_version` 컬럼으로 마이그레이션 추적
- 업데이트 규칙:
  1. **추가**: 새 단어 INSERT
  2. **수정**: 기존 `id` UPDATE (사용자 학습 상태 user_card 유지)
  3. **삭제**: 마킹만 (`deprecated=1`), user_card 보존
  4. **id 변경 금지**: 학습 상태 손실 위험
- 마이그레이션 스크립트: `src/db/migrations/v{N}.ts`

### 사용자 학습 상태 보존 (절대 원칙)
- 앱 업데이트로 **user_card 절대 손실 X**
- 앱 삭제 → 재설치 시 로컬 데이터 사라짐 = 운영체제 정책 (사용자 책임)
- 대응: **MVP에 내보내기 기본 탑재**

### 내보내기 (MVP, v0.7 당김)
- JSON export: `user_card` + `daily_stats` + `app_meta` + (V1.1 이후 노트)
- 파일명: `ashitakanji-backup-YYYYMMDD.json`
- 공유 시트(Share Sheet)로 클라우드(iCloud Drive/Google Drive) 저장 가능
- 정기 백업 알림은 V1.1 (MVP는 수동만)
- 위치: 설정 > 데이터 > "백업 파일 만들기"
- 구현 비용: 약 0.5일 (단순 SELECT + JSON.stringify + expo-sharing)

### 가져오기 (V1.2)
- 같은 schema JSON import
- 기존 데이터 덮어쓰기 vs 병합 선택
- 백업 데이터 schema_version 체크 → 마이그레이션

### 클라우드 동기화 (V1.2+)
- bkend.ai 또는 Firebase
- 다기기 사용자 대응
- E2E 암호화 검토 (노트 프라이버시)

---

## 16. Privacy & AI Policy (NEW)

### 데이터 수집 원칙
- **MVP는 외부 송신 0**: 모든 데이터 로컬 SQLite
- 분석/크래시 리포트: MVP X, V1.1에서 opt-in (Sentry 등)
- 광고 SDK: MVP X

### OpenAI / AI 질문 기능 (V1.2+)
- MVP에는 사용자향 AI 기능 없음
- **BYO API Key 정책 폐기**: 사용자가 OpenAI 키를 직접 입력하지 않음
- 비용 모델: 앱 내 **구독권**으로 처리
- 기술 전제: OpenAI API는 클라이언트에서 직접 호출하지 않고 **서버 프록시**를 통해 호출
- 필요 항목:
  - 구독 entitlement 확인 (App Store / Play Billing)
  - 사용자별 월 사용량 제한
  - 서버 측 OpenAI API key 보관
  - abuse/rate limit
  - AI 답변 disclaimer
- 명시 동의 UI:
  ```
  ⚠️ AI 질문 기능
  - 구독권이 필요한 기능입니다
  - 단어와 질문 내용이 AI 응답 생성을 위해 서버 및 OpenAI로 전송됩니다
  - AI 답변은 부정확할 수 있습니다
  - 중요한 학습 정보는 사전 등으로 교차 확인하세요
  ```
- 비활성화 옵션 항상 제공

### 사용자 메모/노트 (V1.1)
- 로컬 only
- 클라우드 동기화 시 E2E 암호화 옵션

### 외부 WebView (V1.2 네이버 사전)
- 진입 전 안내: "외부 사이트 (naver.com)로 이동합니다"
- 쿠키/추적 격리 (incognito 모드 WebView)
- 사용자가 X 버튼으로 즉시 닫기 가능

### AI 답변 오답 가능성 고지 (V1.2)
- 모든 AI 응답에 disclaimer 표시:
  ```
  ⚠️ AI 생성 답변
  내용이 부정확할 수 있습니다. 
  중요한 학습 정보는 사전 등으로 교차 확인하세요.
  ```
- 답변 옆 "사전에서 확인" 버튼 제공

### 사용자 권리
- **내보내기**: 모든 데이터 JSON 다운로드 (MVP, v0.7 당김)
- **삭제**: 설정 → "모든 학습 데이터 삭제" 버튼 (확인 2회)
- **단어 데이터 신고**: 오류 신고 (V1.1)

### 어린이 사용
- 페르소나는 성인이지만 만 13세 미만 사용 시 보호자 동의 안내 (앱스토어 메타데이터)
- 광고/IAP 도입 시 연령 정책 재검토

---

## 17. Release Readiness Checklist (NEW, 출시 게이트)

> 모든 체크 통과해야 스토어 제출 가능. 하나라도 미충족 = 출시 보류.

### A. 법적/저작권
- [ ] 데이터셋 선정 완료 + 라이선스 사본 (`LICENSE-data-*.txt`)
- [ ] 한국어 뜻 자체 작성 로그 보관
- [ ] 예문 출처 = Tatoeba sentence_id + author + license 컬럼 완성
- [ ] 단어 상세 화면에 예문 author 표기 (작은 텍스트)
- [ ] About > Example Sources 화면 + `assets/tatoeba-authors.txt` 번들
- [ ] 앱 내 "정보 > 라이선스" 화면에 모든 의존성 라이선스 표기
- [ ] OSS 라이선스 자동 생성 (npm `license-checker`)
- [x] 회사명/개발자명 결정 (개인 개발자 등록, 회사명 없음)
- [ ] 상표 충돌 확인: "JLPT" 사용 가능 여부 ("JLPT 준비"는 일반 표현 OK, "JLPT 공식"은 X)

### B. 스토어 자산
- [ ] 앱 아이콘 (1024×1024 PNG, 알파 X)
- [ ] iOS 스크린샷 (6.7"/6.5"/5.5" 각 3-5장)
- [ ] Android 스크린샷 (Phone, 7", 10" 각 2-8장)
- [ ] Feature Graphic (Android, 1024×500)
- [ ] 앱 설명 (한국어/일본어/영어 권장)
- [ ] 키워드 (App Store) / 짧은 설명 (Play)
- [ ] 프로모션 비디오 (선택)

### C. 정책/URL
> ✅ **확정값** (v0.7.2): GitHub repo = `taiyoungkim/AshitaKanji`, 이메일 = `datin0214@gmail.com`.
>
> **CI 회귀 게이트** (자기참조 해소: 스캔 대상을 deliverable 디렉터리로 한정):
> ```bash
> grep -rE 'PLACEHOLDER_TOKEN' \
>   site/ \
>   docs/release/PRIVACY_POLICY.md \
>   docs/release/SUPPORT.md \
>   app/ \
>   store-assets/ 2>/dev/null
> # where PLACEHOLDER_TOKEN = pattern below (split to avoid matching this doc itself)
> # pattern: open-angle + ('github-id' OR 'personal-support-email' OR '개인 이메일') + close-angle
> ```
> PLAN.md와 RELEASE_DECISIONS.md는 게이트 문서 자체이므로 스캔 대상에서 제외.

- [ ] **Privacy Policy URL** = https://taiyoungkim.github.io/AshitaKanji/privacy/ → `curl -I` HTTP 200 (현재 404, Pages 활성 필요)
- [ ] **Support URL** = https://taiyoungkim.github.io/AshitaKanji/support/ → `curl -I` HTTP 200 (현재 404, Pages 활성 필요)
- [ ] 이용약관 URL (선택, 무료 앱은 권장)
- [ ] 개발자 연락처 이메일 = `datin0214@gmail.com` → mailto 동작 확인
- [ ] 각 페이지에 앱 이름 "아시타칸지", 라이선스 정보, 데이터 수집 정책, 연락처 명시

### C-Deploy. GitHub Pages 배포 절차 (404 해결)
1. **로컬 배포 스크립트 실행**:
   ```bash
   ~/jlpt-app/deploy-pages.sh
   ```
   - `~/jlpt-app/site/` (index.html + privacy/ + support/ + .nojekyll) → `gh-pages` 브랜치 푸시
2. **GitHub Pages 활성화** (수동, 1회):
   - https://github.com/taiyoungkim/AshitaKanji/settings/pages
   - Source = "Deploy from a branch"
   - Branch = `gh-pages`, Folder = `/ (root)`
   - Save → 1-2분 대기
3. **검증**:
   ```bash
   curl -I https://taiyoungkim.github.io/AshitaKanji/
   curl -I https://taiyoungkim.github.io/AshitaKanji/privacy/
   curl -I https://taiyoungkim.github.io/AshitaKanji/support/
   # 전부 HTTP 200 기대
   ```
4. 사이트 콘텐츠 수정 시 = `site/` 편집 → `deploy-pages.sh` 재실행

### D. 권한 & 설정
- [ ] iOS Info.plist 권한 사용 사유 (한국어)
- [ ] Android `AndroidManifest.xml` 권한 최소화
- [ ] 사용 권한 목록 = **현재 0개** (MVP 권한 요구 X)

### E. 빌드 & 심사
- [ ] EAS Production build 성공 (iOS + Android)
- [ ] iOS App Store Connect 메타데이터 입력
- [ ] Play Console 메타데이터 입력
- [ ] App Privacy (App Store) / Data Safety (Play) 답변 완료
- [ ] 연령 등급 설문 완료 (IARC)
- [ ] **심사 메모** 작성 (테스트 계정 불필요 명시, 사용 흐름 3줄)
- [ ] TestFlight 내부 테스트 1회 이상 완료
- [ ] Play Internal Testing 1회 이상 완료

### F. 출시 직전 자체 점검
- [ ] Device QA Matrix 통과 (아래 섹션)
- [ ] Known Limitations 문서화 완료
- [ ] 크래시 0건 (3일 자체 사용)
- [ ] **사용자 학습 데이터** 외부 송신 0건 (Charles/mitmproxy로 확인)
- [ ] MVP는 OTA off → 시스템 통신 0건 (`expo.updates.enabled=false`)
- [ ] 앱 삭제→재설치 시 동작 확인

---

## 18. Store Metadata Policy (NEW)

### 명명 규칙 (전 채널 통일)
| 채널 | 표기 |
|---|---|
| 스토어 제목 | **"아시타칸지 (明日漢字)"** |
| 부제/짧은 설명 | "JLPT N5-N1 **핵심 선별 6,200 단어**, 매일 한 자 평생 함께" |
| 아이콘 텍스트 | 한자 "明" 또는 "明日" |
| 첫 스크린샷 카피 | "**JLPT N5-N1 핵심 선별 6,200 단어** — 편집자 큐레이션 + 사람 검수" |
| 영어 부제 (선택) | "Ashita Kanji — JLPT N5-N1 Curated 6,200 Vocabulary" |

### 카피 의무 (사용자 오해 방지)
"6,200개"만 쓰면 "JLPT 전체 어휘 = 6,200"으로 오해 가능 (실제 JLPT 어휘는 N1만 1만+). 따라서:
- **반드시 "핵심 선별 6,200", "편집자 큐레이션" 표현과 묶어 사용**
- 스토어 설명 첫 단락에 "JLPT 시험 전체 어휘가 아닙니다. 학습 효율을 위해 편집자가 큐레이션한 6,200개 핵심 단어입니다." 명시
- FAQ 1번 = "전체 어휘 아님" 확실히

### 브랜드 의미
- 明日 (あした, ashita) = 내일
- 漢字 (かんじ, kanji) = 한자
- 합쳐서: "내일을 위해 오늘 한 자" → 매일 학습 + 장기 누적 = 페르소나 핵심

### 금지 표현 (별점/심사 리스크)
- ❌ "JLPT 합격 보장"
- ❌ "공식 JLPT" (상표 분쟁)
- ❌ "JLPT 시험 문제 수록" (출제 기관 X)
- ❌ "Anki 대체"
- ❌ "100% 완벽" / "오류 없음"

### 권장 표현
- ✅ "JLPT N5-N1 **핵심 선별** 6,200 단어"
- ✅ "**편집자 큐레이션** + 사람 검수 한국어 뜻"
- ✅ "장기기억 학습 (FSRS)"
- ✅ "회독 + 빠른 훑기 + 약점 복습"
- ✅ "레벨업해도 같은 앱"

### 금지 추가 (오해 유발)
- ❌ "JLPT 전체 단어"
- ❌ "JLPT 시험 어휘 완비"
- ❌ "빈도 상위" (Kaggle 원본에 빈도 컬럼 없음, 근거 부족)

### 카테고리
- iOS: Education > Reference (또는 Language Learning)
- Android: Education (서브: Language Learning)

### 연령 등급
- IARC: 3+ (광고 X, 폭력 X, AI 채팅 X — MVP 기준)
- 만 13세 미만 보호자 동의 표시 안내

### 가격
- MVP: **무료** (광고/IAP 없음)
- V1.2: 광고 제거 1회 결제 검토

---

## 19. Privacy / Data Safety Declaration (NEW)

### App Store - App Privacy (Apple)
| 카테고리 | 수집 여부 | 사유 |
|---|---|---|
| Contact Info | **수집 X** | - |
| Health & Fitness | X | - |
| Financial Info | X | - |
| Location | X | - |
| Sensitive Info | X | - |
| Contacts | X | - |
| User Content | **X (로컬 only)** | 사용자 노트는 디바이스 저장만 |
| Browsing History | X | - |
| Search History | X | - |
| Identifiers | X | - |
| Purchases | X | - |
| Usage Data | X | - |
| Diagnostics | X (MVP) / V1.1 opt-in | - |
| Other | X | - |

→ **App Store 표시: "Data Not Collected"**

### Google Play - Data Safety
| 항목 | 답변 |
|---|---|
| Does your app collect or share user data? | **No (MVP)** |
| Is all data encrypted in transit? | N/A (수집 X) |
| Can users request data deletion? | Yes — 설정 > 모든 데이터 삭제 |

→ **Play Data Safety 표시: "No data shared with third parties / No data collected"**

### V1.1 (opt-in 분석 도입 시) 갱신 필요
- App Privacy / Data Safety 답변 수정
- Privacy Policy 갱신 (수집 항목 명시)

### 3rd-party SDK 데이터 수집
- MVP 사용 SDK: Expo (텔레메트리 OFF 가능), expo-sqlite, expo-speech, ts-fsrs
- **MVP OTA 정책**: `expo.updates.enabled=false` (MVP 출시 시 OTA off) → 외부 통신 0건 보장
- V1.1에서 OTA 활성화 검토 (핫픽스 필요성 vs 통신 표현 트레이드오프)
- OTA 활성화 시 Privacy Policy/Data Safety에 "Expo Updates check (version metadata only)" 명시
- V1.1: Sentry/PostHog 추가 시 본인이 정책 페이지 갱신

### Privacy Policy 템플릿 항목
1. 수집 데이터: 없음 (MVP)
2. 외부 송신: 없음 (MVP)
3. 로컬 저장: SQLite (학습 상태, 통계)
4. 데이터 삭제 방법: 설정 또는 앱 삭제
5. 어린이 사용: 만 13세 미만 보호자 동의 안내
6. 연락처: support email
7. V1.1 변경 시 사전 고지 약속

---

## 20. Device QA Matrix (NEW)

### 출시 전 필수 테스트 디바이스

| OS | 디바이스 | 화면 | 우선순위 | 비고 |
|---|---|---|---|---|
| iOS 17+ | iPhone 15 / 15 Pro | 6.1" | P0 | 최신 기준 |
| iOS 17+ | iPhone SE 3 | 4.7" | P0 | 소형 화면 검증 |
| iOS 16 | iPhone 13/12 | 6.1" | P1 | 한 단계 이전 OS |
| Android 14 | Pixel 7/8 | 6.3" | P0 | 표준 Android |
| Android 13 | Galaxy S22/S23 | 6.1" | P0 | 한국 점유율 1위 |
| Android 12 | 저가형 (RAM 3GB) | - | P1 | 저사양 검증 |

### 테스트 시나리오 (각 디바이스마다)
1. 첫 설치 → DB 복사 → Home 진입 (5초 이내)
2. 카드 reveal → 4단계 등급 → 다음 카드
3. 30개 신규 학습 → "Done!" 화면 도달
4. 빠른 훑기 50개 → 분류 → SRS 편입
5. 앱 강제 종료 → 재실행 → 학습 상태 유지 확인
6. 비행기 모드 → 모든 기능 동작 확인 (외부 네트워크 X)
7. TTS 발음 재생 (`ja-JP`)
8. 설정 > 모든 데이터 삭제 → 확인 → 초기 상태

### 알려진 미지원
- iOS 15 이하 (Expo SDK 53+ 미지원)
- Android 11 이하 (expo-sqlite 호환성)
- 태블릿: MVP 대응 X (V1.1 검토)
- Foldable: Galaxy Fold 펼침 모드 일부 깨질 수 있음 (V1.2 대응)

---

## 21. Known Limitations (NEW)

### 출시 시 명시할 한계

| # | 한계 | 사용자 영향 | 회피/대응 |
|---|---|---|---|
| 1 | 단어 풀 = JLPT 핵심 6,200 (편집자 큐레이션 세트) | JLPT 시험 전체 어휘는 더 많음 (N1 1만+) | 향후 데이터셋 확장 V1.2+ |
| 2 | 한국어 뜻 일부 오류 가능 | 미세한 뉘앙스 차이 | 카드에서 "오류 신고" V1.1 추가 |
| 3 | TTS 음질 디바이스별 차이 | 일부 단어 부자연스러움 | 속도 조절만 MVP |
| 4 | 클라우드 동기화 없음 | 다기기 사용 불가 | V1.2 예정. MVP에 JSON export 수동 백업 제공 |
| 5 | 알림 없음 | 본인 의지 필요 | V1.1 추가 예정 |
| 6 | 다크모드 자동 OS follow만 | 별도 토글 X | V1.2 검토 |
| 7 | 한자 분해 X | 어원 학습 불가 | V1.1 Kanjidic2 추가 |
| 8 | 단어 검색 X | 특정 단어 찾기 불편 | V1.1 단순 검색 추가 |
| 9 | **자동 동기화 X**, 수동 백업만 가능 (MVP JSON export) | 다기기 사용자는 수동 복원 V1.2 대기 | V1.2 import 추가 |
| 10 | 통계 그래프 단순 | 시각화 부족 | V1.1 잔디 그래프 |

→ 스토어 설명/Support FAQ에 이 표 요약 포함.

---

## 22. Support & Feedback (NEW)

### 채널
- **이메일**: datin0214@gmail.com
- **Support URL**: https://taiyoungkim.github.io/AshitaKanji/support/
- **Privacy Policy URL**: https://taiyoungkim.github.io/AshitaKanji/privacy/
- **GitHub repo**: https://github.com/taiyoungkim/AshitaKanji
- **양식**: Google Form 또는 Notion 페이지 (선택)
- **앱 내**: 설정 > 문의하기 → `mailto:datin0214@gmail.com` 링크

### 응답 SLA (개인 개발자 기준)
- 일반 문의: 영업일 5일 이내
- 크래시 신고: 영업일 3일 이내
- 데이터 삭제 요청: 7일 이내 안내 회신

### FAQ (출시 동시 공개)
1. N5~N1 전부 들어 있나요? → "각 레벨 핵심 선별 6,200개 (N5 300/N4 600/N3 1100/N2 1700/N1 2500) 사람 검수 완료. JLPT 전체 어휘가 아닌 편집자 큐레이션 세트입니다"
2. 데이터가 어디 저장되나요? → "당신의 기기에만. 외부 전송 안 함"
3. 다른 기기로 옮길 수 있나요? → "MVP는 자동 동기화 없음. 설정 > 데이터 > 백업 파일 만들기로 JSON 내보내고 다른 기기에서 V1.2 가져오기 예정"
4. 단어 뜻이 이상해요 → "v1.1에서 카드에서 직접 신고 가능. 현재는 이메일로 부탁"
5. 광고 있나요? → "MVP는 광고 없음. 향후 광고 제거 1회 결제 옵션 검토"
6. 환불 정책 → "MVP는 무료. IAP 도입 시 스토어 정책 따름"

### 사용자 피드백 수집
- MVP: 이메일만
- V1.1: 앱 내 "오류 신고" 버튼 + Google Form
- V1.2: opt-in 분석 (PostHog 등)

---

## 23. Post-launch Hotfix Plan (NEW)

> ⚠️ **MVP 정책**: OTA off (`expo.updates.enabled=false`). 모든 핫픽스 = **Store 빌드 재제출**.
> OTA 도입은 V1.1에서 재검토 (네트워크 표현 트레이드오프).

### 핫픽스 트리거 (즉시 대응)
| 심각도 | 사례 | 대응 시간 (MVP) |
|---|---|---|
| **P0 (블로커)** | 앱 실행 시 크래시 / 학습 데이터 손실 | **24시간 내 Store 빌드 제출** (심사 expedite 요청) |
| **P1 (중요)** | 특정 카드 진행 불가 / "Done!" 미도달 | 48-72시간 내 Store 빌드 제출 |
| **P2 (일반)** | 표시 오류 / 색상 깨짐 | 다음 마이너 릴리스 (1-2주) |
| **P3 (낮음)** | 단어 뜻 오류 1-2건 | 다음 데이터 업데이트 (월간 빌드) |

### 배포 채널 (MVP)
- **EAS Build → Store 제출**: 모든 변경 (JS/UI/네이티브/데이터 동일)
- 심사 expedite 요청: Apple Review Acceleration (P0만), Play 검토 정책 적용
- **데이터만 업데이트 (단어 뜻 수정 등)**: 같은 EAS Build에 새 `assets/jlpt.db` + `app_meta.data_version` 증가

### 배포 채널 (V1.1 OTA 도입 시 — 결정 보류)
- Expo Updates (OTA): JS/UI 핫픽스 즉시 적용 가능
- 도입 시 Privacy Policy/Data Safety에 "Expo Updates check (version metadata only)" 명시 필수
- OTA 활성화 = MVP "통신 0건" 가치 손상 트레이드오프

### 롤백 정책 (MVP)
- 빌드 롤백: 직전 빌드를 다시 Store에 제출 (iOS 7일 내 / Android 즉시 가능)
- 데이터 마이그레이션 실패 시: `app_meta.data_version` 안 올림 → 자동 미적용

### 모니터링 (MVP는 수동)
- 본인 디바이스 + 가족/지인 5명 베타 사용
- 매일 1회 본인 디바이스 사용 (실 사용자 체험 + 크래시 감지)
- V1.1 Sentry 도입 후 자동 알림

### 데이터 수정 핫픽스 (V1.1 자동, MVP는 수동)
- 단어 뜻 오류 신고 누적 5+ → 다음 빌드에 포함
- 데이터 업데이트는 `user_card` 절대 손상 X (섹션 15 정책)

---

## 24. 폴더 구조

```
jlpt-app/
├─ app/
│  ├─ (tabs)/home.tsx, study.tsx, stats.tsx, settings.tsx
│  └─ done.tsx
├─ src/
│  ├─ db/schema.ts, migrations/
│  ├─ srs/fsrs.ts, queue.ts
│  ├─ components/Card.tsx, RevealButton.tsx, GradeButtons.tsx, DoneScreen.tsx
│  ├─ hooks/useStudySession.ts, useTTS.ts
│  └─ utils/
├─ assets/jlpt.db
├─ scripts/
│  ├─ normalize.ts        # Kaggle → CSV 정규화 + 레벨 선별
│  ├─ gpt-draft.ts        # GPT-4o 한국어 뜻 초안 배치
│  ├─ qa-cli.ts           # 사람 검수 CLI
│  ├─ match-examples.ts   # Tatoeba 예문 매핑
│  └─ build-db.ts         # 최종 SQLite 번들
├─ data/
│  ├─ raw/kaggle.csv
│  ├─ csv/{n1,n2,n3,n4,n5}.csv         # 정규화 후
│  ├─ csv/{n1..n5}-verified.csv         # 검수 후
│  ├─ gpt_responses/       # GPT API 응답 로그
│  └─ qa_log.csv           # 검수 작업 로그
├─ docs/qa-guide.md        # 검수 가이드라인 (V1.1 외주 대비)
├─ docs/01-plan/PLAN.md
├─ app.json, package.json, tsconfig.json
```

---

## 25. MVP 마일스톤 (v0.6.2 — 데이터 9-11일 + 구현 6일 + 출시 준비 2일 = 약 14-18일 병행)

### Track A: 데이터 작업 (병목)
| Phase | 산출물 | 추정 |
|---|---|---|
| A1. Kaggle 다운로드 + 레벨 분포 확인 | data/raw/kaggle.csv, 레벨별 가용 단어 수 검증 | 0.5일 |
| A2. 자동 정규화 + 레벨별 선별 + 카드 타입 분류 | scripts/normalize.ts, n{1..5}.csv (6,200개) | 1일 |
| A3. GPT-4o 초안 생성 (배치) | scripts/gpt-draft.ts, 6,200개 한국어 뜻 초안 | 0.5일 (대기 시간 포함) |
| A4. **사람 검수 6,200개** | qa-cli.ts, 풀타임 800-1000개/일 | **6-8일** (병목) |
| A5. 예문 매핑 (Tatoeba) | scripts/match-examples.ts, 한국어 예문 가능한 단어 우선 | 1일 |
| A6. build-db.ts → assets/jlpt.db | 최종 SQLite 번들 | 0.5일 |

### Track B: 앱 구현
| Phase | 산출물 | 추정 |
|---|---|---|
| B1. Expo 골격 | expo-router, sqlite open, schema | 0.5일 |
| B2. 카드 타입 정책 구현 | A/B/C/D/E 분기, surface/reading 처리 | 0.5일 |
| B3. FSRS + 큐 + Again 정책 | ts-fsrs 통합, Main+미니 라운드, review_log | 1.5일 |
| B4. 고강도 학습 기본형 | 신규 50개 상한, 빠른 훑기 분류, scan_result | 1일 |
| B5. 카드 UX + Done 화면 | reveal, 4단계 등급, "오늘 끝!" | 1일 |
| B6. 통계 + TTS | 단순 진척률 (개인 지표), expo-speech | 0.5일 |
| B7. **JSON export (백업)** | 설정 > 데이터 > 백업 파일 만들기, expo-sharing | 0.5일 |
| B8. 디자인 패스 + EAS dev build | 실기기 빌드, 회독 1회 완주 검증 | 1일 |

### Track C: 출시 준비 (Track B 완료 시점부터 병행 가능)
| Phase | 산출물 | 추정 |
|---|---|---|
| C1. 스토어 자산 제작 | 아이콘, 스크린샷, Feature Graphic, 설명 카피 | 0.5일 |
| C2. Privacy Policy + Support URL | GitHub Pages 정적 페이지 | 0.5일 |
| C3. App Store/Play 메타데이터 입력 | 스토어 콘솔 등록, Data Safety/App Privacy | 0.5일 |
| C4. Device QA Matrix 통과 | iOS 2종 + Android 2종 실기기 + 테스트 시나리오 | 0.5일 |

### 합계 (병행 시)
- Track A: 9-11일 (데이터 검수가 병목, 풀타임 기준)
- Track B: 6.5일 (구현 + JSON export 0.5일 추가)
- Track C: 2일 (출시 준비, Track B 종료 후)
- **현실적 총 14-18일** (검수 풀타임 기준, 스토어 심사 기간 제외)

### 검수 페이스 옵션 (결정: 풀타임)
| 모드 | 페이스 | 데이터 일정 |
|---|---|---|
| 풀타임 | 800-1000/일 | 6-8일 |
| 집중 | 400-500/일 | 12-15일 |
| 분산 (실무 + 검수) | 200/일 | 30일+ |

### MVP Acceptance Criteria

**데이터:**
- [ ] Kaggle CC BY 4.0 attribution 4항목 LICENSE 파일 완성
- [ ] (N1 출처 별도일 경우) 추가 LICENSE 파일
- [ ] **6,200개 모두 `qa_status='verified'`**
- [ ] 레벨별 단어 수 = N5 300 / N4 600 / N3 1100 / N2 1700 / N1 2500
- [ ] GPT 응답 로그 보관 (`gpt_responses/`)
- [ ] 검수 로그 (`qa_log.csv`)
- [ ] 예문 출처 컬럼 채워짐 (Tatoeba 또는 self)

**기능 (구현):**
- [ ] 레벨 선택 화면 (N5~N1, 다중 선택 가능)
- [ ] 5종 카드 타입 모두 정상 동작 (A/B/C/D/E)
- [ ] 하루 신규 12개 기본 + 5-50 조절 가능
- [ ] 30개 이상 선택 시 고강도 경고 표시
- [ ] 50개 초과 신규 암기 불가, 빠른 훑기 모드로 안내
- [ ] 빠른 훑기 50/100/200/300개 분류 가능
- [ ] 빠른 훑기 결과가 `scan_result`에 기록됨
- [ ] 빠른 훑기 후 SRS 편입 기본 30개, 최대 50개로 제한
- [ ] 약점 복습 기본형: 최근 Again/헷갈림 카드 재노출 가능
- [ ] Main round + Again 미니 라운드 + 2회 실패 시 내일로 동작
- [ ] "Done!" 화면 도달 가능 (정의 = 미니 라운드까지 큐 비움)
- [ ] 앱 재시작 후 user_card 영속화 확인
- [ ] review_log에 모든 등급 기록됨 (디버깅/undo 기반)
- [ ] daily_stats lazy rollup 동작
- [ ] **레벨별 진척률 5개 + 전체 진척률 1개 표시**
- [ ] **JSON export 동작** (설정 > 데이터 > 백업 파일 만들기 → 공유 시트)
- [ ] export 파일 내용에 user_card + daily_stats + app_meta 포함 검증
- [ ] 예문 노출 시 Tatoeba author 표기 (또는 self) 보임 검증

**품질:**
- [ ] iOS/Android EAS Production build 성공
- [ ] Device QA Matrix P0 4종 통과
- [ ] **사용자 학습 데이터** 외부 송신 0건 (mitmproxy 확인)
- [ ] MVP OTA off (`expo.updates.enabled=false`) → 전체 통신 0건 보장
- [ ] 크래시 0건 (3일 자체 사용)
- [ ] DB 크기 < 20MB (6,200 단어 + 메타 + 인덱스)

**출시:**
- [ ] Release Readiness Checklist (섹션 17) 전 항목 통과
- [ ] **Placeholder 회귀 게이트**: 스캔 대상 = `site/ docs/release/PRIVACY_POLICY.md docs/release/SUPPORT.md app/ store-assets/` (PLAN/RELEASE_DECISIONS 제외 — 자기참조). 0건 통과 시 빌드 허용
- [ ] Privacy Policy + Support URL 실제 라이브 (`curl -I` HTTP 200)
- [ ] App Privacy / Data Safety 답변 = "데이터 수집 X"
- [ ] 스토어 명명 = **"아시타칸지 (明日漢字)"** (전 채널 통일)
- [ ] 스토어 카피에 "**핵심 선별 6,200개**", "**편집자 큐레이션**" 반복 (전체 어휘 오해 방지)
- [ ] Known Limitations 10개 항목 = 스토어 설명/FAQ에 포함
- [ ] TestFlight / Play Internal 내부 테스트 1회 이상 완료

---

## 26. 리스크 & 결정

| 리스크 | 대응 |
|---|---|
| 데이터셋 한국어 뜻 부정확 | GPT 초안 + 100% 사람 검수 + 사용자 신고 (V1.1) |
| 6,200개 검수 부담으로 출시 지연 | 풀타임 모드 6-8일 / 분산 모드 30일+ 선택. 페이스 미준수 시 레벨 우선순위 (N5 우선 출시 옵션) |
| ~~Kaggle N1 미포함~~ | ✅ 해소 (v0.6.1, N1 포함 확인) |
| 검수자 1명 의존 = bus factor 1 | 검수 가이드라인 문서화 (`docs/qa-guide.md`) + 외주 가능성 V1.1 |
| FSRS 초기 파라미터 | 기본값 사용, 1000+ 리뷰 후 자동 최적화 검토 |
| 고강도 신규 학습으로 복습 부채 폭증 | SRS 신규 50개 상한 + 경고 + 50개 초과는 빠른 훑기 분리 |
| 300개 학습 요구로 세션 피로 증가 | 25개 단위 세트 + 중간 결과 + SRS 후보만 편입 |
| TTS 음질 차이 (디바이스별) | 속도 조절만 MVP, 외부 TTS V1.2+ |
| 카드 타입 분류 오류 | 자동 분류 + QA 단계에서 검증 |
| 사용자 데이터 손실 | **MVP에 JSON export 탑재** (v0.7 당김). V1.1 정기 알림 추가 |

### 결정 완료 (v0.7)
- ✅ MVP scope = **JLPT N5-N1 전 레벨 6,200개 verified** (N5 300/N4 600/N3 1100/N2 1700/N1 2500) — **편집자 큐레이션** (빈도 컬럼 없음)
- ✅ 스토어 명 = **"아시타칸지 (明日漢字)"**, 부제 = "JLPT N5-N1 **핵심 선별 6,200 단어**, 매일 한 자 평생 함께"
- ✅ JSON export = **MVP** (v0.7 당김, 장기 학습 데이터 안전망)
- ✅ MVP OTA = **off** (`expo.updates.enabled=false`) → 전체 통신 0건
- ✅ Tatoeba attribution = sentence_id + author + license 컬럼 5개. 단어 상세에는 해당 author만 작게, About > Example Sources에 총괄 + 전체 목록
- ✅ 검수 Go/No-Go 게이트 = 레벨별 5% 샘플 오답률 ≤1% (N1/N2는 ≤2%)
- ✅ 카피 의무 = "핵심 선별", "편집자 큐레이션" 반복 (전체 어휘 오해 방지)
- ✅ GitHub repo = **taiyoungkim/AshitaKanji**, 이메일 = **datin0214@gmail.com**, OpenAI 한도 = **$50** (placeholder 모두 치환 완료)
- ✅ 페르소나 = **장기 학습자** (수년에 걸쳐 N5→N1) + 시험 임박 헤비유저 (서브)
- ✅ 진척률 표시 = **레벨별 5개 + 전체 1개** (Core 200 폐기)
- ✅ GPT/네이버 = V1.2+, 알림 = V1.1
- ✅ 분석 = V1.1 opt-in (PostHog/Sentry)
- ✅ 카드 타입 정책 = 5종 (A-E)
- ✅ Homograph vs Homophone 분리
- ✅ 컬럼명: surface, reading_kana
- ✅ review_log + session + events + scan_result 테이블
- ✅ daily_stats = lazy rollup (자정 cron 없음)
- ✅ Again 정책 = 세션 끝 미니 라운드 + 2회 실패 시 내일
- ✅ 일일 신규 기본 12개, SRS 신규 최대 50개
- ✅ 300개/day는 SRS 신규가 아니라 빠른 훑기/분류
- ✅ 전체 학습 완주 추정 = 약 1.5년 (12개/일 신규 기준)
- ✅ MVP 광고/IAP/분석 SDK X, App Privacy/Data Safety = "데이터 수집 X"
- ✅ MVP 페르소나 = 단일 기기 사용자 (다기기 V1.2+)
- ✅ 단어 마스터 = **Kaggle Robin Pourtaud (CC BY 4.0)** 확정
- ✅ 라이선스 미명시 데이터셋 사용 금지, GPL/AGPL 데이터 사용 금지
- ✅ 한국어 뜻 = **GPT-4o 초안 + 100% 사람 검수** (v0.6 정책 변경)
- ✅ 예문 = Tatoeba CC-BY (+ 부족 시 자체 작성)
- ✅ irukai 블로그 GPT 워크플로 일부 채택 (초안 자동화), 출시 정책은 강화 (100% 사람 검수)
- ✅ 베타/미리보기 개념 = **폐기** (모든 단어 verified만 출시)

### 출시 전 결정 마감 필수
- [x] ~~데이터셋 최종 확정~~ ✅ Kaggle CC BY 4.0
- [x] ~~앱 이름 최종~~ ✅ 아시타칸지 (明日漢字)
- [x] ~~`LICENSE-data-kaggle-jlpt.txt`~~ ✅ 작성 완료 (v0.5.2)
- [x] ~~Kaggle 원본 N1 포함 여부 확인~~ ✅ 포함 확인 (v0.6.1)
- [x] **support 이메일 주소**: ✅ **datin0214@gmail.com**
- [x] **GitHub account / repo**: ✅ **taiyoungkim / AshitaKanji**
- [x] **Privacy Policy URL**: ✅ https://taiyoungkim.github.io/AshitaKanji/privacy/
- [x] **Support URL**: ✅ https://taiyoungkim.github.io/AshitaKanji/support/
- [x] **개발자 등록 명의**: ✅ 개인
- [x] **회사명/도메인**: ✅ 없음
- [x] **OpenAI 데이터 초안 비용 한도**: ✅ **$50 hard cap**
- [x] OpenAI 비용 정책: 데이터 초안 생성은 개발자 내부 비용, 사용자향 AI는 V1.2+ 구독권 처리
- [x] **검수 페이스**: ✅ 풀타임

### 출시 후 결정 (V1.1-V1.2)
- [ ] 광고 제거 IAP 가격 (V1.2)
- [ ] 클라우드 동기화 = bkend.ai vs Firebase (V1.2+)
- [ ] 다크모드 = 시스템 follow만 vs 별도 토글 (V1.2)
- [ ] 분석 도구 = PostHog vs Mixpanel vs Sentry (V1.1)

---

## 27. 사용자 추가 검토 칸

> 추가 기획 자유롭게 적어주세요.

- [ ] 
- [ ] 
- [ ] 

---

## 28. 다음 액션

1. 본 문서 검토 + 섹션 27 채우기
2. **Kaggle 데이터 정규화 시작** (scripts/normalize.ts 작성)
3. **Release Readiness Checklist (섹션 17) 항목별 담당 + 마감 잡기**
4. **GitHub Pages 활성화** (`taiyoungkim/AshitaKanji` repo Settings > Pages)
5. `docs/release/PRIVACY_POLICY.md` + `SUPPORT.md` → GH Pages 라이브 (`curl -I` HTTP 200)
6. `/pdca plan jlpt-vocab-app` → bkit 정식 Plan 등록
7. `/pdca design jlpt-vocab-app` → DB/FSRS/카드 타입 상세 설계
8. Expo 프로젝트 init + 데이터 QA 작업 병행 시작
9. `docs/qa-guide.md` 작성 (검수 가이드라인, V1.1 외주 대비)
10. OpenAI API 키 발급 + 사용 한도 $50 설정 (Usage limits 페이지)
