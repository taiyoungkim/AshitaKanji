# Vocabulary change log — 2026-08-21

## 仕方なく → 仕方ない N4 (2026-09-01)

`仕方なく` was an N1 PDF-core card. NAVER has no JLPT badge on that
adverbial form; the lemma `仕方ない` is N4. `仕方がない` stays N2.

- Rewrote `仕方なく` N1 → `仕方ない` N4, meaning `어쩔 수 없다`.
- Kept `仕方なく` as an alt form.
- Successor `w_00b6d9661826f4ca` → `w_3e5c61e8a0dce5c9`.
- Counts: N5 400 / N4 744 / N3 1,491 / N2 1,906 / N1 2,486 (7,027 total).

Evidence: `data/pdf-vocab/jlpt_shikatanai_n4_manifest.json`,
`scripts/apply-shikatanai-n4.py`.


## まだ / いまだ split (2026-09-01)

N1 study showed 未だ / いまだ with the everyday meaning 아직, so まだ looked
like it had been given the wrong reading and the wrong level.

- NAVER lists two badges on 未だ: N5 まだ and N1 いまだ (literary, =まだ).
- The app had only the N1 card, and its example `理由は未だある` was the N5
  まだ sense. Everyday まだ was missing.
- Added N5 `まだ` / `아직`.
- Rewrote the N1 card to `いまだ` (alt `未だ`), meaning `아직 (예스러운 말)`,
  example `原因はいまだ解明されていない。`
- Successor `w_010ee73feb13c7cc` → `w_1c28467b52572134`.
- Counts: N5 400 / N4 743 / N3 1,491 / N2 1,906 / N1 2,487 (7,027 total).

Evidence: `data/pdf-vocab/jlpt_mada_imada_split_manifest.json`,
`scripts/apply-mada-imada-split.py`.


## NAVER cross-check follow-up

Live-searched remaining catalog mismatches, homographs, and `々` cards
against NAVER Japanese Dictionary after the 09:33 manual review.

- Moved 13 cards whose unique NAVER form+reading badge did not match the app:
  `活発` N2→N1, `我々` N3→N2, `度々` N3→N2, `別々` N2→N3, `続々` N2→N3,
  `若々しい` N2→N3, `図々しい` N2→N3, `長々` N1→N3, `漬ける` N4→N3,
  `付く` N3→N4, `只` N1→N3, `せい` N3→N2, `硬い` N3→N4.
- `只` N1 was a false read of the kanji `NAMEYN` tag, not a word JLPT badge.
  The 공짜 sense is N3 `只·徒`.
- Kept modern `々` surfaces (`我々`, `度々`, …) and added the catalog
  doubled-kanji forms as `alt_forms`.
- Corrected `ちらっと` Korean gloss (`에서 흘끗 봄, 우연히` → `흘끗, 잠깐, 언뜻`)
  and `学習` (`공부하다, 배우다` → `학습, 배움`).
- Split `その他` reading `そのほか` → `そのた`. `そのほか` stays as an alt
  (`其の外`). Successor `w_f6461fe50fbc18a7` → `w_2ae90bd5eccd679e`.
- Did not move `止まる`, `柔らかい`, `酒/さけ`, `主/おも`, `一昨日/いっさくじつ`,
  `一昨年/いっさくねん`: either the live exact badge matches the app, or the
  catalog badge belongs to a different reading/sense.
- Final counts: N5 399 / N4 743 / N3 1,491 / N2 1,906 / N1 2,487 (7,026 total).

Evidence: `data/pdf-vocab/jlpt_naver_crosscheck_fix_manifest.json`,
`scripts/apply-naver-crosscheck-fixes.py`.
