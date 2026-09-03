#!/usr/bin/env python3
"""Split N5 まだ from literary N1 いまだ.

The app had only 未だ/いまだ as N1, with a まだ-sense example. Everyday まだ
(N5 in NAVER) was missing, so N1 study showed 아직 as いまだ.
"""

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
TAG = "mada-imada-split-2026-09-01"
OLD_ID = "w_010ee73feb13c7cc"  # 未だ / いまだ
NEW_IMADA_ID = "w_1c28467b52572134"  # いまだ / いまだ
NEW_MADA_ID = "w_858471f4df92a8af"  # まだ / まだ
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


def apply_example(word: dict[str, str], example: dict[str, str]) -> None:
    word["example_jp"] = example["jp"]
    word["example_ko"] = example["ko"]
    word["example_jp_id"] = ""
    word["example_jp_author"] = example["attribution"]
    word["example_ko_id"] = ""
    word["example_ko_author"] = ""
    word["example_license"] = example["license"]


def main() -> None:
    if stable_word_id("いまだ", "いまだ") != NEW_IMADA_ID:
        raise RuntimeError("unexpected いまだ id")
    if stable_word_id("まだ", "まだ") != NEW_MADA_ID:
        raise RuntimeError("unexpected まだ id")

    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    by_id = {row["id"]: row for row in words}
    old = by_id.get(OLD_ID)
    if not old:
        raise RuntimeError(f"missing {OLD_ID}")
    if NEW_MADA_ID in by_id or NEW_IMADA_ID in by_id:
        raise RuntimeError("target ids already present")

    old["surface"] = "いまだ"
    old["reading_kana"] = "いまだ"
    old["furigana"] = "いまだ"
    old["meaning_ko"] = "아직 (예스러운 말)"
    old["part_of_speech"] = "adverb"
    old["card_type"] = "C"
    old["alt_forms"] = json.dumps(["未だ"], ensure_ascii=False, separators=(",", ":"))
    old["disambig"] = "일상 아직=まだ"
    old["id"] = NEW_IMADA_ID
    add_tag(old, TAG)
    del by_id[OLD_ID]
    by_id[NEW_IMADA_ID] = old

    mada = {
        "id": NEW_MADA_ID,
        "level": "N5",
        "surface": "まだ",
        "reading_kana": "まだ",
        "furigana": "まだ",
        "meaning_ko": "아직",
        "part_of_speech": "adverb",
        "card_type": "C",
        "example_jp": "",
        "example_ko": "",
        "example_jp_id": "",
        "example_jp_author": "",
        "example_ko_id": "",
        "example_ko_author": "",
        "example_license": "",
        "alt_forms": json.dumps(["未だ"], ensure_ascii=False, separators=(",", ":")),
        "disambig": "",
        "source": "naver:ja-dict-jlpt-list",
        "qa_status": "verified",
        "deprecated": "0",
        "tags": json.dumps([TAG, "naver-level-backfill"], ensure_ascii=False, separators=(",", ":")),
        "data_version": "3",
        "frequency": "0",
        "reading_chapter": "1",
        "deprecated_reason": "",
        "superseded_by": "",
    }
    words.append(mada)
    by_id[NEW_MADA_ID] = mada

    captured_at = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    imada_ex = self_example(
        NEW_IMADA_ID, "いまだ",
        "原因はいまだ解明されていない。",
        "원인은 아직 밝혀지지 않았다.",
        captured_at,
        "N1 いまだ 문어 용법; 부정문과 함께 쓰는 예",
    )
    mada_ex = self_example(
        NEW_MADA_ID, "まだ",
        "宿題はまだ終わっていない。",
        "숙제는 아직 끝나지 않았다.",
        captured_at,
        "N5 まだ 일상 용법",
    )
    apply_example(old, imada_ex)
    apply_example(mada, mada_ex)

    refresh_sort(words)
    ids = [row["id"] for row in words]
    if len(ids) != len(set(ids)):
        raise RuntimeError("duplicate ids")

    naver = [row for row in read_csv(DATA / "naver_examples_final_qa_work.csv") if row["word_id"] != OLD_ID]
    self_rows = [row for row in read_csv(DATA / "self_authored_examples_qa_work.csv") if row["word_id"] != OLD_ID]
    self_rows.extend([imada_ex, mada_ex])
    self_rows.sort(key=lambda row: row["word_id"])
    examples = [*naver, *self_rows]
    examples.sort(key=lambda row: row["word_id"])
    if {row["word_id"] for row in examples} != {row["id"] for row in words}:
        missing = {row["id"] for row in words} - {row["word_id"] for row in examples}
        extra = {row["word_id"] for row in examples} - {row["id"] for row in words}
        raise RuntimeError(f"example mismatch missing={sorted(missing)[:8]} extra={sorted(extra)[:8]}")

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
        "successors": {OLD_ID: NEW_IMADA_ID},
        "added": [{
            "id": NEW_MADA_ID,
            "level": "N5",
            "surface": "まだ",
            "reading_kana": "まだ",
            "meaning_ko": "아직",
        }],
        "rewritten": [{
            "old_id": OLD_ID,
            "new_id": NEW_IMADA_ID,
            "from": "未だ",
            "to": "いまだ",
            "level": "N1",
            "meaning_ko": "아직 (예스러운 말)",
        }],
        "policy": (
            "NAVER N5 未だ/まだ is the everyday word; write it まだ. "
            "NAVER N1 未だ/いまだ is literary (=まだ) and is shown as いまだ."
        ),
    }
    (DATA / "jlpt_mada_imada_split_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "word_count": len(words),
        "level_counts": dict(counts),
        "successors": manifest["successors"],
        "added": manifest["added"],
        "rewritten": manifest["rewritten"],
        "naver_examples": len(naver),
        "self_examples": len(self_rows),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
