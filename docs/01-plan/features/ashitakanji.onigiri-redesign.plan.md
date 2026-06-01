# 아시타칸지 - Onigiri Shop Redesign Plan

> 작성일: 2026-06-01
> 상태: Draft
> 범위: 신규 디자인 목업 적용 계획
> 기준 파일: `/Users/tyoung/Downloads/index.html`, `/Users/tyoung/Downloads/assets`

---

## 1. 목적

새 디자인은 기존 "한자 복습 앱" 표면을 `ONIGIRI SHOP` 콘셉트로 재구성한다. 핵심 변경은 단순 색상 교체가 아니라, 학습 완료를 "재료 획득"과 "오니기리 완성"으로 보여주는 진행 레이어를 추가하는 것이다.

정식 24개 오니기리 이름, 재료, 이미지는 아직 제작 중이므로 첫 구현은 임시 카탈로그로 진행한다. 화면과 데이터 흐름은 나중에 카탈로그와 이미지 에셋만 교체해도 유지되도록 분리한다.

## 2. 원칙

- DB 마이그레이션 없이 시작한다.
- 완료 세션 기록에서 오니기리 진행도를 파생 계산한다.
- 24개 임시 카탈로그는 화면 코드와 분리한다.
- 오니기리 이미지는 컴포넌트와 카탈로그 경유로 참조한다.
- 기존 학습 로직, FSRS, 세션 기록은 유지한다.
- 새 디자인 토큰을 먼저 도입한 뒤 화면을 단계적으로 교체한다.

## 3. 단계별 작업

### 1단계. 디자인 기반 만들기

- `src/design/tokens.ts` 추가
- 목업의 색상, 타입, spacing, radius를 React Native 상수로 이전
- 공통 버튼, divider, label/value row, ingredient segment에 쓸 기준값 정리
- 화면 교체 전에는 기존 UI에 강제 적용하지 않는다.

### 2단계. 에셋/카탈로그 분리

- `/Users/tyoung/Downloads/assets/*.png`를 앱 assets 영역으로 복사
- `src/features/onigiri/catalog.ts` 추가
- 24개 임시 오니기리 카탈로그 작성
- 각 항목은 `id`, `name`, `ingredients`, `description`, `imageKey`를 가진다.
- 나중에 정식 제작물이 오면 카탈로그와 이미지 파일만 교체한다.

### 3단계. 진행도 계산 레이어 추가

- `src/features/onigiri/progress.ts` 또는 `OnigiriProgressService.ts` 추가
- 완료 세션 1회 = 재료 1개
- 재료 4개 = 오니기리 1개 완성
- 24개 카탈로그 순서대로 `locked`, `inProgress`, `completed` 상태 산정
- 기존 `session`/`daily_stats`만 읽고 새 테이블은 만들지 않는다.

### 4단계. 공통 Onigiri UI 컴포넌트 추가

- `IngredientSegments`
- `OnigiriSketch`
- `CatDialogue`
- `Receipt`
- `LabelValueRow`
- `OnigiriIndexItem`

반복 UI와 목업 SVG/이미지 참조를 화면 코드에서 분리한다.

### 5단계. Shop Home 적용

- `HomeScreen`을 목업의 `Shop Home` 구조로 재구성
- 기존 due/new 계산 로직은 유지
- 표시 항목: `TODAY`, 선택 JLPT 레벨, `New words`, `Reviews`, 현재 오니기리, 재료 진행도, 고양이 대사
- 기존 "더 공부하기" 진입은 후속 단계에서 배치 재검토

### 6단계. Done / Receipt 적용

- `DoneScreen`을 `Study Complete` 흐름으로 변경
- 세션 요약, 획득 재료, 현재 오니기리 진행도 표시
- `View Receipt` 상태 추가
- 완성 시 `Crafted` 상태 표시

### 7단계. Index / Detail 화면 추가

- `Onigiri Index` 탭 추가
- `Onigiri Detail` 라우트 추가
- 완료/진행/잠김 상태 표시
- 빈 컬렉션, 전체 수집, locked, in-progress 상태 지원

### 8단계. 탭 구조 정리

- 사용자 표시 탭을 `Shop / Study / Index / Settings`로 정리
- 기존 `Stats`는 제거하지 않고 Settings 내부 링크 또는 별도 라우트로 유지한다.

### 9단계. 기존 화면 톤 맞추기

- `Settings`, `Stats`, `WordDetail`, `Study`는 기능 안정성을 우선한다.
- 1차에서는 무채색 토큰 반영과 과한 파란색 의존 제거에 집중한다.
- 빠른 훑기와 약점 복습 기능은 유지한다.

### 10단계. 검증

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- 주요 화면 수동 확인: Shop Home, Done, Receipt, Index, Detail

## 4. 보류/결정 필요

- 정식 24개 오니기리 이름
- 각 오니기리의 4개 재료
- 정식 오니기리 이미지 또는 스케치 에셋
- `Study` 탭을 실제 학습 시작 버튼으로 둘지, 별도 화면으로 둘지
- 기존 `Stats` 화면의 최종 위치
