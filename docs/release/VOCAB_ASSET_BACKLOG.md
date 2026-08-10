# Vocabulary asset backlog

Last audited: 2026-08-10 (Asia/Seoul)

## Completed

- Final vocabulary DB: 6,638 / 6,638 active, verified words
- PDF frequency core: 2,699 / 2,699 included
- Word TTS: 6,638 / 6,638 available and mapped
- Word TTS voice: `ja-JP-NanamiNeural`, rate `+0%`
- Example text: 6,638 / 6,638 available (NAVER cleared 6,502 + self-authored 136)
- Example TTS: 6,638 / 6,638 available, mapped, and `ffprobe` validated
- Example TTS voice: `ja-JP-NanamiNeural`, rate `+0%`

## Remaining content work

1. Review the 1,560-row NAVER priority example queue (duplicates, weak meaning-token
   matches, low scores, or non-direct target-form matches).
2. Review the 136 self-authored examples currently marked `auto`.
3. Human-review the 1,877 kanji QA rows currently marked `auto`.

## Remaining asset/release work

- Remove or archive 1,411 word MP3s whose IDs are not in the final vocabulary.
- Remove or archive 237 example MP3s whose IDs are not in the final example set.
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
