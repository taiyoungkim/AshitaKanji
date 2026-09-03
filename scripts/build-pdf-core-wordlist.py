#!/usr/bin/env python3
"""Build a 6,638-row app-schema word list containing every PDF core entry.

This script is intentionally non-destructive: it reads the bundled SQLite DB
and PDF-derived vocabulary, then writes standalone CSV/JSON candidates.  The
active assets/jlpt.db is never modified.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import importlib.util
import json
import sqlite3
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from wordfreq import zipf_frequency


LEVELS = ("N5", "N4", "N3", "N2", "N1")
TARGET_COUNTS = {"N5": 339, "N4": 600, "N3": 1499, "N2": 1700, "N1": 2500}
WORD_FIELDS = (
    "id",
    "level",
    "surface",
    "reading_kana",
    "furigana",
    "meaning_ko",
    "part_of_speech",
    "card_type",
    "example_jp",
    "example_ko",
    "example_jp_id",
    "example_jp_author",
    "example_ko_id",
    "example_ko_author",
    "example_license",
    "alt_forms",
    "disambig",
    "source",
    "qa_status",
    "deprecated",
    "tags",
    "data_version",
    "frequency",
    "reading_chapter",
    "deprecated_reason",
    "superseded_by",
)
FORCE_KEEP_DECISIONS = {"유지", "수정 후 유지"}
FORCE_REMOVE_DECISIONS = {"제외 확정", "제외 가능"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=Path("assets/jlpt.db"))
    parser.add_argument(
        "--core", type=Path, default=Path("data/pdf-vocab/jlpt_app_vocab.csv")
    )
    parser.add_argument(
        "--review",
        type=Path,
        default=Path("data/pdf-vocab/replacement_candidates_reviewed.json"),
    )
    parser.add_argument("--jmdict", type=Path, default=Path(".cache/JMdict_e.gz"))
    parser.add_argument(
        "--audit", type=Path, default=Path("data/track-a/vocab_audit_flagged.csv")
    )
    parser.add_argument(
        "--csv-out",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_final_wordlist.csv"),
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_final_wordlist.json"),
    )
    parser.add_argument(
        "--manifest-out",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_final_replacement_manifest.json"),
    )
    return parser.parse_args()


def clean(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def stable_word_id(surface: str, reading: str) -> str:
    basis = (
        f"{unicodedata.normalize('NFKC', surface)}"
        f"\u0001{unicodedata.normalize('NFKC', reading)}"
    )
    return f"w_{hashlib.sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def infer_card_type(surface: str) -> str:
    if all("ぁ" <= char <= "ゟ" or char == "ー" for char in surface):
        return "C"
    if all("゠" <= char <= "ヿ" or char == "ー" for char in surface):
        return "D"
    has_kanji = any("一" <= char <= "龯" for char in surface)
    has_hiragana = any("ぁ" <= char <= "ゟ" for char in surface)
    if has_kanji and has_hiragana:
        return "B"
    if has_kanji:
        return "A"
    return "E"


def normalize_pos(value: str | None) -> str | None:
    value = clean(value).lower()
    if not value:
        return None
    aliases = {
        "na_adjective": "adjective",
        "i_adjective": "adjective",
        "na-adjective": "adjective",
        "i-adjective": "adjective",
    }
    return aliases.get(value, value)


def infer_pdf_fallback_pos(surface: str) -> str:
    """Conservative fallback for inflected/context forms printed in pass books."""
    if surface.endswith("する"):
        return "verb"
    counter_pattern = (
        "さつ",
        "ひき",
        "だい",
        "まい",
        "こ",
        "えん",
        "キロ",
    )
    if surface.endswith(counter_pattern) and len(surface) <= 8:
        return "counter"
    return "expression"


def pos_from_jmdict_labels(labels: Iterable[str]) -> str | None:
    values = [clean(label).lower() for label in labels if clean(label)]
    checks = (
        ("adverb", lambda value: value.startswith("adverb")),
        ("adjective", lambda value: value.startswith("adjective") or value.startswith("adjectival")),
        ("verb", lambda value: " verb" in f" {value}" and "adverb" not in value),
        ("pronoun", lambda value: value.startswith("pronoun")),
        ("interjection", lambda value: value.startswith("interjection")),
        ("conjunction", lambda value: value.startswith("conjunction")),
        ("particle", lambda value: value.startswith("particle")),
        ("noun", lambda value: value.startswith("noun") or "noun" in value),
        ("counter", lambda value: value.startswith("counter")),
        ("prefix", lambda value: value.startswith("prefix")),
        ("suffix", lambda value: value.startswith("suffix") or "suffix" in value),
        ("numeral", lambda value: value.startswith("numeric") or value.startswith("number")),
        ("expression", lambda value: value.startswith("expression")),
    )
    for label, predicate in checks:
        if any(predicate(value) for value in values):
            return label
    return None


def load_jmdict_pos(
    path: Path, wanted_pairs: set[tuple[str, str]]
) -> tuple[dict[tuple[str, str], str], dict[str, str]]:
    by_pair: dict[tuple[str, str], str] = {}
    by_reading: dict[str, str] = {}
    wanted_readings = {reading for _, reading in wanted_pairs}
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            readings = [node.findtext("reb") or "" for node in entry.findall("r_ele")]
            if not any(reading in wanted_readings for reading in readings):
                entry.clear()
                continue
            first_sense = entry.find("sense")
            label = pos_from_jmdict_labels(
                node.text or "" for node in first_sense.findall("pos")
            ) if first_sense is not None else None
            if not label:
                entry.clear()
                continue
            kanji_forms = [node.findtext("keb") or "" for node in entry.findall("k_ele")]
            for reading_node in entry.findall("r_ele"):
                reading = reading_node.findtext("reb") or ""
                if reading not in wanted_readings:
                    continue
                by_reading.setdefault(reading, label)
                restrictions = {
                    node.text or "" for node in reading_node.findall("re_restr")
                }
                applicable = [
                    surface
                    for surface in kanji_forms
                    if not restrictions or surface in restrictions
                ]
                if not kanji_forms or reading_node.find("re_nokanji") is not None:
                    applicable.append(reading)
                for surface in applicable:
                    pair = (surface, reading)
                    if pair in wanted_pairs:
                        by_pair.setdefault(pair, label)
            entry.clear()
    return by_pair, by_reading


def load_analyzer(root: Path) -> Any:
    module_path = root / "scripts/analyze-vocab-replacement.py"
    spec = importlib.util.spec_from_file_location("vocab_replacement_analyzer", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load analyzer: {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def score_existing_words(
    analyzer: Any,
    db_path: Path,
    core_path: Path,
    jmdict_path: Path,
    audit_path: Path,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    words = analyzer.load_words(db_path)
    _, core_ids = analyzer.load_core(core_path)
    audit = analyzer.load_audit(audit_path)
    pair_matches, entry_members = analyzer.load_jmdict_signals(jmdict_path, words)

    for word_id, word in words.items():
        matches = pair_matches.get((word["surface"], word["reading_kana"]), [])
        priority_codes = sorted(
            {code for match in matches for code in match["priority"]}
        )
        form_priority_codes = sorted(
            {code for match in matches for code in match["form_priority"]}
        )
        info = sorted({value for match in matches for value in match["info"]})
        word.update(
            {
                "is_core": int(word_id in core_ids),
                "jmdict_exact_match": int(bool(matches)),
                "jmdict_sequences": sorted(
                    {match["sequence"] for match in matches}
                ),
                "jmdict_priority": priority_codes,
                "jmdict_priority_score": analyzer.priority_score(priority_codes),
                "jmdict_form_priority": form_priority_codes,
                "jmdict_form_priority_score": analyzer.priority_score(
                    form_priority_codes
                ),
                "jmdict_info": info,
                "jmdict_rare": int(any(match["rare"] for match in matches)),
                "jmdict_severe_info": int(
                    any(match["severe_info"] for match in matches)
                ),
            }
        )

    variant_signals, variant_groups = analyzer.add_variant_groups(words, entry_members)
    for word_id, word in words.items():
        word.update(
            variant_signals.get(
                word_id,
                {
                    "variant_group_id": "",
                    "variant_relationship": "",
                    "variant_canonical_id": "",
                    "variant_canonical_is_core": 0,
                    "is_variant_canonical": 0,
                },
            )
        )
        score, reasons = analyzer.score_word(word, audit.get(word_id))
        word["retire_score"] = score
        word["reason_codes"] = reasons
        word["reason_ko"] = analyzer.reason_korean(word, reasons)
        word["confidence"] = analyzer.confidence_for(word, reasons)
        word["recommended_action"] = analyzer.recommended_action(
            word, word["confidence"]
        )
        word["audit_reason"] = audit.get(word_id, "")
    return words, variant_groups


def load_core_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def load_review(path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {row["word_id"]: row for row in data["candidates"]}, data.get("review", {})


def parse_tags(value: Any) -> list[str]:
    text = clean(value)
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return list(dict.fromkeys(clean(item) for item in parsed if clean(item)))
    except json.JSONDecodeError:
        pass
    return list(dict.fromkeys(part.strip() for part in text.split(";") if part.strip()))


def with_tags(value: Any, *tags: str) -> str:
    output = parse_tags(value)
    for tag in tags:
        if tag and tag not in output:
            output.append(tag)
    return json.dumps(output, ensure_ascii=False, separators=(",", ":"))


def append_disambig(current: Any, addition: str) -> str | None:
    current_text = clean(current)
    if not addition:
        return current_text or None
    if addition in current_text:
        return current_text
    return f"{current_text}; {addition}" if current_text else addition


def retention_key(word: dict[str, Any]) -> tuple[Any, ...]:
    frequency = word.get("frequency")
    return (
        word["retire_score"],
        -int(word.get("has_example", 0)),
        -int(word.get("jmdict_priority_score", 0)),
        -(frequency if frequency is not None else -1.0),
        word["id"],
    )


def select_supplements(
    words: dict[str, dict[str, Any]],
    core_rows: list[dict[str, str]],
    reviews: dict[str, dict[str, Any]],
) -> tuple[set[str], list[dict[str, Any]], dict[str, Any]]:
    core_ids = {row["existing_word_id"] for row in core_rows if row["existing_word_id"]}
    core_pairs = {(row["surface"], row["reading_kana"]) for row in core_rows}
    core_primary_counts = Counter(row["primary_level"] for row in core_rows)
    supplement_targets = {
        level: TARGET_COUNTS[level] - core_primary_counts[level] for level in LEVELS
    }
    selected: set[str] = set()
    selection_report: dict[str, Any] = {}

    for level in LEVELS:
        pool = [
            word
            for word in words.values()
            if word["level"] == level and word["id"] not in core_ids
            and (
                clean(reviews.get(word["id"], {}).get("suggested_surface"))
                or word["surface"],
                clean(reviews.get(word["id"], {}).get("suggested_reading"))
                or word["reading_kana"],
            )
            not in core_pairs
        ]
        forced_keep = [
            word
            for word in pool
            if reviews.get(word["id"], {}).get("manual_decision") in FORCE_KEEP_DECISIONS
            or bool(word.get("is_variant_canonical"))
            or "freq-core" in parse_tags(word.get("tags"))
        ]
        forced_keep_ids = {word["id"] for word in forced_keep}
        forced_remove_ids = {
            word["id"]
            for word in pool
            if reviews.get(word["id"], {}).get("manual_decision") in FORCE_REMOVE_DECISIONS
        }
        overlap = forced_keep_ids & forced_remove_ids
        if overlap:
            raise RuntimeError(f"conflicting manual decisions: {sorted(overlap)}")
        target = supplement_targets[level]
        if len(forced_keep) > target:
            raise RuntimeError(
                f"{level} forced keep exceeds supplement target: {len(forced_keep)} > {target}"
            )
        remaining = sorted(
            [
                word
                for word in pool
                if word["id"] not in forced_keep_ids
                and word["id"] not in forced_remove_ids
            ],
            key=retention_key,
        )
        need = target - len(forced_keep)
        if len(remaining) < need:
            raise RuntimeError(
                f"{level} supplement pool too small: need={need}, available={len(remaining)}"
            )
        kept = forced_keep + remaining[:need]
        kept_ids = {word["id"] for word in kept}
        selected.update(kept_ids)
        removed = [word for word in pool if word["id"] not in kept_ids]
        selection_report[level] = {
            "target": target,
            "pool": len(pool),
            "forced_keep": len(forced_keep),
            "forced_remove": len(forced_remove_ids),
            "selected": len(kept),
            "removed": len(removed),
        }

    removed_rows = [
        word
        for word in words.values()
        if word["id"] not in core_ids and word["id"] not in selected
    ]
    if len(selected) != sum(supplement_targets.values()):
        raise RuntimeError("supplement count mismatch")
    return selected, removed_rows, selection_report


def base_word_row() -> dict[str, Any]:
    return {field: None for field in WORD_FIELDS}


def make_core_word(
    core: dict[str, str],
    existing: dict[str, Any] | None,
    pos_by_pair: dict[tuple[str, str], str],
    pos_by_reading: dict[str, str],
) -> dict[str, Any]:
    row = base_word_row()
    if existing:
        row.update({field: existing.get(field) for field in WORD_FIELDS})
    surface = core["surface"]
    reading = core["reading_kana"]
    pdf_pos = normalize_pos(core.get("part_of_speech"))
    row.update(
        {
            "id": core["id"],
            "level": core["primary_level"],
            "surface": surface,
            "reading_kana": reading,
            "furigana": clean(row.get("furigana")) or reading,
            "meaning_ko": clean(core["meaning_ko"]),
            "part_of_speech": pdf_pos
            or normalize_pos(row.get("part_of_speech"))
            or pos_by_pair.get((surface, reading))
            or pos_by_reading.get(reading)
            or infer_pdf_fallback_pos(surface),
            "card_type": infer_card_type(surface),
            "source": f"pdf:{core['source_ids']}",
            "qa_status": "verified",
            "deprecated": 0,
            "tags": with_tags(
                row.get("tags"),
                "freq-core",
                "pdf-core",
                "pdf-matched" if existing else "pdf-new",
            ),
            "data_version": 2,
            "deprecated_reason": None,
            "superseded_by": None,
        }
    )
    if core.get("alt_readings"):
        row["disambig"] = append_disambig(
            row.get("disambig"), f"다른 읽기: {core['alt_readings']}"
        )
    return row


def make_supplement_word(
    word: dict[str, Any], review: dict[str, Any] | None
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    row = {field: word.get(field) for field in WORD_FIELDS}
    correction: dict[str, Any] | None = None
    old_identity = (row["id"], row["surface"], row["reading_kana"])
    if review and review.get("manual_decision") == "수정 후 유지":
        if review.get("suggested_surface"):
            row["surface"] = review["suggested_surface"]
        if review.get("suggested_reading"):
            row["reading_kana"] = review["suggested_reading"]
            row["furigana"] = review["suggested_reading"]
        if review.get("suggested_meaning_ko"):
            row["meaning_ko"] = review["suggested_meaning_ko"]
        if review.get("suggested_part_of_speech"):
            row["part_of_speech"] = normalize_pos(
                review["suggested_part_of_speech"]
            )
        row["id"] = stable_word_id(row["surface"], row["reading_kana"])
        row["tags"] = with_tags(row.get("tags"), "manual-reviewed-retain")
        correction = {
            "old_id": old_identity[0],
            "new_id": row["id"],
            "level": row["level"],
            "old_surface": old_identity[1],
            "new_surface": row["surface"],
            "old_reading": old_identity[2],
            "new_reading": row["reading_kana"],
            "old_meaning_ko": word["meaning_ko"],
            "new_meaning_ko": row["meaning_ko"],
            "note": review.get("manual_note", ""),
            "identity_changed": int(old_identity[0] != row["id"]),
        }
    elif review and review.get("manual_decision") == "유지":
        row["tags"] = with_tags(row.get("tags"), "manual-reviewed-retain")
    else:
        row["tags"] = with_tags(row.get("tags"))
    row.update(
        {
            "part_of_speech": normalize_pos(row.get("part_of_speech")),
            "card_type": infer_card_type(row["surface"]),
            "qa_status": "verified",
            "deprecated": 0,
            "data_version": 2,
            "deprecated_reason": None,
            "superseded_by": None,
        }
    )
    row["tags"] = with_tags(row.get("tags"), "pdf-supplement")
    return row, correction


def assign_frequency_and_chapters(rows: list[dict[str, Any]]) -> None:
    for row in rows:
        frequency = zipf_frequency(row["surface"], "ja")
        if frequency == 0.0:
            frequency = zipf_frequency(row["reading_kana"], "ja")
        row["frequency"] = round(float(frequency), 3)

    for level in LEVELS:
        level_rows = sorted(
            [row for row in rows if row["level"] == level],
            key=lambda row: (-row["frequency"], row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = index // 50 + 1


def validate_final(
    current_words: dict[str, dict[str, Any]],
    core_rows: list[dict[str, str]],
    final_rows: list[dict[str, Any]],
    removed_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    final_ids = [row["id"] for row in final_rows]
    final_pairs = [(row["surface"], row["reading_kana"]) for row in final_rows]
    core_pairs = {(row["surface"], row["reading_kana"]) for row in core_rows}
    final_pair_set = set(final_pairs)
    level_counts = Counter(row["level"] for row in final_rows)
    required_nonblank = ("id", "level", "surface", "reading_kana", "meaning_ko", "card_type")
    missing_required = [
        row["id"] for row in final_rows if any(not clean(row.get(field)) for field in required_nonblank)
    ]
    invalid_tags = []
    for row in final_rows:
        try:
            if not isinstance(json.loads(row["tags"]), list):
                invalid_tags.append(row["id"])
        except (json.JSONDecodeError, TypeError):
            invalid_tags.append(row["id"])
    stable_id_mismatches = [
        row["id"]
        for row in final_rows
        if row["id"] != stable_word_id(row["surface"], row["reading_kana"])
    ]
    chapter_counts: dict[str, dict[int, int]] = {}
    for level in LEVELS:
        chapter_counts[level] = dict(
            sorted(
                Counter(
                    row["reading_chapter"]
                    for row in final_rows
                    if row["level"] == level
                ).items()
            )
        )
    invalid_chapter_blocks = {
        level: counts
        for level, counts in chapter_counts.items()
        if any(count > 50 or count <= 0 for count in counts.values())
    }
    checks = {
        "current_count": len(current_words),
        "final_count": len(final_rows),
        "unique_ids": len(set(final_ids)),
        "unique_surface_reading_pairs": len(final_pair_set),
        "pdf_core_total": len(core_rows),
        "pdf_core_included": len(core_pairs & final_pair_set),
        "removed_supplements": len(removed_rows),
        "level_counts": dict(level_counts),
        "target_counts": TARGET_COUNTS,
        "missing_required_count": len(missing_required),
        "invalid_tags_count": len(invalid_tags),
        "stable_id_mismatch_count": len(stable_id_mismatches),
        "invalid_card_type_count": sum(
            row["card_type"] not in {"A", "B", "C", "D", "E"} for row in final_rows
        ),
        "non_verified_count": sum(row["qa_status"] != "verified" for row in final_rows),
        "deprecated_count": sum(int(row["deprecated"]) != 0 for row in final_rows),
        "missing_frequency_count": sum(row["frequency"] is None for row in final_rows),
        "missing_chapter_count": sum(row["reading_chapter"] is None for row in final_rows),
        "invalid_chapter_blocks": invalid_chapter_blocks,
        "chapter_counts": chapter_counts,
    }
    failures = []
    if checks["current_count"] != 6638 or checks["final_count"] != 6638:
        failures.append("total count")
    if checks["unique_ids"] != 6638 or checks["unique_surface_reading_pairs"] != 6638:
        failures.append("uniqueness")
    if checks["pdf_core_included"] != checks["pdf_core_total"]:
        failures.append("PDF core inclusion")
    if any(level_counts[level] != TARGET_COUNTS[level] for level in LEVELS):
        failures.append("level counts")
    scalar_zero_checks = (
        "missing_required_count",
        "invalid_tags_count",
        "stable_id_mismatch_count",
        "invalid_card_type_count",
        "non_verified_count",
        "deprecated_count",
        "missing_frequency_count",
        "missing_chapter_count",
    )
    if any(checks[name] for name in scalar_zero_checks) or invalid_chapter_blocks:
        failures.append("field integrity")
    checks["status"] = "PASS" if not failures else "FAIL"
    checks["failures"] = failures
    if failures:
        duplicate_ids = [
            value for value, count in Counter(final_ids).items() if count > 1
        ][:10]
        duplicate_pairs = [
            value for value, count in Counter(final_pairs).items() if count > 1
        ][:10]
        raise RuntimeError(
            f"final validation failed: {failures}; "
            f"duplicate_ids={duplicate_ids}; duplicate_pairs={duplicate_pairs}"
        )
    return checks


def csv_value(value: Any) -> Any:
    return "" if value is None else value


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=WORD_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: csv_value(row.get(field)) for field in WORD_FIELDS})


def json_word(row: dict[str, Any]) -> dict[str, Any]:
    return {field: row.get(field) for field in WORD_FIELDS}


def removal_manifest_row(
    word: dict[str, Any], review: dict[str, Any] | None
) -> dict[str, Any]:
    return {
        "word_id": word["id"],
        "level": word["level"],
        "surface": word["surface"],
        "reading_kana": word["reading_kana"],
        "meaning_ko": word["meaning_ko"],
        "frequency": word["frequency"],
        "has_example": int(word["has_example"]),
        "retire_score": word["retire_score"],
        "confidence": word["confidence"],
        "recommended_action": word["recommended_action"],
        "reason_ko": word["reason_ko"],
        "reason_codes": word["reason_codes"],
        "manual_decision": review.get("manual_decision", "보류") if review else "보류",
        "manual_note": review.get("manual_note", "") if review else "",
    }


def main() -> None:
    args = parse_args()
    root = Path(__file__).resolve().parent.parent
    analyzer = load_analyzer(root)
    core_rows = load_core_rows(args.core)
    reviews, review_summary = load_review(args.review)
    words, variant_groups = score_existing_words(
        analyzer, args.db, args.core, args.jmdict, args.audit
    )
    selected_ids, removed_words, selection_report = select_supplements(
        words, core_rows, reviews
    )

    wanted_pairs = {(row["surface"], row["reading_kana"]) for row in core_rows}
    pos_by_pair, pos_by_reading = load_jmdict_pos(args.jmdict, wanted_pairs)

    final_rows: list[dict[str, Any]] = []
    added_core: list[dict[str, Any]] = []
    releveled_core: list[dict[str, Any]] = []
    core_meaning_updates: list[dict[str, Any]] = []
    for core in core_rows:
        existing = words.get(core["existing_word_id"]) if core["existing_word_id"] else None
        final = make_core_word(core, existing, pos_by_pair, pos_by_reading)
        final_rows.append(final)
        if existing is None:
            added_core.append(
                {
                    "id": final["id"],
                    "level": final["level"],
                    "surface": final["surface"],
                    "reading_kana": final["reading_kana"],
                    "meaning_ko": final["meaning_ko"],
                    "part_of_speech": final["part_of_speech"],
                    "source_ids": core["source_ids"],
                    "source_entry_ids": core["source_entry_ids"],
                }
            )
        else:
            if existing["level"] != final["level"]:
                releveled_core.append(
                    {
                        "id": final["id"],
                        "surface": final["surface"],
                        "reading_kana": final["reading_kana"],
                        "old_level": existing["level"],
                        "new_level": final["level"],
                    }
                )
            if clean(existing["meaning_ko"]) != clean(final["meaning_ko"]):
                core_meaning_updates.append(
                    {
                        "id": final["id"],
                        "surface": final["surface"],
                        "reading_kana": final["reading_kana"],
                        "old_meaning_ko": existing["meaning_ko"],
                        "new_meaning_ko": final["meaning_ko"],
                    }
                )

    corrections: list[dict[str, Any]] = []
    for word_id in sorted(selected_ids):
        final, correction = make_supplement_word(words[word_id], reviews.get(word_id))
        final_rows.append(final)
        if correction:
            corrections.append(correction)

    assign_frequency_and_chapters(final_rows)
    final_rows.sort(
        key=lambda row: (
            LEVELS.index(row["level"]),
            row["reading_chapter"],
            -row["frequency"],
            row["surface"],
            row["id"],
        )
    )
    checks = validate_final(words, core_rows, final_rows, removed_words)

    current_ids = set(words)
    final_ids = {row["id"] for row in final_rows}
    removed_manifest = sorted(
        [removal_manifest_row(word, reviews.get(word["id"])) for word in removed_words],
        key=lambda row: (LEVELS.index(row["level"]), -row["retire_score"], row["word_id"]),
    )
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "goal": f"현재 앱과 동일한 6,638개/급수별 개수/word 스키마를 유지하면서 범위 확정 PDF 핵심어 {len(core_rows):,}개를 전부 포함",
        "inputs": {
            "database": str(args.db),
            "pdf_core": str(args.core),
            "review": str(args.review),
            "jmdict": str(args.jmdict),
        },
        "summary": {
            "current_count": len(words),
            "final_count": len(final_rows),
            "pdf_core_total": len(core_rows),
            "pdf_core_existing": sum(bool(row["existing_word_id"]) for row in core_rows),
            "pdf_core_new": len(added_core),
            "supplements_kept": len(selected_ids),
            "supplements_removed": len(removed_words),
            "manual_corrections_retained": len(corrections),
            "identity_changing_corrections": sum(row["identity_changed"] for row in corrections),
            "core_level_changes": len(releveled_core),
            "core_meaning_updates": len(core_meaning_updates),
            "current_ids_removed": len(current_ids - final_ids),
            "final_ids_added": len(final_ids - current_ids),
            "level_counts": checks["level_counts"],
            "validation": checks["status"],
        },
        "selection_by_level": selection_report,
        "manual_review": review_summary,
        "rules": [
            f"범위 확정 PDF 핵심어 {len(core_rows):,}개는 표기+읽기 기준으로 전부 강제 포함",
            "pass 계열 PDF의 유의어·용법 구역은 원문 감사에만 보존하고 PDF 핵심어에서 제외",
            "PDF primary_level을 최종 JLPT 급수로 사용",
            "기존 급수별 목표 N5 339/N4 600/N3 1499/N2 1700/N1 2500 유지",
            "수동 유지·수정 판정, 변형 그룹 대표형, 기존 freq-core는 보충 단어로 우선 보호",
            "수동 제외 확정·제외 가능 판정은 우선 제외",
            "나머지는 JMdict 표기·우선도, Zipf 빈도, 예문, 기존 콘텐츠 근거의 제거 점수로 선별",
            "출시 전 학습 이력이 없으므로 최종 급수 내 Zipf 빈도순으로 회독 챕터를 재배치",
        ],
        "validation": checks,
        "added_pdf_core": added_core,
        "removed_supplements": removed_manifest,
        "retained_corrections": corrections,
        "releveled_pdf_core": releveled_core,
        "pdf_core_meaning_updates": core_meaning_updates,
        "variant_group_count": len(variant_groups),
    }
    json_output = {
        "schema_version": 5,
        "data_version": 2,
        "generated_at": manifest["generated_at"],
        "count": len(final_rows),
        "level_counts": checks["level_counts"],
        "pdf_core_count": len(core_rows),
        "vocabulary": [json_word(row) for row in final_rows],
    }

    write_csv(args.csv_out, final_rows)
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(
        json.dumps(json_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    args.manifest_out.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_out.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))
    print(json.dumps(selection_report, ensure_ascii=False, indent=2))
    print(json.dumps(checks, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
