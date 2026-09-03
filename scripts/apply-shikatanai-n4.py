#!/usr/bin/env python3
"""Move inflected 仕方なく (N1) to the NAVER N4 lemma 仕方ない."""

from __future__ import annotations

import csv
import hashlib
import json
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: i for i, level in enumerate(LEVELS)}
TAG = "shikatanai-n4-2026-09-01"
OLD_ID = "w_00b6d9661826f4ca"  # 仕方なく
NEW_ID = "w_3e5c61e8a0dce5c9"  # 仕方ない / しかたない
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


def stable_word_id(surface: str, reading: str) -> str:
    basis = f"{unicodedata.normalize('NFKC', surface)}\u0001{unicodedata.normalize('NFKC', reading)}"
    return f"w_{hashlib.sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def parse_tags(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    return [str(item) for item in json.loads(text)]


def add_tag(row: dict[str, Any], tag: str) -> None:
    tags = parse_tags(row.get("tags"))
    if tag not in tags:
        tags.append(tag)
    row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))


def refresh_sort(words: list[dict[str, str]]) -> None:
    for row in words:
        freq = zipf_frequency(row["surface"], "ja") or zipf_frequency(row["reading_kana"], "ja")
        row["frequency"] = f"{freq:.3f}"
    for level in LEVELS:
        level_rows = sorted(
            (row for row in words if row["level"] == level),
            key=lambda row: (-float(row["frequency"]), row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = str(index // 50 + 1)
    words.sort(key=lambda row: (
        LEVEL_RANK[row["level"]], int(row["reading_chapter"] or 1),
        -float(row["frequency"] or 0), row["surface"], row["id"],
    ))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def self_example(word_id: str, surface: str, jp: str, ko: str, captured_at: str, note: str) -> dict[str, str]:
    return {
        "word_id": word_id,
        "jp": jp,
        "ko": ko,
        "source": "self",
        "source_url": "https://ja.dict.naver.com/#/search?query=" + quote(surface),
        "license": "self",
        "permission_status": "self",
        "attribution": "AshitaKanji 편집 예문",
        "captured_at": captured_at,
        "qa_status": "verified",
        "sort_order": "0",
        "naver_example_id": "",
        "naver_source_cid": "",
        "naver_source_name": "",
        "query": surface,
        "qa_note": note,
    }


def main() -> None:
    if stable_word_id("仕方ない", "しかたない") != NEW_ID:
        raise RuntimeError("unexpected 仕方ない id")

    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    by_id = {row["id"]: row for row in words}
    old = by_id.get(OLD_ID)
    if not old:
        raise RuntimeError(f"missing {OLD_ID}")
    if NEW_ID in by_id:
        raise RuntimeError("target id already present")
    if any(row["surface"] == "仕方ない" for row in words):
        raise RuntimeError("仕方ない already exists")

    old["id"] = NEW_ID
    old["level"] = "N4"
    old["surface"] = "仕方ない"
    old["reading_kana"] = "しかたない"
    old["furigana"] = "しかたない"
    old["meaning_ko"] = "어쩔 수 없다"
    old["part_of_speech"] = "adjective"
    old["card_type"] = "B"
    old["alt_forms"] = json.dumps(
        ["仕方なく", "しかたなく", "仕方無い"],
        ensure_ascii=False, separators=(",", ":"),
    )
    old["disambig"] = ""
    add_tag(old, TAG)
    add_tag(old, "naver-level-corrected")
    del by_id[OLD_ID]
    by_id[NEW_ID] = old

    captured_at = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    example = self_example(
        NEW_ID, "仕方ない",
        "今さら後悔しても仕方ない。",
        "이제 와서 후회해도 어쩔 수 없다.",
        captured_at,
        "N4 仕方ない 표제어; 仕方なく는 활용형",
    )
    old["example_jp"] = example["jp"]
    old["example_ko"] = example["ko"]
    old["example_jp_id"] = ""
    old["example_jp_author"] = example["attribution"]
    old["example_ko_id"] = ""
    old["example_ko_author"] = ""
    old["example_license"] = example["license"]

    refresh_sort(words)
    ids = [row["id"] for row in words]
    if len(ids) != len(set(ids)):
        raise RuntimeError("duplicate ids")

    naver = [row for row in read_csv(DATA / "naver_examples_final_qa_work.csv") if row["word_id"] != OLD_ID]
    self_rows = [row for row in read_csv(DATA / "self_authored_examples_qa_work.csv") if row["word_id"] != OLD_ID]
    self_rows.append(example)
    self_rows.sort(key=lambda row: row["word_id"])
    examples = [*naver, *self_rows]
    examples.sort(key=lambda row: row["word_id"])
    if {row["word_id"] for row in examples} != {row["id"] for row in words}:
        missing = {row["id"] for row in words} - {row["word_id"] for row in examples}
        raise RuntimeError(f"example mismatch {sorted(missing)[:8]}")

    write_csv(DATA / "jlpt_final_wordlist.csv", words, WORD_FIELDS)
    (DATA / "jlpt_final_wordlist.json").write_text(
        json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(words),
            "source": str(DATA / "jlpt_final_wordlist.csv"),
            "vocabulary": words,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_csv(DATA / "naver_examples_final_qa_work.csv", naver, EXAMPLE_FIELDS)
    write_csv(DATA / "self_authored_examples_qa_work.csv", self_rows, EXAMPLE_FIELDS)
    write_csv(DATA / "examples_final_qa_work.csv", examples, EXAMPLE_FIELDS)

    counts = Counter(row["level"] for row in words)
    manifest = {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "word_count": len(words),
        "level_counts": dict(counts),
        "successors": {OLD_ID: NEW_ID},
        "rewritten": [{
            "old_id": OLD_ID,
            "new_id": NEW_ID,
            "from": "仕方なく",
            "to": "仕方ない",
            "before_level": "N1",
            "after_level": "N4",
            "meaning_ko": "어쩔 수 없다",
        }],
        "policy": (
            "NAVER JLPT badge is on 仕方ない N4. 仕方なく is the adverbial form "
            "and has no separate badge. 仕方がない stays N2."
        ),
    }
    (DATA / "jlpt_shikatanai_n4_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "word_count": len(words),
        "level_counts": dict(counts),
        "successors": manifest["successors"],
        "rewritten": manifest["rewritten"],
        "naver_examples": len(naver),
        "self_examples": len(self_rows),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
