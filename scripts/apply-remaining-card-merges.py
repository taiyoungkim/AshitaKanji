#!/usr/bin/env python3
"""Merge three active-card pairs already declared as alternate forms."""

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
MERGE_MANIFEST = DATA / "jlpt_remaining_card_merges_2026-10-06.json"
TAG = "remaining-card-merged-2026-10-06"

MERGES = [
    {
        "survivor": "w_16afef6fcc1d2e6d",
        "retired": "w_9d1276b961227354",
        "surface": "高校",
        "level": "N4",
        "alt_forms": ["高等学校"],
        "disambig": "高校는 高等学校의 일반적인 줄임말.",
    },
    {
        "survivor": "w_bf03a7c1b0d7b64c",
        "retired": "w_3ec592997b865dca",
        "surface": "やはり",
        "level": "N4",
        "alt_forms": ["やっぱり"],
        "disambig": "やっぱり는 やはり의 구어적 표현.",
    },
    {
        "survivor": "w_0e85c73b6c150596",
        "retired": "w_97e7d7c923d83b1c",
        "surface": "アイデア",
        "level": "N4",
        "alt_forms": ["アイディア"],
        "disambig": "アイディア도 같은 외래어의 표기 변형.",
    },
]


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
    retired_ids = {str(merge["retired"]) for merge in MERGES}

    for merge in MERGES:
        survivor = by_id.get(str(merge["survivor"]))
        if survivor is None:
            raise RuntimeError(f"missing survivor {merge['survivor']}")
        survivor["level"] = str(merge["level"])
        survivor["alt_forms"] = json.dumps(
            merge["alt_forms"], ensure_ascii=False, separators=(",", ":")
        )
        survivor["disambig"] = str(merge["disambig"])
        tags = json.loads(survivor.get("tags") or "[]")
        if TAG not in tags:
            tags.append(TAG)
        survivor["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))

    rows = [row for row in rows if row["id"] not in retired_ids]
    if any(row["id"] in retired_ids for row in rows):
        raise RuntimeError("retired duplicate rows remain after merge")

    # アイデア moved from N2 to N4; place it by frequency in its new read-through tier.
    n4_rows = sorted(
        (row for row in rows if row["level"] == "N4"),
        key=lambda row: (-float(row.get("frequency") or 0), row["surface"], row["id"]),
    )
    chapter_by_id = {row["id"]: index // 50 + 1 for index, row in enumerate(n4_rows)}
    idea_id = "w_0e85c73b6c150596"
    by_id[idea_id]["reading_chapter"] = str(chapter_by_id[idea_id])

    level_order = {level: index for index, level in enumerate(("N5", "N4", "N3", "N2", "N1"))}
    rows.sort(key=lambda row: (
        level_order[row["level"]],
        int(row.get("reading_chapter") or 1),
        -float(row.get("frequency") or 0),
        row["surface"],
        row["id"],
    ))

    chapters = json.loads(CHAPTERS_JSON.read_text(encoding="utf-8"))
    for word_id in retired_ids:
        chapters.pop(word_id, None)
    chapters[idea_id] = {
        "frequency": float(by_id[idea_id].get("frequency") or 0),
        "reading_chapter": int(by_id[idea_id]["reading_chapter"]),
    }

    successor_manifest = json.loads(SUCCESSOR_MANIFEST.read_text(encoding="utf-8"))
    successors = successor_manifest.setdefault("successors", {})
    for merge in MERGES:
        successors[str(merge["retired"])] = str(merge["survivor"])

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
            "merges": MERGES,
            "active_before": 7014,
            "active_after": 7011,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("merged 高校/高等学校, やはり/やっぱり, アイデア/アイディア")
    print(f"active words now {len(rows)}")


if __name__ == "__main__":
    main()
