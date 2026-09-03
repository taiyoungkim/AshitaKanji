# JLPT PDF vocabulary export

이 디렉터리는 `/Users/tyoung/Downloads/jlpt단어장`의 PDF 7개에서 추출한 데이터입니다.

- `jlpt_source_entries.csv`: PDF의 모든 인쇄 출현 항목. 중복을 유지하며 출처·페이지·원문 순서를 보존합니다.
- `jlpt_vocab_master.csv`: `surface + reading_kana` 기준으로 통합한 전체 목록입니다.
- `jlpt_app_vocab.csv`: 표제어·읽기·한국어 뜻이 모두 있는 단어형 항목만 남긴 앱 연결용 목록입니다.
  `pass_n1`은 단어 체크북 중 `한자 읽기·문맥 규정`만 포함하며, 뒤쪽 `유의어·용법`은
  원문 감사 데이터에만 보존하고 앱 단어 목록에서는 제외합니다.
- `jlpt_vocab.json`: 전체 통합 목록과 모든 출현 항목을 함께 담은 JSON입니다.
- `jlpt_app_vocab.json`: 앱 연결용 목록만 담은 가벼운 JSON입니다.
- `jlpt_vocab.xlsx`: 위 데이터를 검토하기 위한 필터 가능한 워크북입니다.
- `extraction_report.json`: PDF별 행 수, 섹션 수, 검증 집계입니다.
- `jlpt_final_wordlist.csv` / `.json`: 범위가 확정된 PDF 핵심어를 전부 포함하면서 기존
  NAVER JLPT 급수를 반영하고 부족분만 보충한 최종 앱 단어장 7,050개입니다.
- `naver_examples_final_qa_work.csv`: 최종 단어장에 연결된 사용 허가 확인 예문입니다.
- `self_authored_examples.json`: 최초 자체 작성·번역 예문 53개의 용례 검증 원본이며,
  `self_authored_examples_qa_work.csv`는 구문 검수까지 반영한 자체 예문입니다.
- `examples_final_qa_work.csv`: NAVER 6,221개와 자체 예문 829개를 합친 앱 DB 빌드용
  최종 예문 7,050개입니다.
- `example_reference_audit.json` / `example_completion_report.json`: 외부 용례 조회와
  예문 100% 커버리지 검증 기록입니다.
- `example_tts_generation_report.json` / `example_tts_validation_report.json`: 예문
  TTS 생성·문장 일치·MP3/Ogg 스트림·오디오맵 전수 검증 기록입니다.
- `jlpt_final_replacement_manifest.json`: 기존 DB에서 유지·추가·제외·교정된 항목의
  재현 가능한 교체 기록입니다.

CSV는 Excel에서도 바로 열 수 있도록 UTF-8 BOM으로 저장합니다. 원본 필드는 `*_raw`, 정규화한 앱 필드는 `surface`, `reading_kana`, `meaning_ko`입니다. `source_entry_id`를 이용하면 각 항목을 PDF 파일·페이지·순서까지 다시 추적할 수 있습니다.

재생성:

```sh
/Users/tyoung/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/extract-jlpt-pdfs.py
```

검수 완료된 최종 단어장과 예문을 앱 DB로 빌드:

```sh
npm run track-a:build
```
