#!/usr/bin/env python3
"""Promote validated orthography outputs to the release data paths."""

from __future__ import annotations

import argparse
import csv
import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Any


LEVEL_TARGETS = {"N5": 339, "N4": 600, "N3": 1499, "N2": 1700, "N1": 2500}
EXAMPLE_FIELDS = (
    "word_id", "jp", "ko", "source", "source_url", "license",
    "permission_status", "attribution", "captured_at", "qa_status",
    "sort_order", "naver_example_id", "naver_source_cid", "naver_source_name",
    "query", "qa_note",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--words-csv", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_wordlist.csv"))
    parser.add_argument("--words-json", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_wordlist.json"))
    parser.add_argument("--examples", type=Path, default=Path("data/pdf-vocab/examples_orthography_seed.csv"))
    parser.add_argument("--final-csv", type=Path, default=Path("data/pdf-vocab/jlpt_final_wordlist.csv"))
    parser.add_argument("--final-json", type=Path, default=Path("data/pdf-vocab/jlpt_final_wordlist.json"))
    parser.add_argument("--final-examples", type=Path, default=Path("data/pdf-vocab/examples_final_qa_work.csv"))
    parser.add_argument("--final-naver", type=Path, default=Path("data/pdf-vocab/naver_examples_final_qa_work.csv"))
    parser.add_argument("--report", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_finalization_report.json"))
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({field: row.get(field, "") for field in fields} for row in rows)


def main() -> None:
    args = parse_args()
    words = read_csv(args.words_csv)
    examples = read_csv(args.examples)
    word_ids = [row["id"] for row in words]
    pairs = [(row["surface"], row["reading_kana"]) for row in words]
    example_ids = [row["word_id"] for row in examples]
    levels = Counter(row["level"] for row in words)
    permissions = Counter(row["permission_status"] for row in examples)
    sources = Counter(row["source"] for row in examples)

    checks = {
        "word_count": len(words), "unique_word_ids": len(set(word_ids)),
        "unique_surface_reading_pairs": len(set(pairs)), "level_counts": dict(levels),
        "example_count": len(examples), "unique_example_word_ids": len(set(example_ids)),
        "missing_example_ids": sorted(set(word_ids) - set(example_ids)),
        "unknown_example_ids": sorted(set(example_ids) - set(word_ids)),
        "blank_examples": sum(not row["jp"].strip() or not row["ko"].strip() for row in examples),
        "permission_counts": dict(permissions), "source_counts": dict(sources),
        "noru_rows": [
            {key: row[key] for key in ("id", "level", "surface", "reading_kana", "meaning_ko")}
            for row in words if row["reading_kana"] == "のる"
        ],
    }
    failures = []
    if len(words) != 6638 or len(set(word_ids)) != 6638 or len(set(pairs)) != 6638:
        failures.append("word count/uniqueness")
    if any(levels[level] != target for level, target in LEVEL_TARGETS.items()):
        failures.append("level counts")
    if len(examples) != 6638 or len(set(example_ids)) != 6638:
        failures.append("example count/uniqueness")
    if checks["missing_example_ids"] or checks["unknown_example_ids"] or checks["blank_examples"]:
        failures.append("example coverage")
    if any(row["permission_status"] not in {"cleared", "self"} for row in examples):
        failures.append("example permission")
    if len(checks["noru_rows"]) != 1 or checks["noru_rows"][0]["surface"] != "乗る":
        failures.append("乗る canonicalization")
    if failures:
        raise RuntimeError(f"finalization validation failed: {failures}")

    for target in (args.final_csv, args.final_json, args.final_examples, args.final_naver):
        target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.words_csv, args.final_csv)
    shutil.copyfile(args.words_json, args.final_json)
    shutil.copyfile(args.examples, args.final_examples)
    naver_rows = sorted(
        (row for row in examples if row["source"] == "naver-ja-dict"),
        key=lambda row: row["word_id"],
    )
    write_csv(args.final_naver, naver_rows, EXAMPLE_FIELDS)
    expected_naver_rows = sources.get("naver-ja-dict", 0)
    if len(naver_rows) != expected_naver_rows:
        raise RuntimeError(
            f"NAVER split count mismatch: {len(naver_rows)} != {expected_naver_rows}"
        )

    report = {"status": "PASS", "checks": checks, "outputs": {
        "word_csv": str(args.final_csv), "word_json": str(args.final_json),
        "examples": str(args.final_examples), "naver_examples": str(args.final_naver),
    }}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
