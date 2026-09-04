# Example TTS Audit — 2026-09-04

## Summary

- Active examples reviewed: 7,027
- Valid Ogg/Opus files: 7,027
- Active audio-map entries: 7,027
- Text mismatches: 150
  - Material sentence changes: 45
  - Speaker-label or whitespace-only changes: 104
  - Punctuation-only changes: 1
- JLPT-level totals: N5 13, N4 10, N3 26, N2 41, N1 60

The complete row-level evidence is in
`data/pdf-vocab/example_tts_text_mismatches_2026-09-04.csv`.

## Verification basis

1. Compared the current `word.example_jp` for all 7,027 active rows with the
   latest matching `created_items` entry across every TTS generation report.
2. Recovered the pre-hash database from Git commit `98566ec` and matched
   legacy audio by SHA-256 against `assets/audio.bak/examples`.
3. Matched renamed audio to surviving files and generation records by SHA-256.
4. Re-synthesized the remaining 28 untracked sentences with
   `ja-JP-NanamiNeural` at `+0%`; every result matched the bundled MP3 duration
   and byte size.
5. Ran the existing Ogg/Opus probe across all 7,027 active files; all files and
   map entries were present and valid.

## Audit-tool finding

`scripts/audit-example-tts.py` currently checks file presence, mapping, codec,
and duration, but it does not automatically compare existing audio generation
history with the current example text. It also hard-codes an expected count of
7,026 even though the active database contains 7,027 rows, so the normal audit
returns `passed: false` for the wrong reason and does not expose these 150 text
mismatches.

## Regeneration result

- Regenerated all 150 example MP3 files from the current database text.
- Rebuilt the corresponding Android Ogg/Opus assets.
- Generation failures: 0
- Generated-text matches: 150 / 150
- Full active example audio validation: 7,027 / 7,027

Execution details are recorded in
`data/pdf-vocab/example_tts_regeneration_2026-09-04.json` and
`data/pdf-vocab/example_tts_post_regeneration_validation_2026-09-04.json`.
The latter still has `passed: false` solely because of the known hard-coded
7,026 count check described above; its invalid-item and text-mismatch lists are
empty.
