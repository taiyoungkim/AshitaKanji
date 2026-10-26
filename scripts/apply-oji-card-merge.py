#!/usr/bin/env python3
"""Collapse all active おじ / おじさん study cards into one learner card."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
WORDS_CSV = DATA / "jlpt_final_wordlist.csv"
WORDS_JSON = DATA / "jlpt_final_wordlist.json"
CHAPTERS_JSON = ROOT / "data/track-a/reading_chapters.json"
SUCCESSOR_MANIFEST = DATA / "jlpt_orthography_variant_manifest.json"
MERGE_MANIFEST = DATA / "jlpt_oji_card_merge_2026-10-06.json"
SURVIVOR = "w_9f4bac962871acc8"
RETIRED = {
    "w_01f119facf6e9d97": "伯父さん",
    "w_713aaa51e13cbeed": "叔父",
    "w_188378c15d9c641d": "伯父",
}
TAG = "oji-card-merged-2026-10-06"


def read_csv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader), list(reader.fieldnames or [])


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=fields,
            extrasaction="ignore",
            lineterminator="\r\n",
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rows, fields = read_csv(WORDS_CSV)
    by_id = {row["id"]: row for row in rows}
    survivor = by_id.get(SURVIVOR)
    if survivor is None:
        raise RuntimeError(f"missing survivor {SURVIVOR}")

    # Idempotent: retired rows may already have been removed by a previous run.
    retired_present = [word_id for word_id in RETIRED if word_id in by_id]
    if retired_present and set(retired_present) != set(RETIRED):
        raise RuntimeError(f"partial おじ merge state: {retired_present}")

    survivor["surface"] = "伯父さん・叔父さん"
    survivor["reading_kana"] = "おじさん"
    survivor["furigana"] = "おじさん"
    survivor["meaning_ko"] = "큰아버지·작은아버지 등 삼촌; 아저씨"
    survivor["card_type"] = "B"
    survivor["alt_forms"] = json.dumps(
        ["おじさん", "小父さん", "伯父", "叔父"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    survivor["disambig"] = (
        "おじさん은 일반적으로 아저씨 또는 삼촌. "
        "伯父는 부모보다 나이가 많은 삼촌, 叔父는 나이가 어린 삼촌."
    )
    tags = json.loads(survivor.get("tags") or "[]")
    if TAG not in tags:
        tags.append(TAG)
    survivor["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))

    rows = [row for row in rows if row["id"] not in RETIRED]
    if any(row["id"] in RETIRED for row in rows):
        raise RuntimeError("retired おじ rows remain after merge")

    chapters = json.loads(CHAPTERS_JSON.read_text(encoding="utf-8"))
    for word_id in RETIRED:
        chapters.pop(word_id, None)

    successor_manifest = json.loads(SUCCESSOR_MANIFEST.read_text(encoding="utf-8"))
    successors = successor_manifest.setdefault("successors", {})
    successors["w_69c992c9db76a823"] = SURVIVOR
    successors["w_a430acefffcd0bfe"] = SURVIVOR
    for word_id in RETIRED:
        successors[word_id] = SURVIVOR

    generated_at = datetime.now(timezone.utc).isoformat()
    write_csv(WORDS_CSV, rows, fields)
    WORDS_JSON.write_text(
        json.dumps({
            "generated_at": generated_at,
            "count": len(rows),
            "source": str(WORDS_CSV),
            "vocabulary": rows,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    CHAPTERS_JSON.write_text(
        json.dumps(chapters, ensure_ascii=False, indent=0) + "\n",
        encoding="utf-8",
    )
    SUCCESSOR_MANIFEST.write_text(
        json.dumps(successor_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    MERGE_MANIFEST.write_text(
        json.dumps({
            "generated_at": generated_at,
            "survivor": SURVIVOR,
            "retired": RETIRED,
            "successors": {word_id: SURVIVOR for word_id in RETIRED},
            "active_before": 7018,
            "active_after": 7015,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("merged 4 おじ study cards into 1")
    print(f"active words now {len(rows)}")


if __name__ == "__main__":
    main()
