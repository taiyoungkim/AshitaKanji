#!/usr/bin/env python3
"""Verify that every vocabulary occurrence extracted from the JLPT PDFs survives.

The PDF source contains repeated words across books and levels.  The app core is
therefore an aggregated list, and later orthography reviews may merge kana-only,
mixed-script, or mistyped aliases into one canonical word.  Phrase review may
also move a compositional collocation or explanatory gloss onto the related
dictionary-form card.  Coverage is checked through that complete mapping chain
instead of requiring the original spelling to remain visible in the app.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "pdf-vocab"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--report",
        type=Path,
        default=DATA / "jlpt_pdf_core_post_review_coverage.json",
    )
    args = parser.parse_args()

    source_rows = read_csv(DATA / "jlpt_source_entries.csv")
    core_rows = read_csv(DATA / "jlpt_app_vocab.csv")
    final_rows = read_csv(DATA / "jlpt_final_wordlist.csv")
    build = read_json(DATA / "jlpt_final_replacement_manifest.json")
    orthography = read_json(DATA / "jlpt_orthography_replacement_manifest.json")
    review = read_json(DATA / "jlpt_headword_review_manifest.json")
    phrase_review = read_json(DATA / "jlpt_phrase_review_manifest.json")

    aliases: dict[str, str] = {}
    for row in build["retained_corrections"]:
        if row["old_id"] != row["new_id"]:
            aliases[row["old_id"]] = row["new_id"]
    for manifest in (orthography, review):
        for row in manifest["merged_aliases"]:
            aliases[row["removed_id"]] = row["retained_id"]
    for source_id, target_id in phrase_review["source_phrase_mapping"].items():
        if source_id != target_id:
            aliases[source_id] = target_id

    def resolve(word_id: str) -> tuple[str, list[str]]:
        chain = [word_id]
        while word_id in aliases:
            word_id = aliases[word_id]
            if word_id in chain:
                raise RuntimeError(f"alias cycle: {' -> '.join(chain + [word_id])}")
            chain.append(word_id)
        return word_id, chain

    final_ids = {row["id"] for row in final_rows}
    mapped: list[dict[str, object]] = []
    missing: list[dict[str, object]] = []
    for row in core_rows:
        initial_id = row["existing_word_id"] or row["id"]
        final_id, chain = resolve(initial_id)
        item = {
            "core_id": row["id"],
            "surface": row["surface"],
            "reading_kana": row["reading_kana"],
            "source_entry_ids": row["source_entry_ids"],
            "initial_word_id": initial_id,
            "final_word_id": final_id,
            "alias_chain": chain,
        }
        mapped.append(item)
        if final_id not in final_ids:
            missing.append(item)

    source_types = Counter(row["entry_type"] for row in source_rows)
    included_source_rows = [row for row in source_rows if row["include_in_app"] == "1"]
    excluded_source_rows = [row for row in source_rows if row["include_in_app"] != "1"]
    excluded_types = Counter(row["entry_type"] for row in excluded_source_rows)
    resolved_ids = {str(row["final_word_id"]) for row in mapped}
    source_needs_review = sum(row["qa_status"] != "verified" for row in source_rows)
    checks = {
        "all_printed_rows_verified": source_needs_review == 0,
        "all_printed_vocabulary_rows_aggregated": (
            len(included_source_rows) == source_types.get("word", 0)
            and len(core_rows) == int(build["summary"]["pdf_core_total"])
        ),
        "all_core_entries_resolve_to_final": len(missing) == 0,
        "final_word_count": len(final_rows) == 6638,
        "final_unique_ids": len(final_ids) == 6638,
    }
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "PASS" if all(checks.values()) else "FAIL",
        "checks": checks,
        "counts": {
            "printed_source_rows": len(source_rows),
            "printed_vocabulary_occurrences": len(included_source_rows),
            "printed_non_vocabulary_rows": len(excluded_source_rows),
            "source_entry_types": dict(sorted(source_types.items())),
            "excluded_entry_types": dict(sorted(excluded_types.items())),
            "aggregated_pdf_core_entries": len(core_rows),
            "core_entries_mapped_through_alias": sum(
                row["initial_word_id"] != row["final_word_id"] for row in mapped
            ),
            "phrase_review_source_mappings": len(phrase_review["source_phrase_mapping"]),
            "phrase_review_removed_or_merged": sum(
                source_id != target_id
                for source_id, target_id in phrase_review["source_phrase_mapping"].items()
            ),
            "unique_final_words_covering_pdf_core": len(resolved_ids),
            "missing_core_entries": len(missing),
            "final_words": len(final_rows),
        },
        "missing": missing,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
