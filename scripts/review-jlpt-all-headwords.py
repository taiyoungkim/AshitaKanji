#!/usr/bin/env python3
"""Adjudicate every row from the full JLPT headword audit.

The decision file contains only changes requiring judgement.  This script
adds an explicit keep/replace/merge decision to all 6,638 rows and validates
the projected canonical key space without mutating release data.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--audit",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_all_headword_audit.json"),
    )
    parser.add_argument(
        "--decisions",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_decisions.json"),
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_all_headword_reviewed.json"),
    )
    parser.add_argument(
        "--csv-out",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_all_headword_reviewed.csv"),
    )
    return parser.parse_args()


def keep_reason(row: dict[str, Any]) -> str:
    flags = set(row["flags"])
    if "non-jmdict-surface" in flags:
        return "PDF의 활용형·결합 표현을 구성 요소와 읽기까지 수동 확인하여 유지"
    if "same-jmdict-entry-duplicate" in flags:
        return "같은 사전 항목에 속하지만 한자별 의미·용법 차이가 있어 별도 학습어로 유지"
    if "same-reading-meaning-duplicate" in flags:
        return "동음어 또는 한자별 의미 차이를 한국어 뜻으로 구분하여 유지"
    if row.get("prior_audit_decision"):
        return (
            "이전 가나 표기 전수 검수 유지: "
            + row.get("prior_audit_evidence", row["prior_audit_decision"])
        )
    if "mixed-has-more-kanji-variant" in flags:
        return "더 많은 한자를 쓰는 이형보다 현재 표기가 현대 일반 표기라 유지"
    if "kana-has-kanji-variant" in flags:
        return "가나 표기가 일반적이거나 한자형이 문맥상 모호하여 유지"
    if row["jmdict_exact_kind"] != "none":
        return "표면형과 읽기가 JMdict 표제어에 정확히 일치"
    return "문자·읽기·뜻 대조 완료"


def main() -> None:
    args = parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    decisions = json.loads(args.decisions.read_text(encoding="utf-8"))
    rows = audit["rows"]
    by_id = {row["id"]: row for row in rows}
    fixes = decisions["fixes"]
    merges = decisions["merges"]
    meaning_fixes = decisions["meaning_fixes"]

    if len(rows) != 6638 or len(by_id) != 6638:
        raise RuntimeError("audit must contain 6,638 unique rows")
    referenced = set(fixes) | set(merges) | set(meaning_fixes)
    missing = sorted(referenced - set(by_id))
    if missing:
        raise RuntimeError(f"decision IDs missing from audit: {missing}")

    reviewed: list[dict[str, Any]] = []
    for source in rows:
        row = dict(source)
        word_id = row["id"]
        fix = fixes.get(word_id, {})
        merge = merges.get(word_id)
        meaning_fix = meaning_fixes.get(word_id)

        row["review_surface"] = fix.get("surface", row["surface"])
        row["review_reading_kana"] = fix.get(
            "reading_kana", row["reading_kana"]
        )
        row["review_meaning_ko"] = (
            meaning_fix or {}
        ).get("meaning_ko", fix.get("meaning_ko", row["meaning_ko"]))
        row["merge_winner_id"] = ""

        if merge:
            row["review_decision"] = "merge"
            row["review_surface"] = merge["canonical_surface"]
            row["merge_winner_id"] = merge["winner_id"]
            row["review_reason"] = merge["reason"]
        elif fix and meaning_fix:
            row["review_decision"] = "replace-and-meaning-update"
            row["review_reason"] = fix["reason"] + "; " + meaning_fix["reason"]
        elif fix:
            row["review_decision"] = "replace"
            row["review_reason"] = fix["reason"]
        elif meaning_fix:
            row["review_decision"] = "meaning-update"
            row["review_reason"] = meaning_fix["reason"]
        else:
            row["review_decision"] = "keep"
            row["review_reason"] = keep_reason(row)

        row["review_status"] = (
            "manually-adjudicated"
            if row["flags"] or word_id in referenced
            else "dictionary-verified"
        )
        reviewed.append(row)

    # Validate merge targets and canonical values.
    reviewed_by_id = {row["id"]: row for row in reviewed}
    for loser_id, merge in merges.items():
        winner_id = merge["winner_id"]
        if winner_id not in reviewed_by_id:
            raise RuntimeError(f"merge target missing: {winner_id}")
        if winner_id in merges:
            raise RuntimeError(f"merge chain is not allowed: {loser_id} -> {winner_id}")
        winner = reviewed_by_id[winner_id]
        if winner["review_surface"] != merge["canonical_surface"]:
            raise RuntimeError(
                f"canonical mismatch for {loser_id}: "
                f"{merge['canonical_surface']} != {winner['review_surface']}"
            )

    projected: dict[tuple[str, str], list[str]] = defaultdict(list)
    for row in reviewed:
        if row["review_decision"] == "merge":
            continue
        projected[(row["review_surface"], row["review_reading_kana"])].append(
            row["id"]
        )
    collisions = {
        f"{surface}|{reading}": ids
        for (surface, reading), ids in projected.items()
        if len(ids) > 1
    }
    if collisions:
        preview = list(collisions.items())[:8]
        raise RuntimeError(f"unresolved canonical collisions: {preview}")

    decision_counts = Counter(row["review_decision"] for row in reviewed)
    status_counts = Counter(row["review_status"] for row in reviewed)
    changes_by_level = Counter(
        row["level"]
        for row in reviewed
        if row["review_decision"] != "keep"
    )
    merges_by_level = Counter(
        row["level"] for row in reviewed if row["review_decision"] == "merge"
    )
    remaining_nonexact = sum(
        row["review_decision"] == "keep"
        and "non-jmdict-surface" in row["flags"]
        for row in reviewed
    )
    summary = {
        "total_rows": len(reviewed),
        "unresolved_rows": sum(not row["review_decision"] for row in reviewed),
        "decision_counts": dict(sorted(decision_counts.items())),
        "review_status_counts": dict(sorted(status_counts.items())),
        "changed_rows_by_level": dict(sorted(changes_by_level.items())),
        "merge_deficits_by_level": dict(sorted(merges_by_level.items())),
        "projected_unique_words_before_backfill": len(projected),
        "retained_pdf_inflections_and_phrases": remaining_nonexact,
        "projected_collisions": 0,
    }

    output = {
        "schema_version": 1,
        "policy": decisions["policy"],
        "audit_input": str(args.audit),
        "decisions_input": str(args.decisions),
        "summary": summary,
        "rows": sorted(
            reviewed,
            key=lambda row: (
                {"merge": 0, "replace": 1, "replace-and-meaning-update": 1,
                 "meaning-update": 2, "keep": 3}[row["review_decision"]],
                row["level"], row["reading_kana"], row["surface"], row["id"],
            ),
        ),
    }
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    columns = [
        "id", "level", "surface", "reading_kana", "meaning_ko",
        "review_decision", "review_surface", "review_reading_kana",
        "review_meaning_ko", "merge_winner_id", "review_reason",
        "review_status", "attention", "surface_class", "jmdict_exact_kind",
        "flags", "same_jmdict_entry_ids", "same_reading_meaning_ids",
        "prior_audit_decision", "source", "example_jp",
    ]
    with args.csv_out.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for row in output["rows"]:
            flat = dict(row)
            for key in ("flags", "same_jmdict_entry_ids", "same_reading_meaning_ids"):
                flat[key] = ";".join(flat[key])
            writer.writerow({key: flat.get(key, "") for key in columns})

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"wrote {len(reviewed)} reviewed rows to {args.json_out} and {args.csv_out}")


if __name__ == "__main__":
    main()
