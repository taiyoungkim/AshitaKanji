# Vocabulary change log — 2026-08-19

## Example review-queue pass (2026-08-20)

- Rebuilt the NAVER example review queue against the current 6,962-word list
  (1,481 rows).
- Rewrote 183 examples as original AshitaKanji sentences so the current
  headword appears: 66 surface-missing cards, 103 Flitto/proverb/web-collected
  cards, plus leftover wrong-word items (`おや`←親, `せい`←性, `裏切る`,
  `真似る`, `湿気る`, `見送る`, …).
- Converted leftover `自動的な` → `自動的`.
- Corrected `人格` Korean meaning (dropped leaked `문자`).
- Examples now: NAVER cleared 6,596 + self-authored 366.
- Remaining queue 1,338 rows were then finished: 460 shared/mismatch/fragment
  examples rewritten uniquely, leftover Korean meaning gaps patched, and the
  review auditor now treats 1-character and inflected Korean glosses as hits.
- Final examples: NAVER cleared 6,136 + self-authored 826.
- Review queue is now 0.

Evidence: `data/pdf-vocab/jlpt_example_review_manifest.json`,
`data/pdf-vocab/jlpt_remaining_review_manifest.json`,
`scripts/apply-example-review-queue.py`,
`scripts/apply-remaining-review-queue.py`.

## Priority spelling / level / example / な-collapse pass

- Fixed broken cards: `新ただ` merged into `新た`; `お先に` and `お待たせしました`
  Korean meanings rewritten; 15 examples rewritten so the headword actually
  appears (医院, 回す, 二十歳, 点く, 電車代, 街, 昨夜, 貼る, 履く, and related).
- Moved 39 high-confidence NAVER catalog+search level mismatches.
- Normalized 8 rare-kanji spellings (`まさか`, `あくび`, `かむ`, `どっち`,
  `空き地`, `あれこれ`; merged `負んぶ`→`おんぶ`, `摑む`→`掴む`).
- Collapsed remaining `X`/`Xだ`/`Xな` adjective duplicates to the stem.
  Did not pad the list with low-quality catalog leftovers.
- Final counts: N5 397 / N4 728 / N3 1,464 / N2 1,875 / N1 2,498 (6,962 total).
- Examples: NAVER cleared 6,774 + self-authored 188.
- Successor remap version 4 (113 new pairs from this pass).

Evidence: `data/pdf-vocab/jlpt_priority_fix_manifest.json`.

## NAVER JLPT rebalance

- Audited all current entries against the NAVER Japanese Dictionary JLPT catalog.
- Directly searched all 1,601 catalog-level mismatch candidates in NAVER.
- Moved 1,594 confirmed mismatches to the NAVER level; left 7 ambiguous rows unchanged.
- Kept every post-move surplus and filled only the shortages: N3 +325 and N1 +64.
- Added 389 globally deduplicated lexical entries with exact modern JMdict forms.
- Final counts: N5 393 / N4 726 / N3 1,499 / N2 1,909 / N1 2,500 (7,027 total).
- Final examples: NAVER cleared 6,856 + self-authored 171 (7,027 total).
- Generated word and example TTS for all 389 additions and verified all 14,054 active
  Ogg/Opus assets with zero codec failures.

## Reproducible evidence

- `data/pdf-vocab/naver_jlpt_level_mismatch_direct_check_2026-08-19.csv`
- `data/pdf-vocab/jlpt_naver_rebalance_manifest.json`
- `data/pdf-vocab/jlpt_naver_backfill_additions.csv`
- `data/pdf-vocab/naver_rebalance_tts_generation_report.json`
- `data/pdf-vocab/example_tts_validation_report.json`
- `data/track-a/jlpt_db_report.json`
