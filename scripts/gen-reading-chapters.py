#!/usr/bin/env python3
"""Generate frozen 회독(read-through) chapter assignments for vocabulary.

Each active word gets:
  - frequency: wordfreq Zipf frequency (general JA corpus, surface-based)
  - reading_chapter: 1-based chapter index WITHIN its JLPT level, 50 words/chapter,
    ordered by frequency desc (most frequent = chapter 1).

Freezing: existing assignments in reading_chapters.json are preserved. New words
(added after first run) are appended to fresh chapters AFTER the current max chapter
for their level — so a learner's chapter contents never reshuffle.

Output: data/track-a/reading_chapters.json  { id: {frequency, reading_chapter} }

Requires: pip install wordfreq mecab-python3 ipadic
Usage: python3 scripts/gen-reading-chapters.py [--rebuild]
"""
import csv
import json
import os
import sys

from wordfreq import zipf_frequency

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data/track-a/jlpt_qa_work.csv")
OUT = os.path.join(ROOT, "data/track-a/reading_chapters.json")
CHUNK = 50
LEVELS = ["N5", "N4", "N3", "N2", "N1"]
rebuild = "--rebuild" in sys.argv


def freq(surface: str, reading: str) -> float:
    f = zipf_frequency(surface, "ja")
    if f == 0.0:
        f = zipf_frequency(reading.split(";")[0].split("(")[0].strip(), "ja")
    return round(f, 3)


def main() -> None:
    rows = [
        r
        for r in csv.DictReader(open(CSV_PATH, encoding="utf-8"))
        if r.get("deprecated") != "1"
    ]

    existing = {}
    if os.path.exists(OUT) and not rebuild:
        existing = json.load(open(OUT, encoding="utf-8"))

    # frequency for every active word (always refresh — it is non-identifying)
    out = {}
    by_level_new = {lv: [] for lv in LEVELS}
    max_chapter = {lv: 0 for lv in LEVELS}

    # carry frozen chapters; track per-level max
    for r in rows:
        wid, lv = r["id"], r["level"]
        if lv not in by_level_new:
            continue
        f = freq(r["surface"], r["reading_kana"])
        prev = existing.get(wid)
        if prev and "reading_chapter" in prev:
            ch = int(prev["reading_chapter"])
            out[wid] = {"frequency": f, "reading_chapter": ch}
            max_chapter[lv] = max(max_chapter[lv], ch)
        else:
            by_level_new[lv].append((f, r["surface"], wid))

    # assign new words: freq desc, packed into chapters after current max
    for lv in LEVELS:
        newcomers = sorted(by_level_new[lv], key=lambda x: (-x[0], x[1]))
        start = max_chapter[lv]
        for i, (f, _surface, wid) in enumerate(newcomers):
            ch = start + (i // CHUNK) + 1
            out[wid] = {"frequency": f, "reading_chapter": ch}

    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

    # report
    from collections import Counter

    per_level = Counter()
    chapters = {lv: set() for lv in LEVELS}
    for r in rows:
        wid, lv = r["id"], r["level"]
        if wid in out and lv in chapters:
            per_level[lv] += 1
            chapters[lv].add(out[wid]["reading_chapter"])
    print(f"assigned {len(out)} words → {OUT}")
    for lv in LEVELS:
        print(f"  {lv}: {per_level[lv]} words, {len(chapters[lv])} chapters")


if __name__ == "__main__":
    main()
