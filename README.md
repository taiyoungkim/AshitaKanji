# 아시타칸지 (明日漢字 / AshitaKanji)

JLPT N5–N1 한자 단어 암기 앱. 한자만 먼저 보여주고, 히라가나 읽기와 한국어 뜻은 버튼을 눌러야 공개 → 능동 회상(active recall) 유도. FSRS 간격 반복 + 회독 진행도 + 빠른 스캔 + 약점 복습 + TTS.

## 기술 스택

- **React Native + Expo** (managed workflow) + TypeScript
- **expo-router** (file-based, typed routes)
- **expo-sqlite** (로컬 DB) + **ts-fsrs** (간격 반복)
- **Zustand** (UI/설정 상태) + **TanStack Query** (캐시/무효화)
- **expo-speech** (TTS ja-JP), **expo-sharing** (JSON 내보내기)

## 데이터 정책

- MVP는 학습 데이터를 **외부로 전송하지 않음** (zero outbound traffic)
- OTA 업데이트 **비활성** — 핫픽스는 스토어 재배포
- 어휘 6,200개는 **편집자 큐레이션**이며, `～/〜` 문법·접사 패턴은 제외 후 원본 CSV의 중복 없는 단어형 후보로 보강 (Kaggle CC BY 4.0 기반, 한국어 뜻은 GPT 초안 + 사람 검수)
- 예문은 Tatoeba (CC BY 2.0 FR), 문장별 출처 표기

## 개발 시작

```bash
pnpm install
pnpm start        # expo start --dev-client
pnpm test         # vitest run
```

## 구조

```
app/                  expo-router 화면 (file-based)
  _layout.tsx         루트: QueryClient + DB init + ErrorBoundary
  (tabs)/             하단 탭: home / study / stats / settings
src/
  types/              도메인 타입 (Card, Grade, ReviewLog, Session)
  db/                 SQLite 스키마 / 마이그레이션 / open
  lib/                queryClient, errorBoundary
assets/jlpt.db        번들 어휘 DB (Track A 산출물)
docs/                 PDCA 문서 (plan / design / analysis / report)
```

## PDCA

bkit PDCA 워크플로 기반. 현재 단계: **Do — module-1-skeleton 완료**.
다음: `module-2-card-types`.
