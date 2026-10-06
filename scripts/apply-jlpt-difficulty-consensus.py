#!/usr/bin/env python3
"""Move clearly over-leveled words to an easier learner-facing JLPT tier.

A move is made only when at least two of the three available level references
(the original Kaggle seed, the curated PDF primary level, and an exact NAVER
catalog match) agree on the same easier level. Harder moves and one-source
disagreements are deliberately left for manual review.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
WORDS_CSV = DATA / "jlpt_final_wordlist.csv"
WORDS_JSON = DATA / "jlpt_final_wordlist.json"
CHAPTERS_JSON = ROOT / "data/track-a/reading_chapters.json"
SEED_CSV = ROOT / "data/track-a/jlpt_qa_work.csv"
PDF_CSV = DATA / "jlpt_app_vocab.csv"
NAVER_CSV = DATA / "naver_jlpt_level_audit_2026-09-01_post_rebalance.csv"
MANIFEST = DATA / "jlpt_difficulty_consensus_2026-10-03.json"
REVIEW_QUEUE = DATA / "jlpt_n1_unsupported_review_2026-10-03.csv"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_ORDER = {level: index for index, level in enumerate(LEVELS)}
TAG = "difficulty-consensus-easier-2026-10-03"


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


def add_tag(row: dict[str, str], tag: str) -> None:
    tags = json.loads(row.get("tags") or "[]")
    if tag not in tags:
        tags.append(tag)
    row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))


def source_maps() -> dict[str, dict[str, str]]:
    seed_rows, _ = read_csv(SEED_CSV)
    pdf_rows, _ = read_csv(PDF_CSV)
    naver_rows, _ = read_csv(NAVER_CSV)
    return {
        "kaggle_seed": {row["id"]: row["level"] for row in seed_rows},
        "pdf_primary": {
            row["existing_word_id"]: row["primary_level"]
            for row in pdf_rows
            if row.get("existing_word_id") and row.get("primary_level")
        },
        "naver_exact": {
            row["id"]: row["naver_level"]
            for row in naver_rows
            if row.get("naver_level")
        },
    }


def easier_consensus(
    row: dict[str, str], references: dict[str, dict[str, str]]
) -> tuple[str, list[str]] | None:
    votes = {
        name: mapping[row["id"]]
        for name, mapping in references.items()
        if row["id"] in mapping
    }
    counts = Counter(votes.values())
    if not counts:
        return None
    target, support = counts.most_common(1)[0]
    if support < 2 or int(target[1:]) <= int(row["level"][1:]):
        return None
    supporters = sorted(name for name, level in votes.items() if level == target)
    return target, supporters


def assign_changed_chapters(rows: list[dict[str, str]], changed_ids: set[str]) -> None:
    for level in LEVELS:
        level_rows = sorted(
            (row for row in rows if row["level"] == level),
            key=lambda row: (
                -float(row.get("frequency") or 0),
                row["surface"],
                row["id"],
            ),
        )
        chapter_by_id = {
            row["id"]: index // 50 + 1 for index, row in enumerate(level_rows)
        }
        for row in level_rows:
            if row["id"] in changed_ids:
                row["reading_chapter"] = str(chapter_by_id[row["id"]])


def main() -> None:
    rows, fields = read_csv(WORDS_CSV)
    references = source_maps()
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    previous_changes = {change["id"]: change for change in previous.get("changes", [])}
    before_counts = previous.get(
        "before_level_counts", dict(Counter(row["level"] for row in rows))
    )
    changes: list[dict[str, object]] = []

    for row in rows:
        decision = easier_consensus(row, references)
        prior = previous_changes.get(row["id"])
        if decision is None and prior is None:
            continue
        target, supporters = decision or (
            str(prior["after_level"]),
            list(prior["supporters"]),
        )
        before = str(prior["before_level"]) if prior else row["level"]
        row["level"] = target
        add_tag(row, TAG)
        changes.append({
            "id": row["id"],
            "surface": row["surface"],
            "reading_kana": row["reading_kana"],
            "before_level": before,
            "after_level": target,
            "supporters": supporters,
            "policy": "at least two references agree on an easier level",
        })

    if len(changes) != 79:
        raise RuntimeError(f"expected 79 consensus corrections, found {len(changes)}")

    changed_ids = {str(change["id"]) for change in changes}
    assign_changed_chapters(rows, changed_ids)
    rows.sort(key=lambda row: (
        LEVEL_ORDER[row["level"]],
        int(row.get("reading_chapter") or 1),
        -float(row.get("frequency") or 0),
        row["surface"],
        row["id"],
    ))

    chapters = json.loads(CHAPTERS_JSON.read_text(encoding="utf-8"))
    for row in rows:
        if row["id"] in changed_ids:
            chapters[row["id"]] = {
                "frequency": float(row.get("frequency") or 0),
                "reading_chapter": int(row["reading_chapter"]),
            }

    naver_rows, _ = read_csv(NAVER_CSV)
    naver_by_id = {row["id"]: row for row in naver_rows}
    review_rows = []
    for row in rows:
        audit = naver_by_id.get(row["id"], {})
        if (
            row["level"] == "N1"
            and row["source"].startswith("kaggle:")
            and not audit.get("naver_level")
            and not audit.get("candidate_levels")
        ):
            review_rows.append({
                "id": row["id"],
                "surface": row["surface"],
                "reading_kana": row["reading_kana"],
                "meaning_ko": row["meaning_ko"],
                "frequency": row.get("frequency", ""),
                "source": row["source"],
                "review_reason": "N1 Kaggle supplement without NAVER level evidence",
            })
    review_rows.sort(
        key=lambda row: (-float(row["frequency"] or 0), row["surface"], row["id"])
    )
    if len(review_rows) != 112:
        raise RuntimeError(f"expected 112 unsupported N1 rows, found {len(review_rows)}")

    generated_at = datetime.now(timezone.utc).isoformat()
    after_counts = Counter(row["level"] for row in rows)
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
    write_csv(REVIEW_QUEUE, review_rows, [
        "id", "surface", "reading_kana", "meaning_ko", "frequency",
        "source", "review_reason",
    ])
    MANIFEST.write_text(
        json.dumps({
            "generated_at": generated_at,
            "policy": "two-source consensus, easier moves only",
            "before_level_counts": before_counts,
            "after_level_counts": dict(after_counts),
            "corrections": len(changes),
            "unsupported_n1_review_queue": len(review_rows),
            "changes": changes,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"applied {len(changes)} easier-level consensus corrections")
    print(f"queued {len(review_rows)} unsupported N1 rows for manual review")
    print("counts", dict(after_counts))


if __name__ == "__main__":
    main()
