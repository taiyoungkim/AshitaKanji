#!/usr/bin/env python3
"""Apply the JMdict recheck decisions to the release vocabulary.

The recheck compared every shipped headword with JMdict and found one wrong
spelling (平だ) plus two headwords written with kanji forms JMdict marks as
rarely used.  This pass rewrites those word rows, replaces their dictionary
examples with original sentences, and records a manifest.  Audio must be
regenerated for the touched IDs afterwards.
"""

from __future__ import annotations

import argparse
import csv
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from wordfreq import zipf_frequency

WORD_FIELDS = (
    "id", "level", "surface", "reading_kana", "furigana", "meaning_ko",
    "part_of_speech", "card_type", "example_jp", "example_ko",
    "example_jp_id", "example_jp_author", "example_ko_id", "example_ko_author",
    "example_license", "alt_forms", "disambig", "source", "qa_status",
    "deprecated", "tags", "data_version", "frequency", "reading_chapter",
    "deprecated_reason", "superseded_by",
)
EXAMPLE_FIELDS = (
    "word_id", "jp", "ko", "source", "source_url", "license",
    "permission_status", "attribution", "captured_at", "qa_status",
    "sort_order", "naver_example_id", "naver_source_cid", "naver_source_name",
    "query", "qa_note",
)
SELF_ATTRIBUTION = "AshitaKanji 편집 예문"
QA_NOTE = "JMdict 대조 재검수 교정; 자체 작성·번역; NAVER 일본어사전에서 표제어 용법 확인"
RECHECK_TAG = "dict-recheck"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    base = Path("data/pdf-vocab")
    parser.add_argument("--decisions", type=Path, default=base / "jlpt_dictionary_recheck_decisions.json")
    parser.add_argument("--words-csv", type=Path, default=base / "jlpt_final_wordlist.csv")
    parser.add_argument("--words-json", type=Path, default=base / "jlpt_final_wordlist.json")
    parser.add_argument("--naver-examples", type=Path, default=base / "naver_examples_final_qa_work.csv")
    parser.add_argument("--examples", type=Path, default=base / "examples_final_qa_work.csv")
    parser.add_argument("--manifest-out", type=Path, default=base / "jlpt_dictionary_recheck_manifest.json")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(
            {field: "" if row.get(field) is None else row.get(field) for field in fields}
            for row in rows
        )


def parse_tags(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    parsed = json.loads(text)
    return [str(item) for item in parsed]


def main() -> None:
    args = parse_args()
    decisions = json.loads(args.decisions.read_text(encoding="utf-8"))["decisions"]
    by_id = {item["id"]: item for item in decisions}

    words_csv = read_csv(args.words_csv)
    words_doc = json.loads(args.words_json.read_text(encoding="utf-8"))
    naver_rows = read_csv(args.naver_examples)
    example_rows = read_csv(args.examples)

    missing = sorted(by_id.keys() - {row["id"] for row in words_csv})
    if missing:
        raise SystemExit(f"decision targets missing from word list: {missing}")

    captured_at = str(int(time.time() * 1000))
    changes: list[dict[str, Any]] = []

    def apply_word(row: dict[str, Any]) -> None:
        decision = by_id[row["id"]]
        word = decision["word"]
        example = decision["example"]
        before = {key: row.get(key) for key in
                  ("surface", "reading_kana", "furigana", "meaning_ko",
                   "part_of_speech", "example_jp", "example_ko", "frequency")}
        row.update(word)
        row["example_jp"] = example["jp"]
        row["example_ko"] = example["ko"]
        row["example_jp_author"] = SELF_ATTRIBUTION
        row["example_license"] = "self"
        row["frequency"] = round(zipf_frequency(word["surface"], "ja"), 2)
        tags = parse_tags(row.get("tags"))
        if RECHECK_TAG not in tags:
            tags.append(RECHECK_TAG)
        row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))
        changes.append({
            "id": row["id"],
            "level": row["level"],
            "reason": decision["reason"],
            "evidence": decision["evidence"],
            "before": before,
            "after": {key: row.get(key) for key in before},
        })

    for row in words_csv:
        if row["id"] in by_id:
            apply_word(row)
    for row in words_doc["vocabulary"]:
        if row["id"] in by_id:
            decision = by_id[row["id"]]
            row.update(decision["word"])
            row["example_jp"] = decision["example"]["jp"]
            row["example_ko"] = decision["example"]["ko"]
            row["example_jp_author"] = SELF_ATTRIBUTION
            row["example_license"] = "self"
            row["frequency"] = round(zipf_frequency(decision["word"]["surface"], "ja"), 2)
            tags = parse_tags(row.get("tags"))
            if RECHECK_TAG not in tags:
                tags.append(RECHECK_TAG)
            row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))
    words_doc["generated_at"] = datetime.now(timezone.utc).isoformat()

    dropped_naver = [row for row in naver_rows if row["word_id"] in by_id]
    naver_rows = [row for row in naver_rows if row["word_id"] not in by_id]

    kept_examples = []
    for row in example_rows:
        if row["word_id"] not in by_id:
            kept_examples.append(row)
            continue
        decision = by_id[row["word_id"]]
        example = decision["example"]
        kept_examples.append({
            "word_id": row["word_id"],
            "jp": example["jp"],
            "ko": example["ko"],
            "source": "self",
            "source_url": "https://ja.dict.naver.com/#/search?query=" + quote(example["query"]),
            "license": "self",
            "permission_status": "self",
            "attribution": SELF_ATTRIBUTION,
            "captured_at": captured_at,
            "qa_status": "auto",
            "sort_order": "0",
            "naver_example_id": "",
            "naver_source_cid": "",
            "naver_source_name": "",
            "query": example["query"],
            "qa_note": QA_NOTE,
        })
    kept_examples.sort(key=lambda row: row["word_id"])

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pass": "jmdict-recheck",
        "word_count": len(words_csv),
        "changed": changes,
        "examples_moved_to_self": [row["word_id"] for row in dropped_naver],
        "audio_regeneration_required": {
            "words": [item["id"] for item in decisions
                      if by_id[item["id"]]["word"]["reading_kana"] != ""],
            "examples": [item["id"] for item in decisions],
        },
    }

    if args.dry_run:
        print(json.dumps(manifest, ensure_ascii=False, indent=1))
        return

    write_csv(args.words_csv, words_csv, WORD_FIELDS)
    args.words_json.write_text(
        json.dumps(words_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(args.naver_examples, naver_rows, EXAMPLE_FIELDS)
    write_csv(args.examples, kept_examples, EXAMPLE_FIELDS)
    args.manifest_out.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "changed": len(changes),
        "naver_examples_dropped": len(dropped_naver),
        "words": len(words_csv),
        "examples": len(kept_examples),
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
