# JLPT PDF vocabulary export

이 디렉터리는 `/Users/tyoung/Downloads/jlpt단어장`의 PDF 7개에서 추출한 데이터입니다.

- `jlpt_source_entries.csv`: PDF의 모든 인쇄 출현 항목. 중복을 유지하며 출처·페이지·원문 순서를 보존합니다.
- `jlpt_vocab_master.csv`: `surface + reading_kana` 기준으로 통합한 전체 목록입니다.
- `jlpt_app_vocab.csv`: 표제어·읽기·한국어 뜻이 모두 있는 단어형 항목만 남긴 앱 연결용 목록입니다.
- `jlpt_vocab.json`: 전체 통합 목록과 모든 출현 항목을 함께 담은 JSON입니다.
- `jlpt_app_vocab.json`: 앱 연결용 목록만 담은 가벼운 JSON입니다.
- `jlpt_vocab.xlsx`: 위 데이터를 검토하기 위한 필터 가능한 워크북입니다.
- `extraction_report.json`: PDF별 행 수, 섹션 수, 검증 집계입니다.

CSV는 Excel에서도 바로 열 수 있도록 UTF-8 BOM으로 저장합니다. 원본 필드는 `*_raw`, 정규화한 앱 필드는 `surface`, `reading_kana`, `meaning_ko`입니다. `source_entry_id`를 이용하면 각 항목을 PDF 파일·페이지·순서까지 다시 추적할 수 있습니다.

재생성:

```sh
/Users/tyoung/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/extract-jlpt-pdfs.py
```
