#!/usr/bin/env python3
"""Rebuild the fixed-size JLPT list from the last curated vocabulary baseline.

The PDF extraction remains a complete audit trail, but pass-book synonym and
usage sections are excluded from app vocabulary provenance.  Rows supported
only by those sections are replaced with independently sourced, JMdict-exact
JLPT dataset entries without reintroducing spelling/semantic duplicates.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data/pdf-vocab"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: index for index, level in enumerate(LEVELS)}
TARGET_COUNTS = {"N5": 339, "N4": 600, "N3": 1499, "N2": 1700, "N1": 2500}
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
KANA_RE = re.compile(r"^[ぁ-ゖァ-ヺー・ヽヾゝゞ]+$")
PHRASE_END_RE = re.compile(
    r"(?:です|でした|ます|ました|ません|ましょう|ている|てある|てください)$"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", type=Path, default=DATA / "jlpt_phrase_review_wordlist.csv")
    parser.add_argument("--base-examples", type=Path, default=DATA / "examples_phrase_review_qa_work.csv")
    parser.add_argument("--sources", type=Path, default=DATA / "jlpt_source_entries.csv")
    parser.add_argument("--core", type=Path, default=DATA / "jlpt_app_vocab.csv")
    parser.add_argument("--qa", type=Path, default=ROOT / "data/track-a/jlpt_qa_work.csv")
    parser.add_argument("--jmdict", type=Path, default=ROOT / ".cache/JMdict_e.gz")
    parser.add_argument("--extra-examples", type=Path, action="append", default=[])
    parser.add_argument("--csv-out", type=Path, default=DATA / "jlpt_scope_curated_wordlist.csv")
    parser.add_argument("--json-out", type=Path, default=DATA / "jlpt_scope_curated_wordlist.json")
    parser.add_argument("--examples-out", type=Path, default=DATA / "examples_scope_curated_qa_work.csv")
    parser.add_argument("--manifest-out", type=Path, default=DATA / "jlpt_scope_curated_manifest.json")
    parser.add_argument("--allow-missing-examples", action="store_true")
    parser.add_argument("--promote", action="store_true")
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


def stable_word_id(surface: str, reading: str) -> str:
    basis = f"{unicodedata.normalize('NFKC', surface)}\u0001{unicodedata.normalize('NFKC', reading)}"
    return f"w_{hashlib.sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def parse_tags(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        value = json.loads(text)
        if isinstance(value, list):
            return list(dict.fromkeys(str(item) for item in value if str(item)))
    except json.JSONDecodeError:
        pass
    return list(dict.fromkeys(part.strip() for part in text.split(";") if part.strip()))


def with_tag(value: Any, tag: str) -> str:
    tags = parse_tags(value)
    if tag not in tags:
        tags.append(tag)
    return json.dumps(tags, ensure_ascii=False, separators=(",", ":"))


def infer_card_type(surface: str) -> str:
    if all("ぁ" <= char <= "ゟ" or char == "ー" for char in surface):
        return "C"
    if all("゠" <= char <= "ヿ" or char == "ー" for char in surface):
        return "D"
    has_kanji = bool(re.search(r"[一-龯々〆ヶ]", surface))
    has_hiragana = any("ぁ" <= char <= "ゟ" for char in surface)
    if has_kanji and has_hiragana:
        return "B"
    return "A" if has_kanji else "E"


def load_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for filename in (
        "jlpt_orthography_replacement_manifest.json",
        "jlpt_headword_review_manifest.json",
    ):
        document = json.loads((DATA / filename).read_text(encoding="utf-8"))
        for row in document["merged_aliases"]:
            aliases[row["removed_id"]] = row["retained_id"]
    phrase = json.loads((DATA / "jlpt_phrase_review_manifest.json").read_text(encoding="utf-8"))
    for source_id, target_id in phrase["source_phrase_mapping"].items():
        if source_id != target_id:
            aliases[source_id] = target_id
    return aliases


def resolve(word_id: str, aliases: dict[str, str]) -> str:
    seen: set[str] = set()
    while word_id in aliases:
        if word_id in seen:
            raise RuntimeError(f"alias cycle at {word_id}")
        seen.add(word_id)
        word_id = aliases[word_id]
    return word_id


def load_pair_sequences(
    path: Path, pairs: set[tuple[str, str]]
) -> dict[tuple[str, str], set[str]]:
    readings = {reading for _, reading in pairs}
    result: dict[tuple[str, str], set[str]] = defaultdict(set)
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            sequence = entry.findtext("ent_seq") or ""
            forms = [node.findtext("keb") or "" for node in entry.findall("k_ele")]
            for node in entry.findall("r_ele"):
                reading = node.findtext("reb") or ""
                if reading not in readings:
                    continue
                restrictions = {item.text or "" for item in node.findall("re_restr")}
                if (reading, reading) in pairs:
                    result[(reading, reading)].add(sequence)
                if node.find("re_nokanji") is None:
                    for surface in forms:
                        pair = (surface, reading)
                        if pair in pairs and (not restrictions or surface in restrictions):
                            result[pair].add(sequence)
            entry.clear()
    return result


def candidate_score(row: dict[str, str], has_example: bool) -> tuple[Any, ...]:
    tags = set(parse_tags(row.get("tags")))
    reviewed = int("ko-reviewed" in tags or "manual-curated" in tags)
    frequency = zipf_frequency(row["surface"], "ja") or zipf_frequency(row["reading_kana"], "ja")
    return (-int(has_example), -reviewed, -frequency, row["surface"], row["id"])


def main() -> None:
    args = parse_args()
    base = read_csv(args.base)
    sources = read_csv(args.sources)
    core = read_csv(args.core)
    qa = read_csv(args.qa)
    phrase_decisions = json.loads((DATA / "jlpt_phrase_review_decisions.json").read_text(encoding="utf-8"))
    aliases = load_aliases()

    if len(base) != 6638 or len({row["id"] for row in base}) != 6638:
        raise RuntimeError("curated baseline must contain 6,638 unique rows")

    qa_active = [
        row for row in qa if row.get("deprecated") == "0" and row.get("qa_status") == "verified"
    ]
    qa_pairs = {(row["surface"], row["reading_kana"]) for row in qa_active}

    included_pairs: set[tuple[str, str]] = set()
    excluded_pairs: set[tuple[str, str]] = set()
    included_ids: set[str] = set()
    excluded_ids: set[str] = set()
    included_pair_levels: dict[tuple[str, str], set[str]] = defaultdict(set)
    for row in sources:
        pair = (row["surface"], row["reading_kana"])
        target_pairs = included_pairs if row["include_in_app"] == "1" else excluded_pairs
        target_pairs.add(pair)
        if row["include_in_app"] == "1":
            included_pair_levels[pair].add(row["level"])
        if row.get("existing_word_id"):
            target_ids = included_ids if row["include_in_app"] == "1" else excluded_ids
            target_ids.add(resolve(row["existing_word_id"], aliases))

    excluded_only_pairs = excluded_pairs - included_pairs
    base_by_id = {row["id"]: row for row in base}
    remove_ids = {
        row["id"]
        for row in base
        if (row["surface"], row["reading_kana"]) in excluded_only_pairs
        and row["id"] not in included_ids
        and (row["surface"], row["reading_kana"]) not in qa_pairs
    }
    remove_ids.update(
        word_id
        for word_id in excluded_ids - included_ids
        if word_id in base_by_id
        and (base_by_id[word_id]["surface"], base_by_id[word_id]["reading_kana"])
        not in qa_pairs
    )
    removed_scope = [dict(base_by_id[word_id]) for word_id in sorted(remove_ids)]
    active: dict[str, dict[str, Any]] = {
        row["id"]: dict(row) for row in base if row["id"] not in remove_ids
    }

    # Remove only actual stem/な duplicates. Standalone な headwords remain when
    # the stem is not already a card.
    by_pair = {(row["surface"], row["reading_kana"]): row for row in active.values()}
    na_successors: dict[str, str] = {}
    for row in list(active.values()):
        if not (row["surface"].endswith("な") and row["reading_kana"].endswith("な")):
            continue
        stem = (row["surface"][:-1], row["reading_kana"][:-1])
        if stem in by_pair:
            na_successors[row["id"]] = by_pair[stem]["id"]
            del active[row["id"]]

    # Confirmed deterministic corrections from the release-wide audit.
    corrections = {
        "w_90b4dd79bc0d9463": {"meaning_ko": "곧바로, 즉시"},
        "w_717479e0869c099f": {"meaning_ko": "따라잡다"},
        "w_8f43b180efb6a864": {"part_of_speech": "noun"},
        "w_2042955fbd7ed6b5": {"part_of_speech": "noun"},
        "w_c804e191ffa9046c": {"part_of_speech": "adjective"},
        "w_e662da8e9deb3398": {"meaning_ko": "소정의, 정해진"},
    }
    applied_corrections = []
    for word_id, values in corrections.items():
        if word_id not in active:
            continue
        before = {key: active[word_id].get(key, "") for key in values}
        active[word_id].update(values)
        active[word_id]["tags"] = with_tag(active[word_id].get("tags"), "full-vocab-audit-fix")
        applied_corrections.append({"id": word_id, "before": before, "after": values})

    # A card must not remain harder than the easiest included PDF word-list
    # occurrence of the exact same headword and reading.
    level_corrections = []
    for row in active.values():
        levels = included_pair_levels.get((row["surface"], row["reading_kana"]), set())
        if not levels:
            continue
        easiest = min(levels, key=LEVEL_RANK.__getitem__)
        if LEVEL_RANK[easiest] < LEVEL_RANK[row["level"]]:
            level_corrections.append(
                {"id": row["id"], "surface": row["surface"], "before": row["level"], "after": easiest}
            )
            row["level"] = easiest
            row["tags"] = with_tag(row.get("tags"), "pdf-level-corrected")

    examples: dict[str, dict[str, str]] = {
        row["word_id"]: dict(row) for row in read_csv(args.base_examples)
        if row.get("jp", "").strip() and row.get("ko", "").strip()
    }
    example_sources = [
        ROOT / "data/track-a/naver_examples_qa_work.csv",
        DATA / "examples_final_qa_work.csv",
        DATA / "examples_na_dedupe_qa_work.csv",
        DATA / "naver_examples_final_qa_work.csv",
        *args.extra_examples,
    ]
    candidate_examples: dict[str, dict[str, str]] = {}
    for path in example_sources:
        if not path.exists():
            continue
        for row in read_csv(path):
            if row.get("jp", "").strip() and row.get("ko", "").strip():
                candidate_examples.setdefault(row["word_id"], dict(row))

    blocked_surfaces = {
        row["surface"] for row in phrase_decisions.get("normalizations", [])
    } | {row["surface"] for row in phrase_decisions.get("removals", [])}
    active_pairs = {(row["surface"], row["reading_kana"]) for row in active.values()}
    active_reading_meaning = {
        (row["reading_kana"], row["meaning_ko"].strip()) for row in active.values()
    }

    candidate_rows = []
    for source in qa_active:
        if source["id"] in active or source["surface"] in blocked_surfaces:
            continue
        if not KANA_RE.fullmatch(source["reading_kana"]):
            continue
        if PHRASE_END_RE.search(source["surface"]):
            continue
        pair = (source["surface"], source["reading_kana"])
        if pair in active_pairs:
            continue
        if (source["reading_kana"], source["meaning_ko"].strip()) in active_reading_meaning:
            continue
        if source["surface"].endswith("な") and source["reading_kana"].endswith("な"):
            if (source["surface"][:-1], source["reading_kana"][:-1]) in active_pairs:
                continue
        candidate_rows.append(dict(source))

    all_pairs = active_pairs | {
        (row["surface"], row["reading_kana"]) for row in candidate_rows
    }
    sequences = load_pair_sequences(args.jmdict, all_pairs)
    used_sequences = {
        sequence for pair in active_pairs for sequence in sequences.get(pair, set())
    }

    level_counts = Counter(row["level"] for row in active.values())
    deficits = {level: TARGET_COUNTS[level] - level_counts[level] for level in LEVELS}
    if any(value < 0 for value in deficits.values()):
        raise RuntimeError(f"negative level deficit: {deficits}")

    backfills: list[dict[str, Any]] = []
    for level in LEVELS:
        pool = sorted(
            [row for row in candidate_rows if row["level"] == level],
            key=lambda row: candidate_score(row, row["id"] in candidate_examples),
        )
        for source in pool:
            if len([row for row in backfills if row["level"] == level]) >= deficits[level]:
                break
            pair = (source["surface"], source["reading_kana"])
            entry_sequences = sequences.get(pair, set())
            if not entry_sequences or entry_sequences & used_sequences:
                continue
            if pair in active_pairs:
                continue
            semantic_key = (source["reading_kana"], source["meaning_ko"].strip())
            if semantic_key in active_reading_meaning:
                continue
            row = {field: source.get(field, "") for field in WORD_FIELDS}
            if source["id"] in corrections:
                row.update(corrections[source["id"]])
            row.update(
                {
                    "level": level,
                    "furigana": source["reading_kana"],
                    "card_type": infer_card_type(source["surface"]),
                    "source": "kaggle:robinpourtaud/jlpt-words-by-level",
                    "qa_status": "verified",
                    "deprecated": "0",
                    "data_version": "2",
                    "deprecated_reason": "",
                    "superseded_by": "",
                    "tags": with_tag(source.get("tags"), "scope-replacement"),
                }
            )
            if row["id"] != stable_word_id(row["surface"], row["reading_kana"]):
                continue
            active[row["id"]] = row
            active_pairs.add(pair)
            active_reading_meaning.add((row["reading_kana"], row["meaning_ko"].strip()))
            used_sequences.update(entry_sequences)
            backfills.append(row)
        selected = sum(row["level"] == level for row in backfills)
        if selected != deficits[level]:
            raise RuntimeError(
                f"{level} replacement pool exhausted: selected={selected}, need={deficits[level]}"
            )

    final_rows = list(active.values())
    for row in final_rows:
        value = zipf_frequency(str(row["surface"]), "ja")
        if value == 0.0:
            value = zipf_frequency(str(row["reading_kana"]), "ja")
        row["frequency"] = f"{value:.3f}"
        example = examples.get(row["id"]) or candidate_examples.get(row["id"])
        if example:
            examples[row["id"]] = dict(example)
            row["example_jp"] = example["jp"]
            row["example_ko"] = example["ko"]
            row["example_license"] = example.get("license", "")

    for level in LEVELS:
        rows = sorted(
            (row for row in final_rows if row["level"] == level),
            key=lambda row: (-float(row["frequency"]), row["surface"], row["id"]),
        )
        for index, row in enumerate(rows):
            row["reading_chapter"] = str(index // 50 + 1)
    final_rows.sort(
        key=lambda row: (
            LEVEL_RANK[row["level"]], int(row["reading_chapter"]),
            -float(row["frequency"]), row["surface"], row["id"],
        )
    )

    final_ids = {row["id"] for row in final_rows}
    missing_examples = sorted(final_ids - set(examples))
    if missing_examples and not args.allow_missing_examples:
        raise RuntimeError(
            f"{len(missing_examples)} replacement words need examples: {missing_examples[:10]}"
        )

    # Resolve included PDF core through every canonicalization layer.
    coverage_aliases = dict(aliases)
    coverage_aliases.update(na_successors)
    missing_core = []
    for row in core:
        initial_id = row["existing_word_id"] or row["id"]
        final_id = resolve(initial_id, coverage_aliases)
        if final_id not in final_ids:
            missing_core.append(
                {"id": initial_id, "resolved_id": final_id, "surface": row["surface"]}
            )

    ids = [row["id"] for row in final_rows]
    pairs = [(row["surface"], row["reading_kana"]) for row in final_rows]
    semantic = [(row["reading_kana"], row["meaning_ko"].strip()) for row in final_rows]
    counts = Counter(row["level"] for row in final_rows)
    checks = {
        "word_count": len(final_rows),
        "unique_ids": len(set(ids)),
        "unique_pairs": len(set(pairs)),
        "same_reading_same_meaning_duplicate_groups": sum(
            count > 1 for count in Counter(semantic).values()
        ),
        "level_counts": dict(counts),
        "missing_examples": len(missing_examples),
        "included_pdf_core": len(core),
        "missing_pdf_core": len(missing_core),
    }
    failures = []
    if len(final_rows) != 6638 or len(set(ids)) != 6638 or len(set(pairs)) != 6638:
        failures.append("count-or-identity")
    if any(counts[level] != TARGET_COUNTS[level] for level in LEVELS):
        failures.append("level-counts")
    if checks["same_reading_same_meaning_duplicate_groups"]:
        failures.append("semantic-duplicates")
    if missing_core:
        failures.append("pdf-core-coverage")
    if missing_examples and not args.allow_missing_examples:
        failures.append("examples")
    if failures:
        raise RuntimeError(f"validation failed: {failures}; checks={checks}; missing_core={missing_core[:5]}")

    generated_at = datetime.now(timezone.utc).isoformat()
    document = {
        "generated_at": generated_at,
        "count": len(final_rows),
        "source": str(args.base),
        "vocabulary": [{field: row.get(field) for field in WORD_FIELDS} for row in final_rows],
    }
    manifest = {
        "generated_at": generated_at,
        "policy": {
            "pdf_scope": "Only kanji-reading, kanji-writing, context, and MKT POS word-list sections are app vocabulary.",
            "excluded": "All pass-book synonym and usage sections remain in source audit only.",
            "replacement": "Verified same-level Kaggle rows with exact novel JMdict identities.",
        },
        "summary": {
            "scope_rows_removed": len(removed_scope),
            "na_duplicates_removed": len(na_successors),
            "replacement_words": len(backfills),
            "replacement_by_level": dict(Counter(row["level"] for row in backfills)),
            "confirmed_corrections": len(applied_corrections),
            "pdf_level_corrections": len(level_corrections),
            **checks,
        },
        "removed_scope_rows": [
            {key: row[key] for key in ("id", "level", "surface", "reading_kana", "meaning_ko", "source")}
            for row in removed_scope
        ],
        "na_successors": na_successors,
        "backfills": [
            {key: row[key] for key in ("id", "level", "surface", "reading_kana", "meaning_ko", "source")}
            for row in backfills
        ],
        "confirmed_corrections": applied_corrections,
        "pdf_level_corrections": level_corrections,
        "missing_example_ids": missing_examples,
        "missing_core": missing_core,
    }

    final_example_rows = sorted(
        (dict(row, word_id=word_id) for word_id, row in examples.items() if word_id in final_ids),
        key=lambda row: row["word_id"],
    )
    write_csv(args.csv_out, final_rows, WORD_FIELDS)
    args.json_out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(args.examples_out, final_example_rows, EXAMPLE_FIELDS)
    args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.promote:
        write_csv(DATA / "jlpt_final_wordlist.csv", final_rows, WORD_FIELDS)
        (DATA / "jlpt_final_wordlist.json").write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        write_csv(DATA / "examples_final_qa_work.csv", final_example_rows, EXAMPLE_FIELDS)
        naver_rows = [
            row for row in final_example_rows
            if row.get("source") == "naver-ja-dict" and row.get("permission_status") == "cleared"
        ]
        write_csv(DATA / "naver_examples_final_qa_work.csv", naver_rows, EXAMPLE_FIELDS)

    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
