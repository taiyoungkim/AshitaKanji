#!/usr/bin/env python3
"""Merge 伯母/叔母 into one おば card and remove conflicting alt forms."""

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
MERGE_MANIFEST = DATA / "jlpt_oba_card_merge_2026-10-06.json"
SURVIVOR = "w_9ea346dbfdc4c768"
RETIRED = "w_97db66ffd893f4b5"
ALT_CLEANUP_IDS = {
    "w_5efd9e3cbc6cf086",  # 零れる must not claim 溢れる as the same spelling.
    "w_08fb3f57661da121",  # 硬い remains distinct from 堅い / 固い.
    "w_7400af29ea55cfe6",  # 固い remains distinct from 堅い / 硬い.
}
TAG = "oba-card-merged-2026-10-06"


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

    survivor["surface"] = "伯母・叔母"
    survivor["reading_kana"] = "おば"
    survivor["furigana"] = "おば"
    survivor["meaning_ko"] = "이모·고모·숙모 등 아주머니 친척"
    survivor["card_type"] = "A"
    survivor["alt_forms"] = json.dumps(
        ["おば", "伯母さん", "叔母さん"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    survivor["disambig"] = (
        "伯母는 부모보다 나이가 많은 아주머니 친척, "
        "叔母는 나이가 어린 아주머니 친척."
    )
    tags = json.loads(survivor.get("tags") or "[]")
    if TAG not in tags:
        tags.append(TAG)
    survivor["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))

    for word_id in ALT_CLEANUP_IDS:
        row = by_id.get(word_id)
        if row is None:
            raise RuntimeError(f"missing alt-form cleanup row {word_id}")
        row["alt_forms"] = ""

    rows = [row for row in rows if row["id"] != RETIRED]
    if any(row["id"] == RETIRED for row in rows):
        raise RuntimeError("retired 伯母 row remains after merge")

    chapters = json.loads(CHAPTERS_JSON.read_text(encoding="utf-8"))
    chapters.pop(RETIRED, None)

    successor_manifest = json.loads(SUCCESSOR_MANIFEST.read_text(encoding="utf-8"))
    successor_manifest.setdefault("successors", {})[RETIRED] = SURVIVOR

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
            "successor": {RETIRED: SURVIVOR},
            "alt_form_cleanup_ids": sorted(ALT_CLEANUP_IDS),
            "active_before": 7015,
            "active_after": 7014,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("merged 伯母 / 叔母 into one おば study card")
    print("removed 3 conflicting alt-form links")
    print(f"active words now {len(rows)}")


if __name__ == "__main__":
    main()
