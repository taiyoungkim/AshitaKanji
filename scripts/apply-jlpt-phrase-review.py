#!/usr/bin/env python3
"""Apply the reviewed phrase-headword policy to the release vocabulary.

The pass removes explanatory paraphrases and compositional collocations from
the word-card surface, merges inflected/polite forms into dictionary forms,
and restores the fixed per-level counts with explicitly reviewed vocabulary.
It writes intermediate files; release paths are promoted only after the
normal validators pass.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from wordfreq import zipf_frequency


LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: index for index, level in enumerate(LEVELS)}
TARGET_COUNTS = {"N5": 339, "N4": 600, "N3": 1499, "N2": 1700, "N1": 2500}
KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--words", type=Path, default=Path("data/pdf-vocab/jlpt_headword_review_wordlist_final.csv"))
    parser.add_argument("--examples", type=Path, default=Path("data/pdf-vocab/examples_headword_review_qa_work.csv"))
    parser.add_argument("--decisions", type=Path, default=Path("data/pdf-vocab/jlpt_phrase_review_decisions.json"))
    parser.add_argument("--candidates", type=Path, default=Path("data/track-a/jlpt_qa_work.csv"))
    parser.add_argument("--candidate-examples", type=Path, default=Path("data/track-a/naver_examples_qa_work.csv"))
    parser.add_argument("--csv-out", type=Path, default=Path("data/pdf-vocab/jlpt_phrase_review_wordlist.csv"))
    parser.add_argument("--json-out", type=Path, default=Path("data/pdf-vocab/jlpt_phrase_review_wordlist.json"))
    parser.add_argument("--examples-out", type=Path, default=Path("data/pdf-vocab/examples_phrase_review_qa_work.csv"))
    parser.add_argument("--manifest-out", type=Path, default=Path("data/pdf-vocab/jlpt_phrase_review_manifest.json"))
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(
            {field: "" if row.get(field) is None else row.get(field) for field in fields}
            for row in rows
        )


def parse_array(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return list(dict.fromkeys(str(item).strip() for item in parsed if str(item).strip()))
    except json.JSONDecodeError:
        pass
    return list(dict.fromkeys(part.strip() for part in text.split(";") if part.strip()))


def with_values(value: Any, *items: str) -> str:
    values = parse_array(value)
    for item in items:
        if item and item not in values:
            values.append(item)
    return json.dumps(values, ensure_ascii=False, separators=(",", ":"))


def combine_values(*values: Any) -> str:
    result: list[str] = []
    for value in values:
        for part in str(value or "").split(";"):
            part = part.strip()
            if part and part not in result:
                result.append(part)
    return ";".join(result)


def infer_card_type(surface: str) -> str:
    if all("ぁ" <= char <= "ゟ" or char == "ー" for char in surface):
        return "C"
    if all("゠" <= char <= "ヿ" or char == "ー" for char in surface):
        return "D"
    has_kanji = bool(KANJI_RE.search(surface))
    has_hiragana = any("ぁ" <= char <= "ゟ" for char in surface)
    if has_kanji and has_hiragana:
        return "B"
    return "A" if has_kanji else "E"


def frequency(row: dict[str, Any]) -> float:
    value = zipf_frequency(str(row["surface"]), "ja")
    if value == 0.0:
        value = zipf_frequency(str(row["reading_kana"]), "ja")
    return round(float(value), 3)


def one_by_surface(rows: dict[str, dict[str, Any]], surface: str) -> dict[str, Any]:
    matches = [row for row in rows.values() if row["surface"] == surface]
    if len(matches) != 1:
        raise RuntimeError(f"expected one active row for {surface!r}, found {len(matches)}")
    return matches[0]


def self_example(word_id: str, surface: str, jp: str, ko: str, captured_at: str) -> dict[str, str]:
    return {
        "word_id": word_id,
        "jp": jp,
        "ko": ko,
        "source": "self",
        "source_url": f"https://ja.dict.naver.com/#/search?query={quote(surface)}",
        "license": "self",
        "permission_status": "self",
        "attribution": "AshitaKanji 편집 예문",
        "captured_at": captured_at,
        "qa_status": "auto",
        "sort_order": "0",
        "naver_example_id": "",
        "naver_source_cid": "",
        "naver_source_name": "",
        "query": surface,
        "qa_note": "자체 작성·번역; 표제어 기본형 포함 및 문법·의미 수동 검수",
    }


def main() -> None:
    args = parse_args()
    original_rows = read_csv(args.words)
    current_examples = {row["word_id"]: row for row in read_csv(args.examples)}
    candidate_rows = read_csv(args.candidates)
    candidate_examples = {
        row["word_id"]: row for row in read_csv(args.candidate_examples)
        if row.get("jp", "").strip() and row.get("permission_status") == "cleared"
    }
    decisions = json.loads(args.decisions.read_text(encoding="utf-8"))
    active = {row["id"]: dict(row) for row in original_rows}
    if len(active) != 6638:
        raise RuntimeError("phrase review requires the 6,638-row release list")

    normalized: list[dict[str, Any]] = []
    aliases: list[dict[str, Any]] = []
    source_to_target: dict[str, str] = {}
    for item in decisions["normalizations"]:
        source = one_by_surface(active, item["surface"])
        target = next(
            (
                row for row in active.values()
                if row["id"] != source["id"]
                and row["surface"] == item["target_surface"]
                and row["reading_kana"] == item["target_reading"]
            ),
            None,
        )
        if target:
            target["source"] = combine_values(target.get("source"), source.get("source"))
            target["tags"] = with_values(target.get("tags"), "phrase-form-merged")
            if item.get("target_level"):
                target["level"] = item["target_level"]
            del active[source["id"]]
            source_to_target[source["id"]] = target["id"]
            aliases.append({
                "removed_id": source["id"], "retained_id": target["id"],
                "source_surface": source["surface"], "target_surface": target["surface"],
                "target_reading": target["reading_kana"], "kind": "inflection-merge",
            })
        else:
            old_surface = source["surface"]
            old_reading = source["reading_kana"]
            source["surface"] = item["target_surface"]
            source["reading_kana"] = item["target_reading"]
            source["furigana"] = item["target_reading"]
            source["meaning_ko"] = item["meaning_ko"]
            source["part_of_speech"] = item["part_of_speech"]
            source["card_type"] = infer_card_type(source["surface"])
            source["tags"] = with_values(source.get("tags"), "phrase-form-normalized")
            source["alt_forms"] = with_values(source.get("alt_forms"), old_surface)
            if item.get("target_level"):
                source["level"] = item["target_level"]
            source_to_target[source["id"]] = source["id"]
            normalized.append({
                "id": source["id"], "old_surface": old_surface,
                "old_reading": old_reading, "surface": source["surface"],
                "reading_kana": source["reading_kana"],
            })

    removed: list[dict[str, Any]] = []
    promotions: list[dict[str, str]] = []
    for item in decisions["removals"]:
        source = one_by_surface(active, item["surface"])
        target = one_by_surface(active, item["target_surface"])
        if source["id"] == target["id"]:
            raise RuntimeError(f"phrase removal targets itself: {source['surface']}")
        target["source"] = combine_values(target.get("source"), source.get("source"))
        target["tags"] = with_values(target.get("tags"), f"phrase-{item['kind']}-source")
        del active[source["id"]]
        source_to_target[source["id"]] = target["id"]
        removed.append({
            "removed_id": source["id"], "surface": source["surface"],
            "level": source["level"], "target_id": target["id"],
            "target_surface": target["surface"], "kind": item["kind"],
        })
        if item.get("promote_example"):
            source_example = current_examples.get(source["id"])
            if not source_example:
                raise RuntimeError(f"collocation has no example to promote: {source['surface']}")
            promoted = dict(source_example)
            promoted["word_id"] = target["id"]
            promoted["qa_note"] = combine_values(
                promoted.get("qa_note"), f"구문 카드 {source['surface']}에서 이관",
            )
            current_examples[target["id"]] = promoted
            promotions.append({
                "from_id": source["id"], "to_id": target["id"],
                "phrase": source["surface"],
            })

    deficits = {
        level: TARGET_COUNTS[level] - sum(row["level"] == level for row in active.values())
        for level in LEVELS
    }
    requested_counts = Counter(item["level"] for item in decisions["backfills"])
    if any(requested_counts[level] != deficits[level] for level in LEVELS):
        raise RuntimeError(f"backfill plan {dict(requested_counts)} does not match deficits {deficits}")

    pool_by_level_surface: dict[tuple[str, str], list[dict[str, str]]] = {}
    for row in candidate_rows:
        pool_by_level_surface.setdefault((row["level"], row["surface"]), []).append(row)
    retained_pairs = {(row["surface"], row["reading_kana"]) for row in active.values()}
    backfills: list[dict[str, Any]] = []
    backfill_examples: dict[str, dict[str, str]] = {}
    captured_at = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    for item in decisions["backfills"]:
        matches = pool_by_level_surface.get((item["level"], item["surface"]), [])
        if len(matches) != 1:
            raise RuntimeError(f"expected one backfill candidate for {item['level']} {item['surface']}, found {len(matches)}")
        source = matches[0]
        if source["id"] in active or source.get("deprecated") != "0" or source.get("qa_status") != "verified":
            raise RuntimeError(f"invalid backfill candidate: {source['id']} {source['surface']}")
        pair = (source["surface"], source["reading_kana"])
        if pair in retained_pairs:
            raise RuntimeError(f"backfill duplicates retained pair: {pair}")
        row = {field: source.get(field, "") for field in WORD_FIELDS}
        row.update({
            "level": item["level"],
            "meaning_ko": item.get("meaning_ko", source["meaning_ko"]),
            "part_of_speech": item.get("part_of_speech", source["part_of_speech"]),
            "card_type": infer_card_type(source["surface"]),
            "source": combine_values(source.get("source"), "phrase-review-backfill"),
            "qa_status": "verified", "deprecated": "0", "data_version": "2",
            "deprecated_reason": "", "superseded_by": "",
            "tags": with_values(source.get("tags"), "phrase-review-backfill"),
        })
        explicit_jp = item.get("example_jp", "").strip()
        explicit_ko = item.get("example_ko", "").strip()
        if explicit_jp or explicit_ko:
            if not explicit_jp or not explicit_ko:
                raise RuntimeError(f"incomplete authored example for {source['surface']}")
            example = self_example(source["id"], source["surface"], explicit_jp, explicit_ko, captured_at)
        else:
            example = candidate_examples.get(source["id"])
            if not example:
                raise RuntimeError(f"backfill lacks a cleared or authored example: {source['surface']}")
            example = dict(example)
        backfill_examples[source["id"]] = example
        active[source["id"]] = row
        retained_pairs.add(pair)
        backfills.append(row)

    final_rows = list(active.values())
    for row in final_rows:
        row["frequency"] = frequency(row)
    for level in LEVELS:
        level_rows = sorted(
            (row for row in final_rows if row["level"] == level),
            key=lambda row: (-float(row["frequency"]), row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = index // 50 + 1
    final_rows.sort(key=lambda row: (
        LEVEL_RANK[row["level"]], int(row["reading_chapter"]),
        -float(row["frequency"]), row["surface"], row["id"],
    ))

    final_ids = {row["id"] for row in final_rows}
    example_by_id = {
        word_id: dict(example) for word_id, example in current_examples.items()
        if word_id in final_ids
    }
    example_by_id.update(backfill_examples)
    missing_examples = sorted(final_ids - set(example_by_id))
    if missing_examples:
        raise RuntimeError(f"missing final examples: {missing_examples[:10]}")

    for row in final_rows:
        example = example_by_id[row["id"]]
        row.update({
            "example_jp": example["jp"], "example_ko": example["ko"],
            "example_jp_id": "", "example_ko_id": "",
            "example_jp_author": example.get("attribution", ""),
            "example_ko_author": "", "example_license": example.get("license", ""),
        })

    final_examples = sorted(example_by_id.values(), key=lambda row: row["word_id"])
    ids = [row["id"] for row in final_rows]
    pairs = [(row["surface"], row["reading_kana"]) for row in final_rows]
    levels = Counter(row["level"] for row in final_rows)
    if len(final_rows) != 6638 or len(set(ids)) != 6638 or len(set(pairs)) != 6638:
        raise RuntimeError("final word count or uniqueness failed")
    if any(levels[level] != TARGET_COUNTS[level] for level in LEVELS):
        raise RuntimeError(f"level count validation failed: {dict(levels)}")
    if len(final_examples) != 6638 or len({row["word_id"] for row in final_examples}) != 6638:
        raise RuntimeError("final example count or uniqueness failed")
    banned_surfaces = {item["surface"] for item in decisions["removals"]}
    banned_surfaces.update(item["surface"] for item in decisions["normalizations"])
    remaining_banned = sorted(banned_surfaces & {row["surface"] for row in final_rows})
    if remaining_banned:
        raise RuntimeError(f"reviewed phrase surfaces remain active: {remaining_banned}")

    generated_at = datetime.now(timezone.utc).isoformat()
    document = {
        "generated_at": generated_at,
        "count": len(final_rows),
        "source": str(args.words),
        "vocabulary": [{field: row.get(field) for field in WORD_FIELDS} for row in final_rows],
    }
    manifest = {
        "generated_at": generated_at,
        "policy": decisions["policy"],
        "summary": {
            "input_count": len(original_rows),
            "normalizations_in_place": len(normalized),
            "inflection_merges": len(aliases),
            "phrase_removals": len(removed),
            "collocation_example_promotions": len(promotions),
            "backfills": len(backfills),
            "backfill_counts": dict(Counter(row["level"] for row in backfills)),
            "final_count": len(final_rows),
            "level_counts": dict(levels),
            "unique_pairs": len(set(pairs)),
            "example_count": len(final_examples),
        },
        "normalized": normalized,
        "merged_inflections": aliases,
        "removed_phrases": removed,
        "promoted_collocation_examples": promotions,
        "backfills": [
            {key: row[key] for key in ("id", "level", "surface", "reading_kana", "meaning_ko", "part_of_speech")}
            for row in backfills
        ],
        "source_phrase_mapping": source_to_target,
    }

    write_csv(args.csv_out, final_rows, WORD_FIELDS)
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(args.examples_out, final_examples, EXAMPLE_FIELDS)
    args.manifest_out.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
