# 오니칸 (오니기리 칸지)

JLPT N5–N1 한자 단어 암기 앱. 한자만 먼저 보여주고, 히라가나 읽기와 한국어 뜻은 버튼을 눌러야 공개 → 능동 회상(active recall) 유도. FSRS 간격 반복 + 회독 진행도 + 빠른 스캔 + 약점 복습 + TTS.

## 기술 스택

- **React Native + Expo** (managed workflow) + TypeScript
- **expo-router** (file-based, typed routes)
- **expo-sqlite** (로컬 DB) + **ts-fsrs** (간격 반복)
- **Zustand** (UI/설정 상태) + **TanStack Query** (캐시/무효화)
- **expo-speech** (TTS ja-JP), **expo-sharing** (JSON 내보내기)

## 데이터 정책

- 학습 기록은 기기에만 저장. 정규 학습·약점 복습·회독 완료 후 **Google AdMob 전면광고**가 나올 수 있음
- Expo Updates는 켜져 있음 (버전 메타데이터 확인). 학습 데이터는 올리지 않음
- 어휘 7,027개는 **편집자 큐레이션**이며, 범위를 확정한 PDF 핵심어 2,360개를 모두 포함
- 한자 읽기·부수·획수는 EDRDG KANJIDIC2 (CC BY-SA 4.0) 기반이며, 한국어 뜻은 `kanji_qa_work.csv`에서 검수 상태를 추적
- 예문은 권리 확인된 NAVER 일본어사전 6,856개와 외부 사전·공개 코퍼스를 참고해 직접 작성·번역한 171개로 구성
- 네이버 일본어 사전 실시간 검색은 사용자가 버튼을 누를 때만 외부 브라우저로 열림

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
