#!/usr/bin/env python3
"""Apply an audited kanji semantic decision manifest to the QA work CSV."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_QA = ROOT / "data" / "track-a" / "kanji_qa_work.csv"
DEFAULT_MANIFEST = ROOT / "data" / "track-a" / "kanji_semantic_review_batch_01_2026-08-18.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qa", type=Path, default=DEFAULT_QA)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    batch_id = str(manifest.get("batch_id") or "").strip()
    if not batch_id:
        raise SystemExit("Decision manifest is missing batch_id")
    decisions = {item["literal"]: item for item in manifest["decisions"]}
    if len(decisions) != len(manifest["decisions"]):
        raise SystemExit("Duplicate literals in decision manifest")

    with args.qa.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames
        rows = list(reader)
    if not fieldnames:
        raise SystemExit(f"Missing CSV header: {args.qa}")

    seen: set[str] = set()
    changed = 0
    for row in rows:
        literal = row.get("literal", "").strip()
        decision = decisions.get(literal)
        if not decision:
            continue
        seen.add(literal)
        current = json.loads(row["meanings_ko"])
        if current not in (decision["old"], decision["new"]):
            raise SystemExit(f"Unexpected current meaning for {literal}: {current}")
        note = f'Semantic review batch {batch_id}: {decision["reason"]}; human confirmation required.'
        desired = json.dumps(decision["new"], ensure_ascii=False, separators=(",", ":"))
        if row["meanings_ko"] != desired or row["qa_status"] != "needs_review" or row["qa_note"] != note:
            changed += 1
        row["meanings_ko"] = desired
        row["qa_status"] = "needs_review"
        row["data_version"] = "9"
        row["qa_note"] = note

    missing = set(decisions) - seen
    if missing:
        raise SystemExit(f"Decision literals missing from QA CSV: {sorted(missing)}")

    with args.qa.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Applied {len(decisions)} decisions ({changed} rows changed): {args.qa.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
