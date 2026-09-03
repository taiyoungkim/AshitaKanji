#!/usr/bin/env python3
"""Move confirmed words to NAVER JLPT levels and backfill only shortages.

The pass is non-destructive by default.  It emits a proposed 7,027-word list,
an additions-only CSV for example collection, and a manifest.  Promotion is a
separate explicit step after every added word has an approved example.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import html
import json
import re
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: index for index, level in enumerate(LEVELS)}
MIN_COUNTS = {"N5": 339, "N4": 600, "N3": 1499, "N2": 1700, "N1": 2500}
EXPECTED_FINAL_COUNTS = {"N5": 393, "N4": 726, "N3": 1499, "N2": 1909, "N1": 2500}
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
ALLOWED_NAVER_POS = {"명사", "동사", "형용사", "형용동사", "부사", "대명사"}
POS_MAP = {
    "명사": "noun",
    "동사": "verb",
    "형용사": "adjective",
    "형용동사": "adjective",
    "부사": "adverb",
    "대명사": "pronoun",
}
DISCOURAGED_KANJI_INFO = {"irregular kanji usage", "out-dated kanji", "rarely-used kanji form", "search-only kanji form"}
KANA_RE = re.compile(r"^[ぁ-ゖァ-ヺー]+$")
JAPANESE_WORD_RE = re.compile(r"^[ぁ-ゖァ-ヺー々〆ヶ一-龯]+$")
PARTICLE_PHRASE_RE = re.compile(r"[一-龯々〆ヶ]+(?:が|を|に|へ|とは|は)[ぁ-ゖ一-龯々〆ヶ]+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--words", type=Path, default=DATA / "jlpt_final_wordlist.csv")
    parser.add_argument(
        "--direct-audit", type=Path,
        default=DATA / "naver_jlpt_level_mismatch_direct_check_2026-08-19.csv",
    )
    parser.add_argument("--catalog", type=Path, default=ROOT / ".cache/naver-jlpt-catalog.json")
    parser.add_argument("--jmdict", type=Path, default=ROOT / ".cache/JMdict_e.gz")
    parser.add_argument("--csv-out", type=Path, default=DATA / "jlpt_naver_rebalanced_wordlist.csv")
    parser.add_argument("--json-out", type=Path, default=DATA / "jlpt_naver_rebalanced_wordlist.json")
    parser.add_argument("--additions-out", type=Path, default=DATA / "jlpt_naver_backfill_additions.csv")
    parser.add_argument("--base-examples", type=Path, default=DATA / "examples_final_qa_work.csv")
    parser.add_argument(
        "--addition-examples", type=Path,
        default=DATA / "naver_examples_naver_backfill_qa_work.csv",
    )
    parser.add_argument(
        "--examples-out", type=Path,
        default=DATA / "examples_naver_rebalanced_qa_work.csv",
    )
    parser.add_argument("--manifest-out", type=Path, default=DATA / "jlpt_naver_rebalance_manifest.json")
    parser.add_argument("--exclude-misses", type=Path, action="append", default=[])
    parser.add_argument(
        "--promote",
        action="store_true",
        help="After every validation passes, replace the canonical final word/example files.",
    )
    parser.add_argument(
        "--confirmed-only",
        action="store_true",
        help=(
            "Apply only current-audit confirmed_mismatch rows. Do not backfill, "
            "target-count balance, replace headwords, or create new ids."
        ),
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
        writer.writerows(
            {field: "" if row.get(field) is None else row.get(field) for field in fields}
            for row in rows
        )


def stable_word_id(surface: str, reading: str) -> str:
    basis = f"{unicodedata.normalize('NFKC', surface)}\u0001{unicodedata.normalize('NFKC', reading)}"
    return f"w_{hashlib.sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def normalize(value: Any) -> str:
    text = urllib.parse.unquote(html.unescape(re.sub(r"<[^>]+>", "", str(value or ""))))
    text = re.sub(r"[()（）\[\]［］]", "", text)
    return re.sub(r"[\s-]", "", text).strip()


def dedupe_form(value: Any) -> str:
    """Normalize iteration marks only for duplicate identity comparisons."""
    text = normalize(value)
    result = []
    for char in text:
        if char == "々" and result:
            result.append(result[-1])
        else:
            result.append(char)
    return "".join(result)


def split_naver_forms(value: Any) -> list[str]:
    decoded = urllib.parse.unquote(str(value or ""))
    return list(dict.fromkeys(
        form for part in re.split(r"[·・･,，、/／|｜;；\s]+", decoded)
        if (form := normalize(part))
    ))


def parse_alt_forms(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        return [str(parsed)]
    except json.JSONDecodeError:
        return [part.strip() for part in re.split(r"[|,、;；]+", text) if part.strip()]


def parse_tags(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return list(dict.fromkeys(str(item) for item in parsed if str(item)))
    except json.JSONDecodeError:
        pass
    return list(dict.fromkeys(part.strip() for part in text.split(";") if part.strip()))


def add_tags(value: Any, *tags: str) -> str:
    result = parse_tags(value)
    for tag in tags:
        if tag not in result:
            result.append(tag)
    return json.dumps(result, ensure_ascii=False, separators=(",", ":"))


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


def compact_meaning(value: str) -> str:
    return re.sub(r"[\s,，.;；:：()（）]", "", value).strip()


def meaning_tokens(value: str) -> set[str]:
    return {
        token for token in re.findall(r"[가-힣]{2,}", value)
        if token not in {"하는", "되는", "또는", "따위", "것을", "것이", "일을"}
    }


def meanings_overlap(left: str, right: str) -> bool:
    compact_left = compact_meaning(left)
    compact_right = compact_meaning(right)
    if compact_left and compact_right and (
        compact_left in compact_right or compact_right in compact_left
    ):
        return True
    return bool(meaning_tokens(left) & meaning_tokens(right))


def korean_meaning(means: list[Any]) -> str:
    cleaned = []
    for raw in means:
        value = html.unescape(str(raw or "")).replace("&#xa0;", " ")
        value = re.sub(r"\s+", " ", value).strip(" ,;")
        if value and value not in cleaned:
            cleaned.append(value)
    return ", ".join(cleaned[:3])


def select_pos(parts: list[Any]) -> str:
    values = [str(part) for part in parts]
    # NAVER marks verbal nouns as both 명사 and 동사; cards treat these as nouns.
    for key in ("명사", "동사", "형용사", "형용동사", "부사", "대명사"):
        if key in values:
            return POS_MAP[key]
    raise ValueError(f"unsupported NAVER parts: {values}")


def load_jmdict_metadata(
    path: Path, wanted: set[tuple[str, str]]
) -> dict[tuple[str, str], dict[str, Any]]:
    metadata: dict[tuple[str, str], dict[str, Any]] = {}
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            sequence = entry.findtext("ent_seq") or ""
            kanji = []
            for node in entry.findall("k_ele"):
                surface = node.findtext("keb") or ""
                kanji.append({
                    "surface": surface,
                    "priority": [item.text or "" for item in node.findall("ke_pri")],
                    "info": {item.text or "" for item in node.findall("ke_inf")},
                })
            for reading_node in entry.findall("r_ele"):
                reading = reading_node.findtext("reb") or ""
                reading_priority = [item.text or "" for item in reading_node.findall("re_pri")]
                restrictions = {item.text or "" for item in reading_node.findall("re_restr")}
                kana_pair = (reading, reading)
                if kana_pair in wanted:
                    previous = metadata.get(kana_pair, {})
                    metadata[kana_pair] = {
                        "priority": list(dict.fromkeys(previous.get("priority", []) + reading_priority)),
                        "info": set(),
                        "sequences": set(previous.get("sequences", set())) | {sequence},
                    }
                if reading_node.find("re_nokanji") is None:
                    for item in kanji:
                        pair = (item["surface"], reading)
                        if pair not in wanted or (restrictions and item["surface"] not in restrictions):
                            continue
                        previous = metadata.get(pair, {})
                        metadata[pair] = {
                            "priority": list(dict.fromkeys(
                                previous.get("priority", []) + item["priority"] + reading_priority
                            )),
                            "info": set(previous.get("info", set())) | item["info"],
                            "sequences": set(previous.get("sequences", set())) | {sequence},
                        }
            entry.clear()
    return metadata


def priority_score(values: list[str]) -> int:
    score = 0
    for value in values:
        if value in {"ichi1", "news1", "spec1", "gai1"}:
            score = max(score, 3)
        elif value in {"ichi2", "news2", "spec2", "gai2"}:
            score = max(score, 2)
        elif value.startswith("nf"):
            score = max(score, 1)
    return score


def candidate_is_lexical(item: dict[str, Any], reading: str, forms: list[str], meaning: str) -> bool:
    raw_entry = urllib.parse.unquote(str(item.get("entry") or ""))
    parts = {str(part) for part in item.get("parts") or []}
    if not reading or raw_entry.startswith("-") or raw_entry.endswith("-"):
        return False
    if not parts or not parts <= ALLOWED_NAVER_POS:
        return False
    if not KANA_RE.fullmatch(reading) or len(reading) < 2:
        return False
    if not meaning or meaning.startswith(("…", "~", "～", "〜")):
        return False
    if not forms or not all(JAPANESE_WORD_RE.fullmatch(form) for form in forms):
        return False
    if all(len(form) < 2 for form in forms):
        return False
    if PARTICLE_PHRASE_RE.search(forms[0]):
        return False
    return True


def apply_confirmed_only(args: argparse.Namespace) -> None:
    words = read_csv(args.words)
    audit = read_csv(args.direct_audit)
    active_words = [row for row in words if str(row.get("deprecated", "0")).strip() != "1"]
    by_id = {row["id"]: row for row in active_words}
    if len(by_id) != len(active_words):
        raise RuntimeError("current word list contains duplicate active ids")

    allowed_statuses = {
        "exact_match",
        "confirmed_mismatch",
        "manual_review",
        "naver_level_missing",
    }
    unknown = sorted({row.get("status", "") for row in audit} - allowed_statuses)
    if unknown:
        raise RuntimeError(f"audit contains unsupported statuses: {unknown}")
    audit_ids = [row.get("id", "") for row in audit]
    if len(audit_ids) != len(active_words) or set(audit_ids) != set(by_id):
        raise RuntimeError("audit must cover every active word id exactly once")
    if len(set(audit_ids)) != len(audit_ids):
        raise RuntimeError("audit contains duplicate word ids")

    status_counts = Counter(row["status"] for row in audit)
    movements = []
    for decision in audit:
        if decision["status"] != "confirmed_mismatch":
            continue
        row = by_id[decision["id"]]
        if row["surface"] != decision["surface"] or row["reading_kana"] != decision["reading_kana"]:
            raise RuntimeError(f"surface/reading drift for {row['id']}")
        if row["level"] != decision["app_level"]:
            raise RuntimeError(f"level drift for {row['id']}")
        before = row["level"]
        after = decision["naver_level"]
        if after not in LEVELS or after == before:
            raise RuntimeError(f"invalid confirmed movement for {row['id']}: {before}->{after}")
        row["level"] = after
        row["tags"] = add_tags(row.get("tags"), "naver-level-corrected-v12")
        movements.append({
            "id": row["id"],
            "surface": row["surface"],
            "reading_kana": row["reading_kana"],
            "before": before,
            "after": after,
            "naver_entry_id": decision.get("naver_entry_id", ""),
            "source_url": decision.get("source_url", ""),
        })

    for level in LEVELS:
        level_rows = sorted(
            (row for row in active_words if row["level"] == level),
            key=lambda row: (-float(row.get("frequency") or 0), row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = str(index // 50 + 1)
    words.sort(key=lambda row: (
        LEVEL_RANK.get(row["level"], len(LEVELS)),
        int(row.get("reading_chapter") or 0),
        -float(row.get("frequency") or 0),
        row["surface"],
        row["id"],
    ))

    final_ids = {row["id"] for row in active_words}
    base_examples = read_csv(args.base_examples)
    if len(base_examples) != len(final_ids) or {row["word_id"] for row in base_examples} != final_ids:
        raise RuntimeError("example linkage must cover every active word id exactly once")

    generated_at = datetime.now(timezone.utc).isoformat()
    level_counts = dict(Counter(row["level"] for row in active_words))
    transitions = dict(Counter(f"{row['before']}->{row['after']}" for row in movements))
    special = {
        "N1_to_N4_N5": [row for row in movements if row["before"] == "N1" and row["after"] in {"N4", "N5"}],
        "N2_to_N4_N5": [row for row in movements if row["before"] == "N2" and row["after"] in {"N4", "N5"}],
        "N4_N5_to_N1_N2": [row for row in movements if row["before"] in {"N4", "N5"} and row["after"] in {"N1", "N2"}],
    }
    document = {
        "generated_at": generated_at,
        "count": len(words),
        "source": str(args.words),
        "vocabulary": [{field: row.get(field, "") for field in WORD_FIELDS} for row in words],
    }
    manifest = {
        "generated_at": generated_at,
        "promoted": args.promote,
        "policy": {
            "level_source": "NAVER Japanese Dictionary displayed JLPT catalog/badge (app reference data; not an official JLPT vocabulary list)",
            "identity": "Require exact surface+reading and confirmed part-of-speech/Korean-meaning alignment.",
            "movement": "Only confirmed_mismatch rows move; ambiguous, missing-level, and multi-entry matches never move.",
            "balancing": "No target-count balancing or backfill.",
            "ids": "Level-only changes preserve every existing word id.",
        },
        "input_sha256": {
            "words": hashlib.sha256(args.words.read_bytes()).hexdigest(),
            "audit": hashlib.sha256(args.direct_audit.read_bytes()).hexdigest(),
        },
        "summary": {
            "word_count": len(active_words),
            "status_counts": dict(status_counts),
            "confirmed_movements": len(movements),
            "movement_transitions": transitions,
            "level_counts": level_counts,
            "unique_ids": len(final_ids),
            "example_count": len(base_examples),
        },
        "special_transitions": special,
        "movements": movements,
    }
    write_csv(args.csv_out, words, WORD_FIELDS)
    args.json_out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(args.examples_out, base_examples, EXAMPLE_FIELDS)
    args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.promote:
        write_csv(DATA / "jlpt_final_wordlist.csv", words, WORD_FIELDS)
        (DATA / "jlpt_final_wordlist.json").write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        write_csv(DATA / "examples_final_qa_work.csv", base_examples, EXAMPLE_FIELDS)

    print(json.dumps({
        "word_count": len(active_words),
        "status_counts": dict(status_counts),
        "confirmed_movements": len(movements),
        "movement_transitions": transitions,
        "level_counts": level_counts,
        "special_transitions": {key: len(value) for key, value in special.items()},
        "manifest": str(args.manifest_out),
    }, ensure_ascii=False, indent=2))


def main() -> None:
    args = parse_args()
    if args.confirmed_only:
        apply_confirmed_only(args)
        return
    words = read_csv(args.words)
    audit = read_csv(args.direct_audit)
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))["items"]
    excluded_addition_ids: set[str] = set()
    for misses_path in args.exclude_misses:
        misses_document = json.loads(misses_path.read_text(encoding="utf-8"))
        excluded_addition_ids.update(
            str(item["word_id"]) for item in misses_document.get("items", [])
        )
    if len(words) != 6638 or len({row["id"] for row in words}) != 6638:
        raise RuntimeError("input word list must contain 6,638 unique rows")
    base_examples = read_csv(args.base_examples)
    addition_example_rows = read_csv(args.addition_examples) if args.addition_examples.exists() else []
    addition_examples = {row["word_id"]: row for row in addition_example_rows}
    if len(base_examples) != 6638 or len({row["word_id"] for row in base_examples}) != 6638:
        raise RuntimeError("base examples must cover 6,638 unique words")

    by_id = {row["id"]: row for row in words}
    movements = []
    for decision in audit:
        if decision.get("status") != "mismatch":
            continue
        word_id = decision["id"]
        if word_id not in by_id:
            raise RuntimeError(f"direct-audit word is absent: {word_id}")
        row = by_id[word_id]
        if row["level"] != decision["app_level"]:
            raise RuntimeError(
                f"level drift for {word_id}: word={row['level']} audit={decision['app_level']}"
            )
        before = row["level"]
        row["level"] = decision["naver_level"]
        row["tags"] = add_tags(row.get("tags"), "naver-level-corrected")
        movements.append({
            "id": word_id,
            "surface": row["surface"],
            "reading_kana": row["reading_kana"],
            "before": before,
            "after": row["level"],
            "naver_entry_id": decision.get("naver_entry_id", ""),
            "source_url": decision.get("source_url", ""),
        })
    if len(movements) != 1594:
        raise RuntimeError(f"expected 1,594 confirmed movements, got {len(movements)}")

    moved_counts = Counter(row["level"] for row in words)
    deficits = {level: max(0, MIN_COUNTS[level] - moved_counts[level]) for level in LEVELS}
    if deficits != {"N5": 0, "N4": 0, "N3": 325, "N2": 0, "N1": 64}:
        raise RuntimeError(f"unexpected post-move deficits: {deficits}")

    existing_pairs: set[tuple[str, str]] = set()
    for row in words:
        reading = normalize(row["reading_kana"])
        for form in [row["surface"], *parse_alt_forms(row.get("alt_forms"))]:
            if normalized_form := dedupe_form(form):
                existing_pairs.add((normalized_form, reading))
    existing_semantic = {
        (normalize(row["reading_kana"]), compact_meaning(row["meaning_ko"]).split("/")[0])
        for row in words
    }

    raw_candidates = []
    for index, item in enumerate(catalog):
        level = str(item.get("level") or "")
        if deficits.get(level, 0) <= 0:
            continue
        reading = normalize(item.get("entry"))
        forms = split_naver_forms(item.get("pron")) or ([reading] if reading else [])
        meaning = korean_meaning(item.get("means") or [])
        if not candidate_is_lexical(item, reading, forms, meaning):
            continue
        # A NAVER entry is already represented if *any* of its spellings is in
        # the app.  Never backfill a rare alternative spelling of an existing
        # word (e.g. 乾盃 when 乾杯 is already present).
        if any((dedupe_form(form), reading) in existing_pairs for form in forms):
            continue
        forms = [form for form in forms if not re.search(r"([一-龯])\1", form)]
        if not forms:
            continue
        if (reading, compact_meaning(meaning).split("/")[0]) in existing_semantic:
            continue
        raw_candidates.append({
            "catalog_index": index,
            "item": item,
            "level": level,
            "reading": reading,
            "forms": forms,
            "meaning": meaning,
        })

    candidate_pairs = {
        (form, candidate["reading"])
        for candidate in raw_candidates for form in candidate["forms"]
    }
    existing_pair_meanings: dict[tuple[str, str], set[str]] = {}
    for row in words:
        reading = normalize(row["reading_kana"])
        for form in [row["surface"], *parse_alt_forms(row.get("alt_forms")), row["reading_kana"]]:
            if normalized_form := normalize(form):
                existing_pair_meanings.setdefault((normalized_form, reading), set()).add(row["meaning_ko"])
    existing_jmdict_pairs = set(existing_pair_meanings)
    jmdict = load_jmdict_metadata(args.jmdict, candidate_pairs | existing_jmdict_pairs)
    sequence_existing_meanings: dict[str, set[str]] = {}
    for pair, meanings in existing_pair_meanings.items():
        for sequence in jmdict.get(pair, {}).get("sequences", set()):
            sequence_existing_meanings.setdefault(sequence, set()).update(meanings)
    eligible = []
    rejection_counts = Counter()
    for candidate in raw_candidates:
        accepted_forms = []
        for form_index, form in enumerate(candidate["forms"]):
            metadata = jmdict.get((form, candidate["reading"]))
            if not metadata:
                continue
            if set(metadata["info"]) & DISCOURAGED_KANJI_INFO:
                continue
            accepted_forms.append((form, form_index, metadata))
        if not accepted_forms:
            rejection_counts["no_modern_jmdict_exact_form"] += 1
            continue
        collided_meanings = {
            existing_meaning
            for _form, _index, metadata in accepted_forms
            for sequence in metadata.get("sequences", set())
            for existing_meaning in sequence_existing_meanings.get(sequence, set())
        }
        if any(meanings_overlap(candidate["meaning"], value) for value in collided_meanings):
            rejection_counts["existing_jmdict_lexeme"] += 1
            continue
        accepted_forms.sort(key=lambda value: (
            -priority_score(value[2]["priority"]),
            value[1],
            -zipf_frequency(value[0], "ja"),
            len(value[0]),
            value[0],
        ))
        surface, _form_index, metadata = accepted_forms[0]
        pair = (dedupe_form(surface), candidate["reading"])
        candidate.update({
            "surface": surface,
            "jmdict_priority": metadata["priority"],
            "priority_score": priority_score(metadata["priority"]),
            "frequency": zipf_frequency(surface, "ja") or zipf_frequency(candidate["reading"], "ja"),
            "pair": pair,
            "id": stable_word_id(surface, candidate["reading"]),
        })
        eligible.append(candidate)

    selected = []
    selected_pairs = set(existing_pairs)
    selected_semantic = set(existing_semantic)
    for level in LEVELS:
        if deficits[level] == 0:
            continue
        pool = sorted(
            (candidate for candidate in eligible if candidate["level"] == level),
            key=lambda candidate: (
                -candidate["priority_score"],
                -candidate["frequency"],
                candidate["catalog_index"],
                candidate["surface"],
                candidate["reading"],
            ),
        )
        for candidate in pool:
            if len([item for item in selected if item["level"] == level]) >= deficits[level]:
                break
            pair = candidate["pair"]
            if candidate["id"] in excluded_addition_ids:
                continue
            semantic = (candidate["reading"], compact_meaning(candidate["meaning"]).split("/")[0])
            if pair in selected_pairs or semantic in selected_semantic:
                continue
            selected.append(candidate)
            selected_pairs.add(pair)
            selected_semantic.add(semantic)
        picked = sum(item["level"] == level for item in selected)
        if picked != deficits[level]:
            available = sum(item["level"] == level for item in eligible)
            raise RuntimeError(
                f"{level} candidate pool exhausted: picked={picked}, need={deficits[level]}, "
                f"eligible={available}, rejections={dict(rejection_counts)}"
            )

    additions = []
    for candidate in selected:
        item = candidate["item"]
        row = {field: "" for field in WORD_FIELDS}
        row.update({
            "id": candidate["id"],
            "level": candidate["level"],
            "surface": candidate["surface"],
            "reading_kana": candidate["reading"],
            "furigana": candidate["reading"],
            "meaning_ko": candidate["meaning"],
            "part_of_speech": select_pos(item.get("parts") or []),
            "card_type": infer_card_type(candidate["surface"]),
            "alt_forms": json.dumps(
                [form for form in candidate["forms"] if form != candidate["surface"]],
                ensure_ascii=False, separators=(",", ":"),
            ) if len(candidate["forms"]) > 1 else "",
            "source": "naver:ja-dict-jlpt-list",
            "qa_status": "verified",
            "deprecated": "0",
            "tags": json.dumps(
                ["naver-level-backfill", "jmdict-exact", "ko-from-naver"],
                ensure_ascii=False, separators=(",", ":"),
            ),
            "data_version": "3",
            "frequency": f"{candidate['frequency']:.3f}",
        })
        example = addition_examples.get(row["id"])
        if example:
            row.update({
                "example_jp": example["jp"],
                "example_ko": example["ko"],
                "example_jp_author": example.get("attribution", ""),
                "example_license": example.get("license", ""),
            })
        if row["id"] in by_id:
            raise RuntimeError(f"stable ID collision: {row['id']} {candidate['pair']}")
        additions.append(row)
        by_id[row["id"]] = row
        words.append(row)

    for row in words:
        value = zipf_frequency(row["surface"], "ja") or zipf_frequency(row["reading_kana"], "ja")
        row["frequency"] = f"{value:.3f}"
    for level in LEVELS:
        level_rows = sorted(
            (row for row in words if row["level"] == level),
            key=lambda row: (-float(row["frequency"]), row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = str(index // 50 + 1)
    words.sort(key=lambda row: (
        LEVEL_RANK[row["level"]], int(row["reading_chapter"]),
        -float(row["frequency"]), row["surface"], row["id"],
    ))

    ids = [row["id"] for row in words]
    pairs = [(row["surface"], row["reading_kana"]) for row in words]
    counts = Counter(row["level"] for row in words)
    checks = {
        "word_count": len(words),
        "unique_ids": len(set(ids)),
        "unique_surface_reading_pairs": len(set(pairs)),
        "level_counts": dict(counts),
        "confirmed_movements": len(movements),
        "addition_count": len(additions),
        "addition_by_level": dict(Counter(row["level"] for row in additions)),
        "additions_missing_examples": sum(not row["example_jp"] or not row["example_ko"] for row in additions),
    }
    if len(words) != 7027 or len(set(ids)) != 7027 or len(set(pairs)) != 7027:
        raise RuntimeError(f"identity validation failed: {checks}")
    if dict(counts) != EXPECTED_FINAL_COUNTS:
        raise RuntimeError(f"level count validation failed: {checks}")
    if checks["additions_missing_examples"]:
        raise RuntimeError(f"new words lack approved examples: {checks}")

    final_ids = set(ids)
    final_examples = [dict(row) for row in base_examples]
    final_examples.extend(
        dict(addition_examples[row["id"]])
        for row in additions
        if row["id"] in addition_examples
    )
    final_examples.sort(key=lambda row: row["word_id"])
    if (
        len(final_examples) != 7027
        or len({row["word_id"] for row in final_examples}) != 7027
        or {row["word_id"] for row in final_examples} != final_ids
    ):
        raise RuntimeError("final example coverage is not exactly 7,027 unique active words")
    checks["example_count"] = len(final_examples)
    checks["example_coverage_percent"] = 100.0

    generated_at = datetime.now(timezone.utc).isoformat()
    document = {
        "generated_at": generated_at,
        "count": len(words),
        "source": str(args.words),
        "vocabulary": [{field: row.get(field, "") for field in WORD_FIELDS} for row in words],
    }
    manifest = {
        "generated_at": generated_at,
        "promoted": args.promote,
        "policy": {
            "level_source": "NAVER Japanese Dictionary JLPT badge/list",
            "movement": "Only 1,594 direct-search-confirmed mismatches move; 7 ambiguous entries stay unchanged.",
            "backfill": "Keep post-move surpluses and add only N3/N1 shortages to the former minimum counts.",
            "candidate_quality": "Global form+reading and semantic dedupe; lexical NAVER POS; modern exact JMdict form; frequency-ranked.",
        },
        "input_sha256": {
            "words": hashlib.sha256(args.words.read_bytes()).hexdigest(),
            "direct_audit": hashlib.sha256(args.direct_audit.read_bytes()).hexdigest(),
            "catalog": hashlib.sha256(args.catalog.read_bytes()).hexdigest(),
        },
        "summary": checks,
        "post_move_counts": dict(moved_counts),
        "deficits_filled": deficits,
        "eligible_candidate_counts": dict(Counter(item["level"] for item in eligible)),
        "rejection_counts": dict(rejection_counts),
        "excluded_addition_ids": sorted(excluded_addition_ids),
        "movements": movements,
        "additions": [
            {
                "id": row["id"], "level": row["level"], "surface": row["surface"],
                "reading_kana": row["reading_kana"], "meaning_ko": row["meaning_ko"],
                "part_of_speech": row["part_of_speech"], "frequency": row["frequency"],
            }
            for row in additions
        ],
    }
    write_csv(args.csv_out, words, WORD_FIELDS)
    args.json_out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(args.additions_out, additions, WORD_FIELDS)
    write_csv(args.examples_out, final_examples, EXAMPLE_FIELDS)
    args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    promoted_outputs: dict[str, str] = {}
    if args.promote:
        final_words_csv = DATA / "jlpt_final_wordlist.csv"
        final_words_json = DATA / "jlpt_final_wordlist.json"
        final_examples_csv = DATA / "examples_final_qa_work.csv"
        final_naver_examples_csv = DATA / "naver_examples_final_qa_work.csv"
        naver_examples = [
            row for row in final_examples
            if row.get("source") == "naver-ja-dict"
            and row.get("permission_status") == "cleared"
        ]
        write_csv(final_words_csv, words, WORD_FIELDS)
        final_words_json.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        write_csv(final_examples_csv, final_examples, EXAMPLE_FIELDS)
        write_csv(final_naver_examples_csv, naver_examples, EXAMPLE_FIELDS)
        promoted_outputs = {
            "words": str(final_words_csv),
            "json": str(final_words_json),
            "examples": str(final_examples_csv),
            "naver_examples": str(final_naver_examples_csv),
        }
    print(json.dumps({
        "outputs": {
            "words": str(args.csv_out), "json": str(args.json_out),
            "additions": str(args.additions_out), "manifest": str(args.manifest_out),
            "examples": str(args.examples_out),
        },
        "promoted_outputs": promoted_outputs,
        **checks,
        "eligible_candidate_counts": manifest["eligible_candidate_counts"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
