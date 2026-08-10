#!/usr/bin/env python3
"""Apply the reviewed full-headword decisions to an intermediate word list.

This keeps the release paths untouched.  True spelling duplicates are merged,
their source provenance is retained on the winner, and explicitly reviewed
same-level backfills restore the original per-level counts.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from wordfreq import zipf_frequency


LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: index for index, level in enumerate(LEVELS)}
TARGET_COUNTS = {"N5": 339, "N4": 600, "N3": 1499, "N2": 1700, "N1": 2500}
KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
FIELDS = (
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
    parser.add_argument(
        "--words", type=Path,
        default=Path("data/pdf-vocab/jlpt_final_wordlist.csv"),
    )
    parser.add_argument(
        "--review", type=Path,
        default=Path("data/pdf-vocab/jlpt_all_headword_reviewed.json"),
    )
    parser.add_argument(
        "--decisions", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_decisions.json"),
    )
    parser.add_argument(
        "--candidates", type=Path, default=Path("data/track-a/jlpt_qa_work.csv")
    )
    parser.add_argument(
        "--examples", type=Path,
        default=Path("data/pdf-vocab/examples_final_qa_work.csv"),
    )
    parser.add_argument(
        "--candidate-examples", type=Path,
        default=Path("data/track-a/naver_examples_qa_work.csv"),
    )
    parser.add_argument("--jmdict", type=Path, default=Path(".cache/JMdict_e.gz"))
    parser.add_argument(
        "--csv-out", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_wordlist.csv"),
    )
    parser.add_argument(
        "--json-out", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_wordlist.json"),
    )
    parser.add_argument(
        "--examples-out", type=Path,
        default=Path("data/pdf-vocab/examples_headword_review_seed.csv"),
    )
    parser.add_argument(
        "--manifest-out", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_manifest.json"),
    )
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {field: "" if row.get(field) is None else row.get(field) for field in fields}
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


def combine_values(*values: str) -> str:
    parts: list[str] = []
    for value in values:
        for part in str(value or "").split(";"):
            part = part.strip()
            if part and part not in parts:
                parts.append(part)
    return ";".join(parts)


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


def load_pair_sequences(
    path: Path, pairs: set[tuple[str, str]]
) -> dict[tuple[str, str], set[str]]:
    readings = {reading for _, reading in pairs}
    result: dict[tuple[str, str], set[str]] = defaultdict(set)
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            reading_nodes = entry.findall("r_ele")
            if not any((node.findtext("reb") or "") in readings for node in reading_nodes):
                entry.clear()
                continue
            sequence = entry.findtext("ent_seq") or ""
            forms = [node.findtext("keb") or "" for node in entry.findall("k_ele")]
            for node in reading_nodes:
                reading = node.findtext("reb") or ""
                restrictions = {item.text or "" for item in node.findall("re_restr")}
                for surface in forms:
                    pair = (surface, reading)
                    if pair in pairs and (not restrictions or surface in restrictions):
                        result[pair].add(sequence)
            entry.clear()
    return result


def main() -> None:
    args = parse_args()
    original_rows = read_csv(args.words)
    original_by_id = {row["id"]: row for row in original_rows}
    review_doc = json.loads(args.review.read_text(encoding="utf-8"))
    reviewed = {row["id"]: row for row in review_doc["rows"]}
    decision_doc = json.loads(args.decisions.read_text(encoding="utf-8"))
    candidates = {row["id"]: row for row in read_csv(args.candidates)}
    merge_map = decision_doc["merges"]

    if len(original_rows) != 6638 or set(original_by_id) != set(reviewed):
        raise RuntimeError("word list and reviewed audit IDs do not match")

    retained_by_id: dict[str, dict[str, Any]] = {}
    changed_ids: list[str] = []
    meaning_changed_ids: list[str] = []
    for original in original_rows:
        decision = reviewed[original["id"]]
        if decision["review_decision"] == "merge":
            continue
        row: dict[str, Any] = dict(original)
        old_surface = row["surface"]
        old_reading = row["reading_kana"]
        row["surface"] = decision["review_surface"]
        row["reading_kana"] = decision["review_reading_kana"]
        row["furigana"] = decision["review_reading_kana"]
        row["meaning_ko"] = decision["review_meaning_ko"]
        if (row["surface"], row["reading_kana"]) != (old_surface, old_reading):
            row["alt_forms"] = with_values(row.get("alt_forms"), old_surface)
            row["tags"] = with_values(row.get("tags"), "headword-full-audit-normalized")
            row["card_type"] = infer_card_type(row["surface"])
            changed_ids.append(row["id"])
        if row["meaning_ko"] != original["meaning_ko"]:
            row["tags"] = with_values(row.get("tags"), "meaning-disambiguated")
            meaning_changed_ids.append(row["id"])
        retained_by_id[row["id"]] = row

    aliases: list[dict[str, str]] = []
    for loser_id, merge in merge_map.items():
        loser = original_by_id[loser_id]
        winner = retained_by_id[merge["winner_id"]]
        winner["source"] = combine_values(winner.get("source", ""), loser.get("source", ""))
        winner["alt_forms"] = with_values(
            winner.get("alt_forms"), loser["surface"], merge["canonical_surface"]
        )
        winner["tags"] = with_values(winner.get("tags"), "headword-full-audit-merged")
        aliases.append(
            {
                "removed_id": loser_id,
                "retained_id": winner["id"],
                "removed_level": loser["level"],
                "retained_level": winner["level"],
                "removed_surface": loser["surface"],
                "canonical_surface": winner["surface"],
                "reading_kana": winner["reading_kana"],
                "reason": merge["reason"],
            }
        )

    retained = list(retained_by_id.values())
    deficits = {
        level: TARGET_COUNTS[level] - sum(row["level"] == level for row in retained)
        for level in LEVELS
    }
    requested_backfills = decision_doc["backfills"]
    requested_counts = Counter(item["assigned_level"] for item in requested_backfills)
    if any(requested_counts[level] != deficits[level] for level in LEVELS):
        raise RuntimeError(f"backfill plan {dict(requested_counts)} does not match {deficits}")

    backfills: list[dict[str, Any]] = []
    for item in requested_backfills:
        word_id = item["id"]
        if word_id in original_by_id:
            raise RuntimeError(f"backfill already exists in release list: {word_id}")
        source = candidates.get(word_id)
        if not source or source.get("deprecated") != "0" or source.get("qa_status") != "verified":
            raise RuntimeError(f"backfill candidate is not verified and active: {word_id}")
        row = {field: source.get(field, "") for field in FIELDS}
        row.update(
            {
                "level": item["assigned_level"],
                "card_type": infer_card_type(row["surface"]),
                "source": combine_values(row.get("source", ""), "headword-audit-backfill"),
                "qa_status": "verified",
                "deprecated": "0",
                "data_version": "2",
                "deprecated_reason": "",
                "superseded_by": "",
                "tags": with_values(row.get("tags"), "headword-audit-backfill"),
            }
        )
        backfills.append(row)

    retained_pairs = {(row["surface"], row["reading_kana"]) for row in retained}
    backfill_pairs = {(row["surface"], row["reading_kana"]) for row in backfills}
    sequences = load_pair_sequences(args.jmdict, retained_pairs | backfill_pairs)
    used_sequences: set[str] = set()
    for pair in retained_pairs:
        used_sequences.update(sequences.get(pair, set()))
    for row in backfills:
        pair = (row["surface"], row["reading_kana"])
        entry_sequences = sequences.get(pair, set())
        if not entry_sequences:
            raise RuntimeError(f"backfill lacks exact JMdict identity: {row['id']} {pair}")
        if entry_sequences & used_sequences:
            raise RuntimeError(f"backfill duplicates retained JMdict entry: {row['id']} {pair}")
        used_sequences.update(entry_sequences)

    final_rows = retained + backfills
    for row in final_rows:
        row["frequency"] = frequency(row)
    for level in LEVELS:
        level_rows = sorted(
            (row for row in final_rows if row["level"] == level),
            key=lambda row: (-float(row["frequency"]), row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = index // 50 + 1
    final_rows.sort(
        key=lambda row: (
            LEVEL_RANK[row["level"]], int(row["reading_chapter"]),
            -float(row["frequency"]), row["surface"], row["id"],
        )
    )

    ids = [row["id"] for row in final_rows]
    pairs = [(row["surface"], row["reading_kana"]) for row in final_rows]
    level_counts = Counter(row["level"] for row in final_rows)
    if len(final_rows) != 6638 or len(set(ids)) != 6638 or len(set(pairs)) != 6638:
        raise RuntimeError("final count, ID uniqueness, or pair uniqueness failed")
    if any(level_counts[level] != TARGET_COUNTS[level] for level in LEVELS):
        raise RuntimeError(f"level count validation failed: {dict(level_counts)}")

    current_examples = {row["word_id"]: row for row in read_csv(args.examples)}
    candidate_examples = {
        row["word_id"]: row for row in read_csv(args.candidate_examples)
    }
    seed_examples: dict[str, dict[str, Any]] = {}
    promoted_examples: list[dict[str, str]] = []
    for row in final_rows:
        example = current_examples.get(row["id"]) or candidate_examples.get(row["id"])
        if example and example.get("jp", "").strip():
            seed_examples[row["id"]] = dict(example)
    for alias in aliases:
        winner_id = alias["retained_id"]
        if winner_id in seed_examples:
            continue
        loser_example = current_examples.get(alias["removed_id"])
        if loser_example and loser_example.get("jp", "").strip():
            promoted = dict(loser_example)
            promoted["word_id"] = winner_id
            promoted["qa_note"] = combine_values(
                promoted.get("qa_note", ""),
                f"promoted from merged word {alias['removed_id']}",
            )
            seed_examples[winner_id] = promoted
            promoted_examples.append(
                {"from_id": alias["removed_id"], "to_id": winner_id}
            )

    example_rows = sorted(seed_examples.values(), key=lambda row: row["word_id"])
    generated_at = datetime.now(timezone.utc).isoformat()
    document = {
        "generated_at": generated_at,
        "count": len(final_rows),
        "source": str(args.words),
        "vocabulary": [{field: row.get(field) for field in FIELDS} for row in final_rows],
    }
    manifest = {
        "generated_at": generated_at,
        "summary": {
            "input_count": len(original_rows),
            "surface_or_reading_changes": len(changed_ids),
            "meaning_changes": len(meaning_changed_ids),
            "merged_rows": len(aliases),
            "backfills": len(backfills),
            "final_count": len(final_rows),
            "level_counts": dict(level_counts),
            "unique_pairs": len(set(pairs)),
            "seed_examples": len(example_rows),
            "examples_to_complete": len(final_rows) - len(example_rows),
        },
        "changed_ids": sorted(changed_ids),
        "meaning_changed_ids": sorted(meaning_changed_ids),
        "merged_aliases": aliases,
        "backfills": [
            {
                "id": row["id"], "level": row["level"], "surface": row["surface"],
                "reading_kana": row["reading_kana"], "meaning_ko": row["meaning_ko"],
                "frequency": row["frequency"],
            }
            for row in backfills
        ],
        "promoted_examples": promoted_examples,
    }

    write_csv(args.csv_out, final_rows, FIELDS)
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_csv(args.examples_out, example_rows, EXAMPLE_FIELDS)
    args.manifest_out.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_out.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
