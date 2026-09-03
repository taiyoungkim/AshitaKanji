#!/usr/bin/env python3
"""Audit every final JLPT headword against JMdict and local duplicate rules.

This is deliberately a reporting pass.  It does not mutate the release word
list.  The generated JSON keeps one row per app word so mixed spellings,
dictionary-form misses, and same-entry spelling duplicates can be reviewed
before a canonicalization pass changes stable IDs or audio ownership.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
HIRAGANA_RE = re.compile(r"[ぁ-ゟ]")
KATAKANA_RE = re.compile(r"[ァ-ヿー]")
POLITE_OR_PHRASE_RE = re.compile(
    r"(?:です|でした|ではない|じゃない|ます|ました|ません|ましょう|"
    r"たい|たくない|ている|てある|てください|ないで|ずに|こと)$"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--words",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_final_wordlist.csv"),
    )
    parser.add_argument(
        "--examples",
        type=Path,
        default=Path("data/pdf-vocab/examples_final_qa_work.csv"),
    )
    parser.add_argument("--jmdict", type=Path, default=Path(".cache/JMdict_e.gz"))
    parser.add_argument(
        "--prior-overrides",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_orthography_overrides.json"),
    )
    parser.add_argument(
        "--prior-audit",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_orthography_audit.csv"),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/pdf-vocab/jlpt_all_headword_audit.json"),
    )
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def form_priority(codes: list[str], info: list[str]) -> int:
    score = 0
    for code in codes:
        if code == "spec1":
            score += 130
        elif code == "ichi1":
            score += 120
        elif code in {"news1", "gai1"}:
            score += 100
        elif code.startswith("nf"):
            try:
                score += max(1, 55 - int(code[2:]))
            except ValueError:
                score += 5
        elif code.endswith("2"):
            score += 20
    if any(
        marker in value
        for value in info
        for marker in ("search-only", "rare", "out-dated", "obsolete")
    ):
        score -= 200
    return score


def surface_class(surface: str) -> str:
    has_kanji = bool(KANJI_RE.search(surface))
    has_hiragana = bool(HIRAGANA_RE.search(surface))
    has_katakana = bool(KATAKANA_RE.search(surface))
    if has_kanji and has_hiragana:
        return "kanji-hiragana"
    if has_kanji and has_katakana:
        return "kanji-katakana"
    if has_kanji:
        return "kanji"
    if has_hiragana and has_katakana:
        return "mixed-kana"
    if has_hiragana:
        return "hiragana"
    if has_katakana:
        return "katakana"
    return "other"


def kanji_count(value: str) -> int:
    return len(KANJI_RE.findall(value))


def load_jmdict(path: Path, readings: set[str]) -> dict[str, list[dict[str, Any]]]:
    by_reading: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            reading_nodes = entry.findall("r_ele")
            relevant = [
                node for node in reading_nodes if (node.findtext("reb") or "") in readings
            ]
            if not relevant:
                entry.clear()
                continue
            forms = [
                {
                    "surface": node.findtext("keb") or "",
                    "priority_codes": [item.text or "" for item in node.findall("ke_pri")],
                    "info": [item.text or "" for item in node.findall("ke_inf")],
                }
                for node in entry.findall("k_ele")
            ]
            for form in forms:
                form["priority"] = form_priority(form["priority_codes"], form["info"])
                form["kanji_count"] = kanji_count(form["surface"])
            senses = [
                {
                    "gloss": [item.text or "" for item in sense.findall("gloss")][:8],
                    "pos": [item.text or "" for item in sense.findall("pos")],
                    "misc": [item.text or "" for item in sense.findall("misc")],
                }
                for sense in entry.findall("sense")
            ]
            usually_kana = any(
                "usually written using kana alone" in marker
                for sense in senses
                for marker in sense["misc"]
            )
            for node in relevant:
                reading = node.findtext("reb") or ""
                restrictions = {item.text or "" for item in node.findall("re_restr")}
                applicable = [
                    form for form in forms
                    if not restrictions or form["surface"] in restrictions
                ]
                by_reading[reading].append(
                    {
                        "sequence": entry.findtext("ent_seq") or "",
                        "forms": applicable,
                        "reading_priority": [
                            item.text or "" for item in node.findall("re_pri")
                        ],
                        "no_kanji": node.find("re_nokanji") is not None,
                        "usually_kana": usually_kana,
                        "senses": senses,
                    }
                )
            entry.clear()
    return by_reading


def load_jmdict_surface_readings(
    path: Path, surfaces: set[str]
) -> dict[str, list[dict[str, Any]]]:
    """Return dictionary readings for current surfaces, including wrong-pair clues."""
    by_surface: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            matching_forms = [
                node for node in entry.findall("k_ele")
                if (node.findtext("keb") or "") in surfaces
            ]
            if not matching_forms:
                entry.clear()
                continue
            senses = [
                {
                    "gloss": [item.text or "" for item in sense.findall("gloss")][:8],
                    "misc": [item.text or "" for item in sense.findall("misc")],
                }
                for sense in entry.findall("sense")
            ]
            usually_kana = any(
                "usually written using kana alone" in marker
                for sense in senses
                for marker in sense["misc"]
            )
            for form_node in matching_forms:
                surface = form_node.findtext("keb") or ""
                readings_for_form: list[str] = []
                for reading_node in entry.findall("r_ele"):
                    restrictions = {
                        item.text or "" for item in reading_node.findall("re_restr")
                    }
                    if restrictions and surface not in restrictions:
                        continue
                    reading = reading_node.findtext("reb") or ""
                    if reading:
                        readings_for_form.append(reading)
                by_surface[surface].append(
                    {
                        "sequence": entry.findtext("ent_seq") or "",
                        "readings": sorted(set(readings_for_form)),
                        "priority": form_priority(
                            [item.text or "" for item in form_node.findall("ke_pri")],
                            [item.text or "" for item in form_node.findall("ke_inf")],
                        ),
                        "usually_kana": usually_kana,
                        "gloss": [
                            gloss
                            for sense in senses[:3]
                            for gloss in sense["gloss"][:3]
                        ][:8],
                    }
                )
            entry.clear()
    return by_surface


def compact_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "sequence": entry["sequence"],
        "forms": [form["surface"] for form in entry["forms"]],
        "usually_kana": entry["usually_kana"],
        "gloss": [
            gloss
            for sense in entry["senses"][:3]
            for gloss in sense["gloss"][:3]
        ][:8],
    }


def main() -> None:
    args = parse_args()
    words = read_csv(args.words)
    examples = {row["word_id"]: row for row in read_csv(args.examples)}
    if len(words) != 7027:
        raise RuntimeError(f"expected 7027 words, found {len(words)}")
    if len({row["id"] for row in words}) != len(words):
        raise RuntimeError("duplicate word IDs in input")

    readings = {row["reading_kana"] for row in words}
    lookup_readings = readings | {
        reading + suffix
        for reading in readings
        for suffix in ("い", "る", "する", "だ")
    }
    jmdict = load_jmdict(args.jmdict, lookup_readings)
    jmdict_by_surface = load_jmdict_surface_readings(
        args.jmdict, {row["surface"] for row in words}
    )
    prior_doc = json.loads(args.prior_overrides.read_text(encoding="utf-8"))
    prior = prior_doc.get("overrides", {})
    prior_audit = {row["id"]: row for row in read_csv(args.prior_audit)}

    base_rows: list[dict[str, Any]] = []
    exact_sequence_rows: dict[tuple[str, str], list[str]] = defaultdict(list)
    same_reading_meaning: dict[tuple[str, str], list[str]] = defaultdict(list)

    for word in words:
        surface = word["surface"]
        reading = word["reading_kana"]
        entries = jmdict.get(reading, [])
        form_entries = [
            entry for entry in entries
            if any(form["surface"] == surface for form in entry["forms"])
        ]
        kana_entries = entries if surface == reading else []
        exact_entries = form_entries or kana_entries
        exact_kind = "kanji-form" if form_entries else ("reading-form" if kana_entries else "none")
        safe_sequences = sorted({entry["sequence"] for entry in form_entries})
        for sequence in safe_sequences:
            exact_sequence_rows[(reading, sequence)].append(word["id"])
        same_reading_meaning[(reading, word["meaning_ko"].strip())].append(word["id"])

        alternatives_by_surface: dict[str, dict[str, Any]] = {}
        alternative_source = exact_entries if exact_entries else entries
        for entry in alternative_source:
            for form in entry["forms"]:
                current = alternatives_by_surface.get(form["surface"])
                candidate = {
                    "surface": form["surface"],
                    "priority": form["priority"],
                    "kanji_count": form["kanji_count"],
                    "sequences": [entry["sequence"]],
                    "info": form["info"],
                    "usually_kana": entry["usually_kana"],
                }
                if current is None:
                    alternatives_by_surface[form["surface"]] = candidate
                else:
                    current["priority"] = max(current["priority"], form["priority"])
                    current["sequences"] = sorted(
                        set(current["sequences"] + [entry["sequence"]])
                    )
                    current["info"] = sorted(set(current["info"] + form["info"]))
                    current["usually_kana"] = (
                        current["usually_kana"] and entry["usually_kana"]
                    )

        alternatives = sorted(
            alternatives_by_surface.values(),
            key=lambda item: (-item["priority"], -item["kanji_count"], item["surface"]),
        )
        more_kanji = [
            item for item in alternatives
            if item["kanji_count"] > kanji_count(surface)
            and item["surface"] != surface
        ]

        flags: list[str] = []
        klass = surface_class(surface)
        if exact_kind == "none":
            flags.append("non-jmdict-surface")
        surface_entries = jmdict_by_surface.get(surface, [])
        surface_dictionary_readings = sorted(
            {
                candidate_reading
                for entry in surface_entries
                for candidate_reading in entry["readings"]
            }
        )
        if exact_kind == "none" and surface_dictionary_readings:
            flags.append("surface-reading-mismatch")
        if klass == "kanji-hiragana" and more_kanji:
            flags.append("mixed-has-more-kanji-variant")
        if klass == "hiragana" and more_kanji:
            flags.append("kana-has-kanji-variant")
        if POLITE_OR_PHRASE_RE.search(surface):
            flags.append("polite-or-phrase-form")

        appended_candidates: list[str] = []
        for suffix in ("い", "る", "する", "だ"):
            if jmdict.get(reading + suffix):
                for entry in jmdict[reading + suffix]:
                    for form in entry["forms"]:
                        if form["surface"] == surface + suffix:
                            appended_candidates.append(form["surface"])
        if (
            appended_candidates
            and exact_kind == "none"
            and word.get("part_of_speech", "") in {"verb", "adjective"}
            and not surface.endswith("に")
        ):
            flags.append("possible-truncated-headword")

        near_candidates: list[str] = []
        if exact_kind == "none":
            for item in alternatives:
                candidate_surface = item["surface"]
                similarity = SequenceMatcher(None, surface, candidate_surface).ratio()
                if (
                    similarity >= 0.66
                    or surface in candidate_surface
                    or candidate_surface in surface
                ):
                    near_candidates.append(candidate_surface)
            if near_candidates:
                flags.append("near-jmdict-spelling")
            if len(alternatives) == 1 and alternatives[0]["kanji_count"]:
                flags.append("single-jmdict-kanji-candidate")

        example = examples.get(word["id"], {})
        base_rows.append(
            {
                "id": word["id"],
                "level": word["level"],
                "surface": surface,
                "reading_kana": reading,
                "meaning_ko": word["meaning_ko"],
                "part_of_speech": word.get("part_of_speech", ""),
                "card_type": word.get("card_type", ""),
                "source": word.get("source", ""),
                "surface_class": klass,
                "kanji_count": kanji_count(surface),
                "jmdict_exact_kind": exact_kind,
                "jmdict_exact_sequences": safe_sequences,
                "jmdict_entries": [compact_entry(entry) for entry in exact_entries[:8]],
                "jmdict_surface_entries": surface_entries[:8],
                "jmdict_surface_readings": surface_dictionary_readings,
                "alternative_forms": alternatives[:20],
                "more_kanji_candidates": more_kanji[:12],
                "appended_dictionary_candidates": sorted(set(appended_candidates)),
                "near_jmdict_candidates": sorted(set(near_candidates)),
                "flags": flags,
                "prior_override": prior.get(word["id"]),
                "prior_audit_decision": prior_audit.get(word["id"], {}).get(
                    "decision", ""
                ),
                "prior_audit_evidence": prior_audit.get(word["id"], {}).get(
                    "evidence", ""
                ),
                "example_jp": example.get("jp", word.get("example_jp", "")),
                "review_decision": "",
                "review_surface": "",
                "review_reason": "",
            }
        )

    by_id = {row["id"]: row for row in base_rows}
    for row in base_rows:
        duplicate_ids: set[str] = set()
        for sequence in row["jmdict_exact_sequences"]:
            duplicate_ids.update(exact_sequence_rows[(row["reading_kana"], sequence)])
        duplicate_ids.discard(row["id"])
        row["same_jmdict_entry_ids"] = sorted(duplicate_ids)
        if duplicate_ids:
            row["flags"].append("same-jmdict-entry-duplicate")

        semantic_ids = set(
            same_reading_meaning[(row["reading_kana"], row["meaning_ko"].strip())]
        )
        semantic_ids.discard(row["id"])
        row["same_reading_meaning_ids"] = sorted(semantic_ids)
        if semantic_ids:
            row["flags"].append("same-reading-meaning-duplicate")

        row["flags"] = list(dict.fromkeys(row["flags"]))
        row["attention"] = (
            "high"
            if any(
                flag in row["flags"]
                for flag in (
                    "same-jmdict-entry-duplicate",
                    "non-jmdict-surface",
                    "possible-truncated-headword",
                )
            )
            else "medium" if row["flags"] else "none"
        )

    flag_counts = Counter(flag for row in base_rows for flag in row["flags"])
    attention_counts = Counter(row["attention"] for row in base_rows)
    class_counts = Counter(row["surface_class"] for row in base_rows)
    reviewed_ids = {row["id"] for row in base_rows}
    dangling = sorted(
        linked_id
        for row in base_rows
        for linked_id in row["same_jmdict_entry_ids"]
        if linked_id not in reviewed_ids
    )
    if dangling:
        raise RuntimeError(f"dangling duplicate IDs: {dangling[:5]}")

    document = {
        "schema_version": 1,
        "input": str(args.words),
        "jmdict": str(args.jmdict),
        "total_words": len(base_rows),
        "summary": {
            "attention": dict(sorted(attention_counts.items())),
            "surface_class": dict(sorted(class_counts.items())),
            "flags": dict(sorted(flag_counts.items())),
        },
        "rows": sorted(
            base_rows,
            key=lambda row: (
                {"high": 0, "medium": 1, "none": 2}[row["attention"]],
                row["level"],
                row["reading_kana"],
                row["surface"],
                row["id"],
            ),
        ),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(document["summary"], ensure_ascii=False, indent=2))
    print(f"wrote {len(base_rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
