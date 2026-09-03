# JLPT 어휘 6,638개 전수 감사 (2026-08-18)

결론: **통과**.

## 핵심 집계

- 구조: 6638개, 고유 ID 6638개, 고유 표제어/읽기 6638개
- JMdict 표면형·읽기 충돌: 0건
- 치명 판정 고유 단어: 0개 (교차 검사 중복 집계 제외)
- 과거 표제어 교정 회귀: 0건
- 구절 정규화/제거 회귀: 0건
- 동일 읽기·동일 뜻 중복 후보: 0그룹
- 그중 N5가 포함된 중복 후보: 0그룹
- 확정 뜻 오류: 0건
- 확정 품사 오류: 0건
- 더 쉬운 PDF 급수와 충돌: 0건
- pass PDF 유의어·용법 제외 섹션 단독 유입: 0건
- 예문 누락/미연결/빈칸: 0건

## 판정

- `critical`: 표제어와 읽기가 사전에 직접 충돌하거나 과거 읽기 교정이 되돌아온 항목
- `major`: 구절 카드 재유입, 동일 읽기·동일 뜻 중복, 확정 뜻/품사 오류
- `review`: 표준 표기 선택 등 과거 수동 교정이 되돌아온 항목

상세 항목은 동명 JSON과 `_issues.csv`에 모두 기록했다.

## 원인 판단

pass PDF의 유의어·용법 섹션을 전 레벨에서 제외하고, 기존 표제어·구절 교정과 중복 제거 결정을 재적용했다.

## 한계

- JLPT does not publish an official post-2010 vocabulary list; Kaggle-only level labels cannot be independently certified here.
- Korean meanings were format-checked across all rows and compared with prior adjudication; only deterministic or manually confirmed semantic errors are failed.
- JMdict non-exact rows include valid productive/inflected PDF forms and require policy review rather than automatic deletion.
