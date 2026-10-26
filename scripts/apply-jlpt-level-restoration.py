#!/usr/bin/env python3
"""Restore misplaced N1 words to their directly evidenced PDF level."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
WORDS_CSV = DATA / "jlpt_final_wordlist.csv"
WORDS_JSON = DATA / "jlpt_final_wordlist.json"
CHAPTERS_JSON = ROOT / "data/track-a/reading_chapters.json"
MANIFEST = DATA / "jlpt_level_restoration_2026-10-03.json"
REVIEW_QUEUE = DATA / "jlpt_n1_supplement_level_review_2026-10-03.csv"
NAVER_AUDIT = DATA / "naver_jlpt_level_audit_2026-09-01_post_rebalance.csv"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: index for index, level in enumerate(LEVELS)}
PDF_TAG = "level-restored-from-pdf-2026-10-03"
MANUAL_TAG = "manual-level-curated-2026-10-03"
ARIGATO_ID = "w_c41c1b47224d5c11"


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
            # Keep the established CRLF format so level-only changes stay reviewable.
            lineterminator="\r\n",
        )
        writer.writeheader()
        writer.writerows(rows)


def add_tag(row: dict[str, str], tag: str) -> None:
    tags = json.loads(row.get("tags") or "[]")
    if tag not in tags:
        tags.append(tag)
    row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))


def pdf_levels(source: str) -> list[str]:
    return sorted({f"N{value}" for value in re.findall(r"(?:mkt|pass)_n([1-5])", source)})


def directly_evidenced_level(source: str) -> str | None:
    levels = pdf_levels(source)
    if not levels or "N1" in levels:
        return None
    # If multiple books disagree, prefer the easier level for learner-facing placement.
    return max(levels, key=lambda level: int(level[1:]))


def assign_changed_chapters(rows: list[dict[str, str]], changed_ids: set[str]) -> None:
    for level in LEVELS:
        level_rows = sorted(
            (row for row in rows if row["level"] == level),
            key=lambda row: (-float(row.get("frequency") or 0), row["surface"], row["id"]),
        )
        rank = {row["id"]: index // 50 + 1 for index, row in enumerate(level_rows)}
        for row in level_rows:
            if row["id"] in changed_ids:
                row["reading_chapter"] = str(rank[row["id"]])


def main() -> None:
    rows, fields = read_csv(WORDS_CSV)
    before_counts = Counter(row["level"] for row in rows)
    previous_manifest = (
        json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    )
    previous_changes = {
        change["id"]: change for change in previous_manifest.get("changes", [])
    }
    changes: list[dict[str, str]] = []

    for row in rows:
        target = directly_evidenced_level(row["source"])
        already_restored = PDF_TAG in (row.get("tags") or "")
        if target and (row["level"] == "N1" or already_restored):
            before = previous_changes.get(row["id"], {}).get("before_level", row["level"])
            row["level"] = target
            add_tag(row, PDF_TAG)
            changes.append({
                "id": row["id"],
                "surface": row["surface"],
                "reading_kana": row["reading_kana"],
                "before_level": before,
                "after_level": target,
                "evidence": row["source"],
                "policy": "direct PDF level restored over NAVER rebalance",
            })

    arigato = next((row for row in rows if row["id"] == ARIGATO_ID), None)
    if arigato is None:
        raise RuntimeError(f"missing ありがとう row: {ARIGATO_ID}")
    arigato_before = previous_changes.get(ARIGATO_ID, {}).get(
        "before_level", arigato["level"]
    )
    arigato["level"] = "N5"
    add_tag(arigato, MANUAL_TAG)
    changes.append({
        "id": arigato["id"],
        "surface": arigato["surface"],
        "reading_kana": arigato["reading_kana"],
        "before_level": arigato_before,
        "after_level": "N5",
        "evidence": "basic learner expression; N4 PDF sentence evidence; app-curated placement",
        "policy": "manual learner-facing level correction",
    })

    pdf_changes = [change for change in changes if change["id"] != ARIGATO_ID]
    if len(pdf_changes) != 65:
        raise RuntimeError(f"expected 65 PDF restorations, found {len(pdf_changes)}")

    changed_ids = {change["id"] for change in changes}
    assign_changed_chapters(rows, changed_ids)
    rows.sort(key=lambda row: (
        LEVEL_RANK[row["level"]],
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

    generated_at = datetime.now(timezone.utc).isoformat()
    after_counts = Counter(row["level"] for row in rows)
    naver_rows, _ = read_csv(NAVER_AUDIT)
    naver_by_id = {row["id"]: row for row in naver_rows}
    review_rows = []
    for row in rows:
        audit = naver_by_id.get(row["id"], {})
        if (
            row["level"] == "N1"
            and row["source"].startswith("kaggle:")
            and audit.get("status") != "exact_match"
        ):
            review_rows.append({
                "id": row["id"],
                "surface": row["surface"],
                "reading_kana": row["reading_kana"],
                "meaning_ko": row["meaning_ko"],
                "frequency": row.get("frequency", ""),
                "naver_status": audit.get("status", "missing"),
                "naver_level": audit.get("naver_level", ""),
                "source": row["source"],
                "review_reason": "N1 supplement without exact NAVER N1 confirmation",
            })
    review_rows.sort(key=lambda row: (-float(row["frequency"] or 0), row["surface"], row["id"]))
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
        "naver_status", "naver_level", "source", "review_reason",
    ])
    MANIFEST.write_text(
        json.dumps({
            "generated_at": generated_at,
            "before_level_counts": previous_manifest.get(
                "before_level_counts", dict(before_counts)
            ),
            "after_level_counts": dict(after_counts),
            "pdf_restorations": len(pdf_changes),
            "manual_corrections": 1,
            "n1_supplement_review_queue": len(review_rows),
            "changes": changes,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"restored {len(pdf_changes)} PDF-backed levels and curated ありがとう → N5")
    print(f"queued {len(review_rows)} N1 supplement rows for manual level review")
    print("counts", dict(after_counts))


if __name__ == "__main__":
    main()
