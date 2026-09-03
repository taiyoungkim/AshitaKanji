# Vocabulary asset backlog

Last audited: 2026-08-21 (Asia/Seoul)

Full change log for the な-adjective collapse, dictionary recheck, successor
remount, and TTS follow-up: [`VOCAB_CHANGELOG_2026-08-18.md`](./VOCAB_CHANGELOG_2026-08-18.md).
Machine-readable TTS job list: `data/pdf-vocab/tts_followup_2026-08-18.json`.

## Completed

- Final vocabulary DB: 7,027 / 7,027 active, verified words
- In-scope PDF frequency core: 2,360 / 2,360 included
- Word TTS: 7,027 / 7,027 available (MP3 + Ogg/Opus)
- Word TTS voice: `ja-JP-NanamiNeural`, rate `+0%`
- Example text: 7,027 / 7,027 available (NAVER cleared 6,207 + self-authored 820)
- Example TTS voice: `ja-JP-NanamiNeural`, rate `+0%`

## Remaining content work

1. Continue human review of the kanji QA queue tracked in `kanji_qa_work.csv`.

## Remaining asset/release work

- 2026-08-20 feedback pass rebuilt active maps to 7,050 / 7,050
  (word + example, MP3 + Ogg/Opus).
- Remove or archive 1,418 word MP3s whose IDs are not in the final vocabulary
  (includes the 49 dropped な-forms).
- Remove or archive 419 example MP3s whose IDs are not in the final example set
  (includes the 49 dropped な-forms).
- Decide how pre-generated audio is delivered to remote builds. `assets/audio/`
  and `src/lib/audio/audioMap.gen.ts` are currently gitignored and there is no
  remote-build generation hook.
- Fill `eas.json` iOS `ascAppId` and `appleTeamId`.
- Publish the app, privacy, and support URLs currently checked by the release gate.

## Source reports

- `data/track-a/jlpt_db_report.json`
- `data/pdf-vocab/remaining_word_tts_report.json`
- `data/pdf-vocab/naver_examples_final_misses.json`
- `data/pdf-vocab/naver_examples_final_review_queue.csv`
- `data/pdf-vocab/naver_examples_final_validation.json`
- `data/pdf-vocab/example_reference_audit.json`
- `data/pdf-vocab/self_authored_examples_qa_work.csv`
- `data/pdf-vocab/examples_final_qa_work.csv`
- `data/pdf-vocab/example_completion_report.json`
- `data/pdf-vocab/example_tts_generation_report.json`
- `data/pdf-vocab/example_tts_validation_report.json`
