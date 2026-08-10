#!/usr/bin/env python3
"""Canonicalize JLPT headwords, merge spelling duplicates, and backfill counts.

The input list already contains every PDF entry.  This pass changes kana-only
headwords to reviewed modern kanji spellings, merges rows that consequently
become the same surface+reading pair, and fills the vacated slots with verified
same-grade vocabulary from the previous QA pool.  IDs of retained rows stay
stable so existing word/example audio remains reusable.
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


# Candidates were checked for exact JMdict surface+reading identity and for not
# sharing a JMdict entry with the canonical final list.  N3 has a large clean
# pool, so common N3 entries cover the small N4 source-pool shortfall.
MANUAL_CANDIDATES: dict[str, list[str]] = {
    # N5 is selected deterministically below: exact JMdict identity plus an
    # already-cleared NAVER example, then frequency order.
    "N5": [],
    "N4": [
        "w_187aa2adfb841e8c", "w_6a95b86178733f43", "w_6d129de0dacae5bb",
        "w_53bb3cf73ffdb8b6",
    ],
    "N4_FROM_N3": [
        "w_e431b1a6abf799bf", "w_ae7c649b01299fea", "w_9c014cb5652a4679",
    ],
    "N2": [
        "w_185bd766c346483b",
    ],
    "N1": [
        "w_688880989b8ec518", "w_727f7cb99378848b", "w_2b26724b2b319010",
        "w_fc4b1b2a9b67e073", "w_d6a47632d886cffc", "w_3129de0be21afd27",
        "w_48bf32a7bfb7243b", "w_4b8574e4cbd2e533", "w_24f78b7b84fbad86",
        "w_ed86d3d08d22d18b", "w_a172145e6a7a76d8", "w_0b04688fd6bb90a0",
        "w_dccafa7233121f28", "w_bc99b4de7f368899", "w_95dcaf9c2e9062b9",
        "w_ed3b692c35933354", "w_a1dfd00d0d68c478", "w_76936c9c142f0a2c",
        "w_37c885dc3e5c332d", "w_50c79dbb941aed3a", "w_72b3908f46cdf2c4",
    ],
}

N3_AUTO_EXCLUDE = {
    # Ambiguous single-character entries or a known spelling/gloss problem.
    "w_cd21637b9647fa3c", "w_a9187b269305746d", "w_918c3022ec6cc0f1",
    "w_dfb409211ee33e05", "w_be72fb5e742abac1", "w_becb668d42acc36a",
    "w_6fb96ccf6fde1b64", "w_abdbc6b15184187d", "w_4c934f2120b1a7b8",
    "w_ad199ec93837f88c", "w_1899f3085b02f5ad", "w_94818f48dbd7d699",
    "w_9976afcfe9206733", "w_5cffc27167c9009e",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--words", type=Path, default=Path("data/pdf-vocab/jlpt_final_wordlist.csv"))
    parser.add_argument("--overrides", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_overrides.json"))
    parser.add_argument("--candidates", type=Path, default=Path("data/track-a/jlpt_qa_work.csv"))
    parser.add_argument("--examples", type=Path, default=Path("data/pdf-vocab/examples_final_qa_work.csv"))
    parser.add_argument("--candidate-examples", type=Path, default=Path("data/track-a/naver_examples_qa_work.csv"))
    parser.add_argument("--jmdict", type=Path, default=Path(".cache/JMdict_e.gz"))
    parser.add_argument("--csv-out", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_wordlist.csv"))
    parser.add_argument("--json-out", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_wordlist.json"))
    parser.add_argument("--examples-out", type=Path, default=Path("data/pdf-vocab/examples_orthography_seed.csv"))
    parser.add_argument("--manifest-out", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_replacement_manifest.json"))
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
            writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})


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


def load_pair_sequences(path: Path, pairs: set[tuple[str, str]]) -> dict[tuple[str, str], set[str]]:
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


def frequency(row: dict[str, Any]) -> float:
    value = zipf_frequency(str(row["surface"]), "ja")
    if value == 0.0:
        value = zipf_frequency(str(row["reading_kana"]), "ja")
    return round(float(value), 3)


def combine_meanings(primary: str, secondary: str) -> str:
    first = primary.strip()
    second = secondary.strip()
    if not second or second == first or second in first:
        return first
    if first in second:
        return second
    return f"{first}; {second}"


def main() -> None:
    args = parse_args()
    input_rows = read_csv(args.words)
    original_by_id = {row["id"]: row for row in input_rows}
    override_doc = json.loads(args.overrides.read_text(encoding="utf-8"))
    overrides = override_doc["overrides"]

    canonical_rows: list[dict[str, Any]] = []
    for source in input_rows:
        row: dict[str, Any] = dict(source)
        display = overrides.get(row["id"], {}).get("display_surface", row["surface"])
        if display != row["surface"]:
            old_surface = row["surface"]
            row["surface"] = display
            row["card_type"] = infer_card_type(display)
            row["alt_forms"] = with_values(row.get("alt_forms"), old_surface)
            row["tags"] = with_values(row.get("tags"), "orthography-normalized")
        canonical_rows.append(row)

    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in canonical_rows:
        grouped[(row["surface"], row["reading_kana"])].append(row)

    retained: list[dict[str, Any]] = []
    removed: list[dict[str, Any]] = []
    aliases: list[dict[str, Any]] = []
    for pair, rows in grouped.items():
        ordered = sorted(
            rows,
            key=lambda row: (
                # When a kana PDF row collides with an existing canonical kanji
                # row, retain the already-kanji row and its mature assets.
                0 if row["id"] not in overrides else 1,
                LEVEL_RANK[row["level"]],
                0 if "freq-core" in parse_array(row.get("tags")) else 1,
                row["id"],
            ),
        )
        winner = ordered[0]
        for loser in ordered[1:]:
            winner["meaning_ko"] = combine_meanings(winner["meaning_ko"], loser["meaning_ko"])
            winner["alt_forms"] = with_values(winner.get("alt_forms"), original_by_id[loser["id"]]["surface"])
            winner["tags"] = with_values(winner.get("tags"), "orthography-duplicate-merged")
            removed.append(loser)
            aliases.append({
                "removed_id": loser["id"], "retained_id": winner["id"],
                "surface": pair[0], "reading_kana": pair[1],
                "removed_level": loser["level"], "retained_level": winner["level"],
                "removed_original_surface": original_by_id[loser["id"]]["surface"],
            })
        retained.append(winner)

    deficits = Counter(row["level"] for row in removed)
    expected_deficits = {level: TARGET_COUNTS[level] - sum(row["level"] == level for row in retained) for level in LEVELS}
    if dict(deficits) != {level: count for level, count in expected_deficits.items() if count}:
        raise RuntimeError(f"deficit accounting mismatch: removed={dict(deficits)} expected={expected_deficits}")

    candidates = {
        row["id"]: row for row in read_csv(args.candidates)
        if row.get("deprecated") == "0" and row.get("qa_status") == "verified"
        and KANJI_RE.search(row.get("surface", ""))
    }
    candidate_example_rows = read_csv(args.candidate_examples)
    candidate_example_ids = {row["word_id"] for row in candidate_example_rows}
    retained_pairs = {(row["surface"], row["reading_kana"]) for row in retained}
    candidate_pairs = {(row["surface"], row["reading_kana"]) for row in candidates.values()}
    sequences = load_pair_sequences(args.jmdict, retained_pairs | candidate_pairs)
    used_sequences: set[str] = set()
    for pair in retained_pairs:
        used_sequences.update(sequences.get(pair, set()))

    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()

    def add_candidate(word_id: str, assigned_level: str) -> None:
        if word_id in selected_ids:
            raise RuntimeError(f"candidate selected twice: {word_id}")
        if word_id not in candidates:
            raise RuntimeError(f"candidate unavailable: {word_id}")
        source = candidates[word_id]
        pair = (source["surface"], source["reading_kana"])
        entry_sequences = sequences.get(pair, set())
        if not entry_sequences:
            raise RuntimeError(f"candidate lacks exact JMdict identity: {word_id} {pair}")
        if entry_sequences & used_sequences:
            raise RuntimeError(f"candidate duplicates an existing JMdict entry: {word_id} {pair}")
        row = {field: source.get(field, "") for field in FIELDS}
        row.update({
            "level": assigned_level,
            "card_type": infer_card_type(row["surface"]),
            "source": f"{source.get('source', '')};orthography-backfill".strip(";"),
            "qa_status": "verified", "deprecated": "0", "data_version": "2",
            "deprecated_reason": "", "superseded_by": "",
            "tags": with_values(source.get("tags"), "orthography-backfill"),
        })
        selected.append(row)
        selected_ids.add(word_id)
        used_sequences.update(entry_sequences)

    for word_id in MANUAL_CANDIDATES["N5"]:
        add_candidate(word_id, "N5")
    for word_id in MANUAL_CANDIDATES["N4"]:
        add_candidate(word_id, "N4")
    for word_id in MANUAL_CANDIDATES["N4_FROM_N3"]:
        add_candidate(word_id, "N4")
    for word_id in MANUAL_CANDIDATES["N2"]:
        add_candidate(word_id, "N2")
    for word_id in MANUAL_CANDIDATES["N1"]:
        add_candidate(word_id, "N1")

    n5_needed = expected_deficits["N5"]
    n5_pool = sorted(
        (
            row for row in candidates.values()
            if row["level"] == "N5" and row["id"] not in selected_ids
            and row["id"] in candidate_example_ids
            and sequences.get((row["surface"], row["reading_kana"]), set())
            and not (sequences[(row["surface"], row["reading_kana"])] & used_sequences)
        ),
        key=lambda row: (-frequency(row), row["surface"], row["id"]),
    )
    for row in n5_pool:
        if sum(item["level"] == "N5" for item in selected) >= n5_needed:
            break
        pair_sequences = sequences[(row["surface"], row["reading_kana"])]
        if pair_sequences & used_sequences:
            continue
        add_candidate(row["id"], "N5")

    n3_needed = expected_deficits["N3"]
    n3_pool = sorted(
        (
            row for row in candidates.values()
            if row["level"] == "N3" and row["id"] not in selected_ids
            and row["id"] not in N3_AUTO_EXCLUDE
            and sequences.get((row["surface"], row["reading_kana"]), set())
            and not (sequences[(row["surface"], row["reading_kana"])] & used_sequences)
        ),
        key=lambda row: (-frequency(row), row["surface"], row["id"]),
    )
    for row in n3_pool:
        if sum(item["level"] == "N3" for item in selected) >= n3_needed:
            break
        pair_sequences = sequences[(row["surface"], row["reading_kana"])]
        if pair_sequences & used_sequences:
            continue
        add_candidate(row["id"], "N3")

    selected_counts = Counter(row["level"] for row in selected)
    if any(selected_counts[level] != expected_deficits[level] for level in LEVELS):
        raise RuntimeError(f"replacement count mismatch: {dict(selected_counts)} vs {expected_deficits}")

    final_rows = retained + selected
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

    pairs = [(row["surface"], row["reading_kana"]) for row in final_rows]
    ids = [row["id"] for row in final_rows]
    level_counts = Counter(row["level"] for row in final_rows)
    if len(final_rows) != 6638 or len(set(ids)) != 6638 or len(set(pairs)) != 6638:
        raise RuntimeError("final count/id/pair uniqueness failed")
    if any(level_counts[level] != TARGET_COUNTS[level] for level in LEVELS):
        raise RuntimeError(f"level counts failed: {dict(level_counts)}")
    if any(not KANJI_RE.search(row["surface"]) for row in final_rows if row["id"] in overrides):
        raise RuntimeError("a kanji override did not produce a kanji surface")

    old_examples = {row["word_id"]: row for row in read_csv(args.examples)}
    candidate_examples = {row["word_id"]: row for row in candidate_example_rows}
    seed_examples = []
    for row in final_rows:
        example = old_examples.get(row["id"]) or candidate_examples.get(row["id"])
        if example:
            seed_examples.append(example)
    seed_examples.sort(key=lambda row: row["word_id"])

    document = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(final_rows), "source": str(args.words),
        "vocabulary": [{field: row.get(field) for field in FIELDS} for row in final_rows],
    }
    manifest = {
        "generated_at": document["generated_at"],
        "summary": {
            "input_count": len(input_rows), "orthography_overrides": len(overrides),
            "duplicate_groups_merged": len(aliases), "replacement_count": len(selected),
            "replacement_counts": dict(selected_counts), "final_count": len(final_rows),
            "unique_pairs": len(set(pairs)), "level_counts": dict(level_counts),
            "seed_examples": len(seed_examples), "examples_to_collect": len(final_rows) - len(seed_examples),
        },
        "merged_aliases": aliases,
        "replacements": [
            {
                "id": row["id"], "assigned_level": row["level"],
                "original_level": candidates[row["id"]]["level"],
                "surface": row["surface"], "reading_kana": row["reading_kana"],
                "meaning_ko": row["meaning_ko"], "frequency": row["frequency"],
                "seed_example": row["id"] in old_examples or row["id"] in candidate_examples,
            }
            for row in selected
        ],
    }

    write_csv(args.csv_out, final_rows, FIELDS)
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(args.examples_out, seed_examples, EXAMPLE_FIELDS)
    args.manifest_out.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
