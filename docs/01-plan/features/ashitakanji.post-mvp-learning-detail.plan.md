# 아시타칸지 - Post-MVP 상세 학습 강화 Plan

> 작성일: 2026-05-30
> 상태: Draft
> 범위: MVP 이후 추가 기능 기획
> 기반 문서: `docs/01-plan/features/ashitakanji.plan.md` v0.7.4
> 관련 화면: `WordDetailScreen`, 향후 `KanjiDetailScreen`

---

## 1. Executive Summary

MVP가 "한자 표기 → 읽기/뜻 reveal → FSRS 복습"에 집중했다면, 이 후속 기능은 사용자가 단어를 맞힌 뒤 바로 깊게 확인할 수 있는 학습 보조층을 추가한다.

핵심은 세 가지다.

| ID | 기능 | 핵심 가치 | 우선순위 | 권장 릴리스 |
|---|---|---|---|---|
| F1 | 한자 설명 화면 | 단어 속 한자의 뜻/음독/훈독/부수를 확인 | P0 | V1.1 |
| F2 | 네이버 사전 연결 | 앱 데이터가 부족할 때 공신력 있는 외부 사전으로 검증 | P0 | V1.1 |
| F3 | 예문 고도화 + TTS | 실제 사전 예문을 듣고 문맥으로 기억 | P1 | V1.1-V1.2 |

단, "네이버 예문을 그대로 앱 DB에 저장/배포"하는 것은 권리/약관 확인 전에는 출시 금지 항목으로 둔다. 우선은 네이버 사전으로 연결하고, 예문 원문 저장은 허락·계약·라이선스 근거가 확보된 뒤 진행한다.

---

## 2. 목표와 비목표

### 목표

- 단어 상세에서 한자가 포함된 단어는 각 한자의 설명을 보여준다.
- 한자 설명에는 최소 `뜻`, `음독`, `훈독`, `부수`를 포함한다.
- 단어 상세에서 네이버 일본어 사전 검색 링크를 제공한다.
- 예문은 AI가 즉석 생성하지 않고, 출처가 있는 문장을 사용한다.
- 예문 일본어 문장은 TTS로 들을 수 있다.
- 외부 출처 데이터는 `source`, `source_url`, `license/permission`, `captured_at`을 추적한다.

### 비목표

- 네이버 사전 페이지를 자동 스크래핑하지 않는다.
- 네이버 사전의 음성 파일을 추출하거나 재배포하지 않는다.
- 권리 확인 전에는 네이버 예문 원문을 앱 번들 DB에 넣지 않는다.
- AI 질문/해설 기능은 이 문서 범위가 아니다.

---

## 3. 사용자 시나리오

### S1. 한자가 있는 단어를 더 이해하고 싶다

사용자가 `勉強` 단어 상세에 들어간다. 화면에는 기존 표기/읽기/뜻 아래에 `한자` 섹션이 보인다.

- `勉`: 뜻, 음독, 훈독, 부수
- `強`: 뜻, 음독, 훈독, 부수

각 한자 카드를 누르면 한자 상세 화면 또는 바텀시트가 열리고, 더 큰 글자와 상세 데이터를 볼 수 있다.

### S2. 앱 설명만으로 부족해 사전을 확인하고 싶다

사용자가 단어 상세에서 `네이버 사전` 버튼을 누른다. 앱은 외부 브라우저 또는 인앱 브라우저로 아래 URL을 연다.

```text
https://ja.dict.naver.com/#/search?query={encodeURIComponent(query)}
```

기본 `query`는 단어의 `surface`를 사용한다. 한자 상세에서는 해당 한자 1글자를 query로 사용한다.

### S3. 예문을 문맥으로 듣고 싶다

사용자가 단어 상세의 예문 섹션에서 일본어 예문을 확인하고 TTS 버튼을 누른다. 앱은 `expo-speech`의 `ja-JP` 음성으로 예문을 읽는다.

예문은 생성문이 아니라 출처가 있는 예문이어야 한다. 네이버 예문을 그대로 쓰는 정책은 권리 확인 후에만 활성화한다.

---

## 4. 기능 요구사항

### F1. 한자 설명 화면

#### 노출 조건

- `surface` 또는 `furigana` 기준으로 CJK 한자 문자가 1개 이상 있으면 `한자` 섹션을 노출한다.
- 같은 한자가 중복 등장하면 한 번만 보여주되, 단어 내 순서는 유지한다.
- 순수 히라가나/가타카나 단어는 섹션을 숨긴다.

#### 필수 필드

| 필드 | 설명 | 예시 |
|---|---|---|
| `literal` | 한자 1글자 | `強` |
| `meanings_ko` | 한국어 뜻 배열 | `강하다`, `억세다` |
| `onyomi` | 음독 배열, 가타카나 표기 우선 | `キョウ`, `ゴウ` |
| `kunyomi` | 훈독 배열, 히라가나 표기 우선 | `つよい`, `しいる` |
| `radical` | 부수 표기 | `弓` |
| `radical_name_ko` | 부수 한국어명, 가능하면 제공 | `활 궁` |
| `stroke_count` | 총획수, 있으면 제공 | `11` |
| `source` | 데이터 출처 | `kanjidic2` |

#### UX

- 단어 상세의 `뜻` 아래, `예문` 위에 `한자` 섹션을 둔다.
- 한자 카드는 한 글자를 크게 보여주고 핵심 정보는 2-3줄로 압축한다.
- 탭하면 상세 화면/바텀시트에서 음독·훈독 전체 목록과 부수 정보를 보여준다.
- 데이터가 일부 비어 있으면 해당 줄만 숨기고, 한자 카드 자체는 유지한다.

#### 데이터 후보

- 1순위: KANJIDIC2
- KANJIDIC2는 EDRDG가 제공하며 CC BY-SA 4.0 조건, 앱 내 출처/라이선스 표기가 필요하다.
- 한국어 한자 뜻은 KANJIDIC2의 영문 meaning을 초안으로 삼되, 한국어 번역은 사람 검수 후 `verified`만 출시한다.

### F2. 네이버 사전 연결

#### URL 규칙

```typescript
const url = `https://ja.dict.naver.com/#/search?query=${encodeURIComponent(query)}`;
```

#### 진입점

- 단어 상세 헤더: `네이버 사전` 버튼, query = `word.surface`
- 한자 상세: `네이버에서 보기` 버튼, query = `kanji.literal`
- 예문 섹션에는 자동 연결을 넣지 않는다. 사용자가 사전 확인 의도가 있을 때만 이동한다.

#### 동작 정책

- 기본은 `Linking.openURL`로 외부 브라우저를 연다.
- WebView는 V1.2에서 재검토한다. WebView로 네이버 페이지를 앱 안에 감싸면 정책/표시/개인정보 문구가 더 복잡해질 수 있다.
- 사용자가 버튼을 누른 경우에만 외부 요청이 발생한다.
- Privacy Policy에는 "외부 사전 링크를 열면 해당 서비스가 검색어와 접속 정보를 처리할 수 있음"을 추가한다.

### F3. 예문 고도화 + TTS

#### 예문 소스 원칙

- AI가 즉석 생성한 예문은 사용하지 않는다.
- 예문은 원문, 번역, 출처, 권리 상태를 함께 저장한다.
- 네이버 예문 원문 저장은 "권리 확인 완료" 상태일 때만 허용한다.
- 권리 확인 전 기본값은 기존 Tatoeba 예문 또는 사용자가 직접 작성/검수한 자체 예문이다.

#### 네이버 예문 사용 게이트

네이버 예문을 그대로 앱에 넣으려면 아래 중 하나가 필요하다.

- 네이버 또는 권리자로부터 앱 내 저장/배포 허락을 받았다.
- 명시적인 라이선스가 앱 내 재배포를 허용한다.
- 법무 검토에서 앱 내 저장/배포 가능 판단을 문서화했다.

권리 근거가 없으면 앱은 네이버 예문을 복사 저장하지 않고, 네이버 사전 링크만 제공한다.

#### TTS

- 예문 일본어 문장은 기존 `useTTS`/`expo-speech` 경로를 사용한다.
- TTS 대상은 앱에 저장된 일본어 텍스트만 사용한다.
- 네이버 음성 리소스는 가져오거나 캐시하지 않는다.
- TTS 미지원 기기에서는 기존처럼 비활성 상태와 안내 문구를 보여준다.

---

## 5. 데이터 모델 초안

### 5.1 `kanji` table

```sql
CREATE TABLE kanji (
  literal            TEXT PRIMARY KEY,
  meanings_ko        TEXT NOT NULL,
  onyomi             TEXT,
  kunyomi            TEXT,
  radical            TEXT,
  radical_name_ko    TEXT,
  radical_number     INTEGER,
  stroke_count       INTEGER,
  source             TEXT NOT NULL,
  source_url         TEXT,
  license            TEXT,
  qa_status          TEXT NOT NULL CHECK (qa_status IN ('verified','auto','needs_review','rejected')),
  data_version       INTEGER NOT NULL
);
```

배열 필드는 현재 앱 패턴에 맞춰 JSON 문자열로 저장한다.

### 5.2 `word_kanji` table

```sql
CREATE TABLE word_kanji (
  word_id   TEXT NOT NULL,
  literal   TEXT NOT NULL,
  position  INTEGER NOT NULL,
  PRIMARY KEY (word_id, literal, position),
  FOREIGN KEY (word_id) REFERENCES word(id),
  FOREIGN KEY (literal) REFERENCES kanji(literal)
);
```

단어에 포함된 한자 순서를 빠르게 렌더링하기 위한 조인 테이블이다. 빌드 스크립트에서 자동 생성한다.

### 5.3 `word_example` table

```sql
CREATE TABLE word_example (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id            TEXT NOT NULL,
  jp                 TEXT NOT NULL,
  ko                 TEXT,
  source             TEXT NOT NULL,
  source_url         TEXT,
  license            TEXT,
  permission_status  TEXT NOT NULL CHECK (permission_status IN ('cleared','pending','blocked','self')),
  attribution        TEXT,
  captured_at        INTEGER,
  qa_status          TEXT NOT NULL CHECK (qa_status IN ('verified','auto','needs_review','rejected')),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (word_id) REFERENCES word(id)
);
```

MVP의 `word.example_jp/example_ko` 컬럼은 유지하되, 다중 예문이 필요해지는 시점에 `word_example`로 이관한다.

---

## 6. 구현 슬라이스

### Slice A: 한자 데이터 파이프라인

- `scripts/build-jlpt-db.mjs`에 한자 추출 단계 추가
- KANJIDIC2 import 스크립트 추가
- `kanji`, `word_kanji` 테이블 생성
- 한국어 뜻 QA CSV 생성
- About/Sources에 EDRDG/KANJIDIC2 출처 추가

### Slice B: 단어 상세 UX

- `WordDetailScreen`에 `한자` 섹션 추가
- `KanjiDetailScreen` 또는 바텀시트 추가
- 한자 없는 단어에서 섹션 숨김
- 한자 카드 로딩 실패 시 단어 상세는 계속 렌더링

### Slice C: 네이버 사전 링크

- URL builder 유틸 추가
- `Linking.openURL` 연결
- iOS/Android 동작 확인
- Privacy Policy 문구 업데이트
- 네트워크 정책 문서에서 "사용자 명시 액션에 의한 외부 링크"로 분리

### Slice D: 예문 모델 고도화

- `word_example` 테이블 추가 여부 결정
- 기존 Tatoeba 예문 이관 또는 호환 레이어 추가
- 예문 TTS를 다중 예문 구조로 확장
- 네이버 예문은 `permission_status='cleared'`일 때만 빌드에 포함

---

## 7. 수용 기준

- 한자 포함 단어 상세에서 한자 섹션이 보인다.
- 한자 없는 단어 상세에서는 한자 섹션이 보이지 않는다.
- 각 한자에 뜻/음독/훈독/부수가 표시된다. 값이 없으면 빈 라벨을 보여주지 않는다.
- 네이버 사전 버튼은 URL 인코딩된 query로 열린다.
- 외부 네이버 요청은 사용자가 버튼을 누를 때만 발생한다.
- 예문 TTS는 저장된 일본어 예문 텍스트를 읽는다.
- `permission_status != 'cleared'`인 네이버 예문은 릴리스 빌드 DB에 포함되지 않는다.
- About/Sources에 KANJIDIC2와 예문 출처가 표시된다.
- Privacy Policy가 외부 사전 링크 동작을 설명한다.

---

## 8. 테스트 계획

| 영역 | 테스트 |
|---|---|
| 한자 추출 | `勉強` → `勉`, `強`; `ありがとう` → 빈 배열 |
| URL 생성 | 공백/가나/한자 query가 `encodeURIComponent` 처리됨 |
| DB 매핑 | `word_kanji` 순서와 중복 처리 검증 |
| 화면 | 한자 섹션 노출/숨김, 누락 필드 숨김 |
| TTS | 단어 읽기와 예문 읽기 모두 기존 설정을 따름 |
| 릴리스 게이트 | 네이버 예문 `pending/blocked` 레코드가 번들 DB에 없는지 검사 |

---

## 9. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 네이버 예문 무단 복사 | 저작권/약관/스토어 리젝 위험 | 권리 확인 전 저장 금지, 링크 연결만 제공 |
| 자동 스크래핑 오해 | 서비스 이용 제한/법적 리스크 | 스크래퍼 금지, 수동 검수/허락 기반만 허용 |
| KANJIDIC2 라이선스 누락 | 라이선스 위반 | About/Sources, 라이선스 파일, 업데이트 절차 추가 |
| 한국어 한자 뜻 품질 | 오학습 | 초안 자동 생성 후 사람 검수, `verified`만 출시 |
| 외부 링크 개인정보 고지 부족 | 정책 위반 | Privacy Policy와 Data Safety 문구 갱신 |

---

## 10. 결정 필요 항목

- 네이버 사전은 V1.1에서 외부 브라우저로만 열지, WebView까지 넣을지
- 네이버 예문 사용 허락을 받을 수 있는지
- 한자 설명의 한국어 뜻 검수 범위를 JLPT 6,200 단어에 등장하는 한자로 제한할지
- `KanjiDetailScreen`을 새 라우트로 만들지, 단어 상세 안 바텀시트로 시작할지
- 다중 예문을 V1.1에 넣을지, 기존 단일 예문 구조로 먼저 갈지

---

## 11. 참고 자료

- 네이버 사전 검색 URL 패턴: `https://ja.dict.naver.com/#/search?query={query}`
- NAVER 서비스 이용약관: 타인 콘텐츠를 자유롭게 이용하려면 법률상 허용 범위 또는 권리자의 이용 허락이 필요하다고 안내함. https://notice.naver.com/api/v1/file/download/36
- NAVER 이용제한 고객센터: 저작권자의 복제/전송/배포 권리 침해는 저작권 침해가 될 수 있다고 설명함. https://help.naver.com/service/19212/contents/11672
- EDRDG KANJIDIC2: KANJIDIC2는 EDRDG 라이선스 적용 대상이며, 스마트폰 앱은 출처/라이선스 고지가 필요함. https://www.edrdg.org/kanjidic/kanjd2index_legacy.html
- EDRDG General Dictionary Licence Statement: https://www.edrdg.org/edrdg/licence.html
