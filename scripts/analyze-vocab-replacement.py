#!/usr/bin/env python3
"""Rank current non-core JLPT words for pre-release replacement.

The PDF-derived core vocabulary is always protected.  Existing non-core rows
are scored using duplicate/variant relationships, JMdict usage metadata,
general Zipf frequency, example availability, and the existing Korean-gloss
audit.  The result is a review plan only; this script never mutates jlpt.db.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


LEVELS = ("N5", "N4", "N3", "N2", "N1")
KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
PRIORITY_TOP = {"news1", "ichi1", "spec1", "gai1"}
PRIORITY_SECOND = {"news2", "ichi2", "spec2", "gai2"}
SEVERE_INFO_TERMS = (
    "search-only",
    "rarely used",
    "obsolete",
    "archaic",
    "out-dated",
    "outdated",
    "incorrect",
    "irregular kana",
    "irregular okurigana",
)
RARE_INFO_TERMS = SEVERE_INFO_TERMS + (
    "dated term",
    "historical term",
    "obscure term",
)


@dataclass
class UnionFind:
    parent: dict[str, str]

    @classmethod
    def create(cls, ids: Iterable[str]) -> "UnionFind":
        return cls({word_id: word_id for word_id in ids})

    def find(self, word_id: str) -> str:
        parent = self.parent[word_id]
        if parent != word_id:
            self.parent[word_id] = self.find(parent)
        return self.parent[word_id]

    def union(self, left: str, right: str) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=Path("assets/jlpt.db"))
    parser.add_argument(
        "--core", type=Path, default=Path("data/pdf-vocab/jlpt_app_vocab.csv")
    )
    parser.add_argument("--jmdict", type=Path, default=Path(".cache/JMdict_e.gz"))
    parser.add_argument(
        "--audit", type=Path, default=Path("data/track-a/vocab_audit_flagged.csv")
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/pdf-vocab/replacement_candidates.json"),
    )
    return parser.parse_args()


def load_words(db_path: Path) -> dict[str, dict[str, Any]]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    query = """
        SELECT
          w.*,
          CASE WHEN
            (w.example_jp IS NOT NULL AND TRIM(w.example_jp) <> '') OR
            EXISTS (
              SELECT 1
              FROM word_example e
              WHERE e.word_id = w.id
                AND e.qa_status <> 'rejected'
                AND e.permission_status IN ('cleared', 'self')
            )
          THEN 1 ELSE 0 END AS has_example
        FROM word w
        WHERE w.deprecated = 0
    """
    rows = {row["id"]: dict(row) for row in connection.execute(query)}
    connection.close()
    return rows


def load_core(core_path: Path) -> tuple[list[dict[str, str]], set[str]]:
    with core_path.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    return rows, {row["existing_word_id"] for row in rows if row["existing_word_id"]}


def load_audit(audit_path: Path) -> dict[str, str]:
    if not audit_path.exists():
        return {}
    with audit_path.open(encoding="utf-8-sig", newline="") as stream:
        return {row["id"]: row["reason"] for row in csv.DictReader(stream)}


def priority_score(codes: Iterable[str]) -> int:
    best = 0
    for code in codes:
        if code in PRIORITY_TOP:
            best = max(best, 100)
        elif code in PRIORITY_SECOND:
            best = max(best, 70)
        elif re.fullmatch(r"nf\d\d", code):
            best = max(best, max(1, 60 - int(code[2:])))
    return best


def contains_term(values: Iterable[str], terms: tuple[str, ...]) -> bool:
    normalized = " | ".join(values).lower()
    return any(term in normalized for term in terms)


def load_jmdict_signals(
    jmdict_path: Path,
    words: dict[str, dict[str, Any]],
) -> tuple[dict[tuple[str, str], list[dict[str, Any]]], dict[str, set[str]]]:
    pair_to_ids: dict[tuple[str, str], list[str]] = defaultdict(list)
    for word_id, word in words.items():
        pair_to_ids[(word["surface"], word["reading_kana"])].append(word_id)

    wanted_pairs = set(pair_to_ids)
    pair_matches: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    entry_members: dict[str, set[str]] = defaultdict(set)

    with gzip.open(jmdict_path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue

            sequence = entry.findtext("ent_seq") or ""
            kanji_forms: dict[str, tuple[list[str], list[str]]] = {}
            for item in entry.findall("k_ele"):
                surface = item.findtext("keb") or ""
                kanji_forms[surface] = (
                    [node.text or "" for node in item.findall("ke_pri")],
                    [node.text or "" for node in item.findall("ke_inf")],
                )

            sense_info = sorted(
                {
                    node.text or ""
                    for sense in entry.findall("sense")
                    for node in (*sense.findall("misc"), *sense.findall("s_inf"))
                }
            )

            for reading_item in entry.findall("r_ele"):
                reading = reading_item.findtext("reb") or ""
                restrictions = {
                    node.text or "" for node in reading_item.findall("re_restr")
                }
                reading_priority = [
                    node.text or "" for node in reading_item.findall("re_pri")
                ]
                reading_info = [
                    node.text or "" for node in reading_item.findall("re_inf")
                ]

                applicable_forms: list[tuple[str, list[str], list[str]]] = []
                for surface, (kanji_priority, kanji_info) in kanji_forms.items():
                    if not restrictions or surface in restrictions:
                        applicable_forms.append((surface, kanji_priority, kanji_info))

                if not kanji_forms:
                    applicable_forms.append((reading, [], []))
                elif reading_item.find("re_nokanji") is not None:
                    applicable_forms.append((reading, [], []))

                for surface, kanji_priority, kanji_info in applicable_forms:
                    pair = (surface, reading)
                    if pair not in wanted_pairs:
                        continue
                    form_info = sorted(set(kanji_info + reading_info))
                    info = sorted(set(form_info + sense_info))
                    pair_matches[pair].append(
                        {
                            "sequence": sequence,
                            "priority": sorted(set(kanji_priority + reading_priority)),
                            "form_priority": sorted(
                                set(kanji_priority if surface != reading else reading_priority)
                            ),
                            "info": info,
                            # Sense-level labels can describe only a secondary
                            # meaning of an otherwise common word (e.g. 涼しい).
                            # Removal signals therefore use orthography/reading
                            # metadata only, while all info remains visible.
                            "rare": contains_term(form_info, RARE_INFO_TERMS),
                            "severe_info": contains_term(
                                form_info, SEVERE_INFO_TERMS
                            ),
                        }
                    )
                    entry_members[sequence].update(pair_to_ids[pair])

            entry.clear()

    return pair_matches, entry_members


def normalize_meaning(value: str) -> str:
    parts = [
        re.sub(r"\s+", "", part)
        for part in re.split(r"[,;，、/]", value or "")
        if part.strip()
    ]
    return "|".join(sorted(set(parts)))


def canonical_keep_key(word: dict[str, Any]) -> tuple[Any, ...]:
    frequency = word["frequency"] if word["frequency"] is not None else -1.0
    unmatched_kanji = bool(
        word["jmdict_exact_match"] == 0 and KANJI_RE.search(word["surface"])
    )
    return (
        int(word["is_core"]),
        -int(word["jmdict_severe_info"]),
        -int(unmatched_kanji),
        int(word["jmdict_form_priority_score"]),
        int(word["jmdict_priority_score"]),
        int(word["has_example"]),
        frequency,
        int("freq-core" in (word["tags"] or "")),
        -len(word["surface"]),
        word["id"],
    )


def add_variant_groups(
    words: dict[str, dict[str, Any]],
    entry_members: dict[str, set[str]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    union_find = UnionFind.create(words)
    edge_types: dict[frozenset[str], set[str]] = defaultdict(set)

    def connect(ids: list[str], kind: str) -> None:
        if len(ids) < 2:
            return
        first = ids[0]
        for other in ids[1:]:
            union_find.union(first, other)
            edge_types[frozenset((first, other))].add(kind)

    for ids in entry_members.values():
        connect(sorted(ids), "same_jmdict_entry")

    reading_meaning_groups: dict[tuple[str, str], list[str]] = defaultdict(list)
    for word_id, word in words.items():
        reading_meaning_groups[
            (word["reading_kana"], normalize_meaning(word["meaning_ko"]))
        ].append(word_id)
    for ids in reading_meaning_groups.values():
        connect(sorted(ids), "same_reading_meaning")

    surface_groups: dict[str, list[str]] = defaultdict(list)
    for word_id, word in words.items():
        surface_groups[word["surface"]].append(word_id)
    for ids in surface_groups.values():
        for left_index, left_id in enumerate(ids):
            for right_id in ids[left_index + 1 :]:
                left_reading = words[left_id]["reading_kana"]
                right_reading = words[right_id]["reading_kana"]
                if left_reading + "する" == right_reading or right_reading + "する" == left_reading:
                    connect([left_id, right_id], "noun_suru_variant")

    grouped: dict[str, list[str]] = defaultdict(list)
    for word_id in words:
        grouped[union_find.find(word_id)].append(word_id)

    member_signals: dict[str, dict[str, Any]] = {}
    variant_groups: list[dict[str, Any]] = []
    group_number = 0
    for ids in sorted(grouped.values(), key=lambda values: min(values)):
        if len(ids) < 2:
            continue
        group_number += 1
        ids = sorted(ids)
        canonical_id = max(ids, key=lambda word_id: canonical_keep_key(words[word_id]))
        core_members = sorted(word_id for word_id in ids if words[word_id]["is_core"])

        group_kinds: set[str] = set()
        for left_index, left_id in enumerate(ids):
            for right_id in ids[left_index + 1 :]:
                group_kinds.update(edge_types.get(frozenset((left_id, right_id)), set()))

        group_id = f"vg_{group_number:03d}"
        variant_groups.append(
            {
                "group_id": group_id,
                "relationship": ",".join(sorted(group_kinds)),
                "canonical_word_id": canonical_id,
                "canonical_surface": words[canonical_id]["surface"],
                "canonical_reading": words[canonical_id]["reading_kana"],
                "canonical_is_core": int(words[canonical_id]["is_core"]),
                "core_member_count": len(core_members),
                "member_count": len(ids),
                "members": [
                    {
                        "word_id": word_id,
                        "level": words[word_id]["level"],
                        "surface": words[word_id]["surface"],
                        "reading_kana": words[word_id]["reading_kana"],
                        "meaning_ko": words[word_id]["meaning_ko"],
                        "frequency": words[word_id]["frequency"],
                        "is_core": int(words[word_id]["is_core"]),
                        "is_canonical": int(word_id == canonical_id),
                    }
                    for word_id in ids
                ],
            }
        )
        for word_id in ids:
            member_signals[word_id] = {
                "variant_group_id": group_id,
                "variant_relationship": ",".join(sorted(group_kinds)),
                "variant_canonical_id": canonical_id,
                "variant_canonical_is_core": int(words[canonical_id]["is_core"]),
                "is_variant_canonical": int(word_id == canonical_id),
            }

    return member_signals, variant_groups


def frequency_points(frequency: float | None) -> tuple[int, str | None]:
    if frequency is None or frequency <= 0:
        return 40, "frequency_missing_or_zero"
    if frequency <= 1.5:
        return 32, "frequency_le_1_5"
    if frequency <= 2.0:
        return 26, "frequency_le_2_0"
    if frequency <= 2.5:
        return 20, "frequency_le_2_5"
    if frequency <= 3.0:
        return 12, "frequency_le_3_0"
    if frequency <= 3.5:
        return 6, "frequency_le_3_5"
    if frequency >= 4.5:
        return -20, None
    return 0, None


def score_word(word: dict[str, Any], audit_reason: str | None) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    if word.get("variant_group_id") and not word.get("is_variant_canonical"):
        score += 60
        reasons.append(word["variant_relationship"] or "variant_duplicate")
    if word["jmdict_severe_info"]:
        score += 50
        reasons.append("jmdict_uncommon_or_irregular")
    elif word["jmdict_rare"]:
        score += 35
        reasons.append("jmdict_rare_or_dated")
    if word["jmdict_exact_match"] == 0 and KANJI_RE.search(word["surface"]):
        score += 35
        reasons.append("jmdict_exact_pair_not_found")

    frequency_score, frequency_reason = frequency_points(word["frequency"])
    score += frequency_score
    if frequency_reason:
        reasons.append(frequency_reason)

    if word["jmdict_priority_score"] == 0:
        score += 12
        reasons.append("no_jmdict_priority")
    elif word["jmdict_priority_score"] >= 100:
        score -= 25
    else:
        score -= 12

    if word["has_example"]:
        score -= 25
    else:
        score += 6
        reasons.append("no_example")

    if "freq-core" in (word["tags"] or ""):
        score -= 30
    if "draft-ko-missing" in (word["tags"] or ""):
        score += 5
        reasons.append("weak_legacy_content")
    if audit_reason:
        score += 10
        reasons.append(f"legacy_gloss_audit:{audit_reason}")

    return score, sorted(set(reasons))


def confidence_for(word: dict[str, Any], reasons: list[str]) -> str:
    frequency = word["frequency"] if word["frequency"] is not None else 0.0
    duplicate = bool(word.get("variant_group_id") and not word.get("is_variant_canonical"))
    if duplicate and (
        word.get("variant_canonical_is_core")
        or word["jmdict_severe_info"]
        or "same_reading_meaning" in word.get("variant_relationship", "")
        or "noun_suru_variant" in word.get("variant_relationship", "")
    ):
        return "높음"
    if duplicate or word["jmdict_severe_info"] or word["jmdict_rare"]:
        return "중간"
    if "jmdict_exact_pair_not_found" in reasons and frequency <= 2.5:
        return "중간"
    if frequency <= 2.5 and word["jmdict_priority_score"] == 0 and not word["has_example"]:
        return "중간"
    return "낮음"


def recommended_action(word: dict[str, Any], confidence: str) -> str:
    duplicate = bool(word.get("variant_group_id") and not word.get("is_variant_canonical"))
    if duplicate:
        return "중복 변형 제거 검토"
    if word["jmdict_severe_info"] or word["jmdict_rare"]:
        return "표기 교정·교체 검토"
    frequency = word["frequency"] if word["frequency"] is not None else 0.0
    if frequency <= 2.5 and word["jmdict_priority_score"] == 0 and not word["has_example"]:
        return "저활용 제외 검토"
    if word["jmdict_exact_match"] == 0 and KANJI_RE.search(word["surface"]):
        return "데이터 정규화 검토"
    if confidence == "낮음":
        return "2차 보류"
    return "추가 검토"


def reason_korean(word: dict[str, Any], reasons: list[str]) -> str:
    labels = {
        "same_jmdict_entry": "동일 JMdict 표제어의 표기·읽기 변형",
        "same_reading_meaning": "읽기와 한국어 뜻이 같은 표기 변형",
        "noun_suru_variant": "명사형과 する형 중복",
        "jmdict_uncommon_or_irregular": "JMdict에서 희귀·비표준 표기로 표시",
        "jmdict_rare_or_dated": "JMdict에서 희귀·고어·구식 용례로 표시",
        "jmdict_exact_pair_not_found": "현재 표기+읽기 조합을 JMdict에서 확인하지 못함",
        "frequency_missing_or_zero": "일반 사용 빈도가 없거나 0",
        "frequency_le_1_5": "일반 사용 빈도 매우 낮음(Zipf ≤ 1.5)",
        "frequency_le_2_0": "일반 사용 빈도 매우 낮음(Zipf ≤ 2.0)",
        "frequency_le_2_5": "일반 사용 빈도 낮음(Zipf ≤ 2.5)",
        "frequency_le_3_0": "일반 사용 빈도 낮은 편(Zipf ≤ 3.0)",
        "frequency_le_3_5": "일반 사용 빈도 보통 이하(Zipf ≤ 3.5)",
        "no_jmdict_priority": "JMdict 우선 어휘 표지 없음",
        "no_example": "검증된 예문 없음",
        "weak_legacy_content": "기존 데이터의 한국어 콘텐츠 보강 필요 태그",
    }
    output: list[str] = []
    for reason in reasons:
        if reason.startswith("legacy_gloss_audit:"):
            output.append("기존 한국어 뜻 품질 감사 대상")
            continue
        for part in reason.split(","):
            if part in labels and labels[part] not in output:
                output.append(labels[part])
    return "; ".join(output[:4])


def main() -> None:
    args = parse_args()
    words = load_words(args.db)
    core_rows, core_ids = load_core(args.core)
    audit = load_audit(args.audit)

    missing_core_ids = sorted(core_ids - set(words))
    if missing_core_ids:
        raise RuntimeError(f"core existing IDs missing from DB: {missing_core_ids[:10]}")

    pair_matches, entry_members = load_jmdict_signals(args.jmdict, words)
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
                "jmdict_priority_score": priority_score(priority_codes),
                "jmdict_form_priority": form_priority_codes,
                "jmdict_form_priority_score": priority_score(form_priority_codes),
                "jmdict_info": info,
                "jmdict_rare": int(any(match["rare"] for match in matches)),
                "jmdict_severe_info": int(
                    any(match["severe_info"] for match in matches)
                ),
            }
        )

    variant_signals, variant_groups = add_variant_groups(words, entry_members)
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
        score, reasons = score_word(word, audit.get(word_id))
        word["retire_score"] = score
        word["reason_codes"] = reasons
        word["reason_ko"] = reason_korean(word, reasons)
        word["confidence"] = confidence_for(word, reasons)
        word["recommended_action"] = recommended_action(
            word, word["confidence"]
        )
        word["audit_reason"] = audit.get(word_id, "")

    current_counts = Counter(word["level"] for word in words.values())
    core_primary_counts = Counter(row["primary_level"] for row in core_rows)
    existing_core_counts = Counter(
        word["level"] for word in words.values() if word["is_core"]
    )
    noncore_counts = {
        level: current_counts[level] - existing_core_counts[level] for level in LEVELS
    }
    required_removals = len(core_rows) - len(core_ids)
    pool = [
        word
        for word in words.values()
        if not word["is_core"] and not word.get("is_variant_canonical")
    ]
    pool.sort(
        key=lambda word: (
            -word["retire_score"],
            word["frequency"] if word["frequency"] is not None else -1.0,
            LEVELS.index(word["level"]),
            word["id"],
        )
    )
    if len(pool) < required_removals:
        raise RuntimeError(
            f"not enough non-core candidates: required={required_removals}, pool={len(pool)}"
        )

    selected: list[dict[str, Any]] = []
    level_ranks: Counter[str] = Counter()
    for word in pool[:required_removals]:
            level_ranks[word["level"]] += 1
            level_rank = level_ranks[word["level"]]
            canonical = words.get(word.get("variant_canonical_id", ""), {})
            stage = {
                "높음": "1차 제외 추천",
                "중간": "1차 검토 후보",
                "낮음": "2차 보류",
            }[word["confidence"]]
            selected.append(
                {
                    "level_rank": level_rank,
                    "word_id": word["id"],
                    "level": word["level"],
                    "surface": word["surface"],
                    "reading_kana": word["reading_kana"],
                    "meaning_ko": word["meaning_ko"],
                    "part_of_speech": word["part_of_speech"] or "",
                    "frequency": word["frequency"],
                    "has_example": int(word["has_example"]),
                    "retire_score": word["retire_score"],
                    "confidence": word["confidence"],
                    "candidate_stage": stage,
                    "recommended_action": word["recommended_action"],
                    "reason_ko": word["reason_ko"],
                    "reason_codes": ",".join(word["reason_codes"]),
                    "variant_group_id": word.get("variant_group_id", ""),
                    "variant_relationship": word.get("variant_relationship", ""),
                    "canonical_word_id": canonical.get("id", ""),
                    "canonical_surface": canonical.get("surface", ""),
                    "canonical_reading": canonical.get("reading_kana", ""),
                    "canonical_is_core": int(canonical.get("is_core", 0)),
                    "jmdict_exact_match": word["jmdict_exact_match"],
                    "jmdict_priority": ",".join(word["jmdict_priority"]),
                    "jmdict_priority_score": word["jmdict_priority_score"],
                    "jmdict_form_priority": ",".join(
                        word["jmdict_form_priority"]
                    ),
                    "jmdict_form_priority_score": word[
                        "jmdict_form_priority_score"
                    ],
                    "jmdict_info": " | ".join(word["jmdict_info"]),
                    "legacy_gloss_audit": word["audit_reason"],
                    "legacy_tags": word["tags"] or "",
                    "review_decision": "검토 필요",
                    "review_note": "",
                }
            )

    for index, row in enumerate(selected, start=1):
        row["selected_rank"] = index

    selected_ids = {row["word_id"] for row in selected}
    selected_counts = Counter(row["level"] for row in selected)
    confidence_counts = Counter(row["confidence"] for row in selected)
    stage_counts = Counter(row["candidate_stage"] for row in selected)
    action_counts = Counter(row["recommended_action"] for row in selected)
    duplicate_selected = sum(bool(row["variant_group_id"]) for row in selected)
    severe_selected = sum("jmdict_uncommon_or_irregular" in row["reason_codes"] for row in selected)
    rare_selected = sum("jmdict_rare_or_dated" in row["reason_codes"] for row in selected)
    low_frequency_selected = sum(
        row["frequency"] is None or row["frequency"] <= 2.5 for row in selected
    )

    quota_rows = {}
    for level in LEVELS:
        removed = selected_counts[level]
        retained_supplement = noncore_counts[level] - removed
        quota_rows[level] = {
            "current": current_counts[level],
            "core_final": core_primary_counts[level],
            "core_existing": existing_core_counts[level],
            "noncore_pool": noncore_counts[level],
            "supplement_keep": retained_supplement,
            "remove": removed,
            "final_after_swap": core_primary_counts[level] + retained_supplement,
        }

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "database": str(args.db),
            "pdf_core": str(args.core),
            "jmdict": str(args.jmdict),
            "legacy_gloss_audit": str(args.audit),
        },
        "summary": {
            "current_active": len(words),
            "pdf_core_total": len(core_rows),
            "pdf_core_existing": len(core_ids),
            "pdf_core_new": len(core_rows) - len(core_ids),
            "required_removals": required_removals,
            "selected_removals": len(selected),
            "exact_surface_reading_duplicate_rows": 0,
            "variant_groups": len(variant_groups),
            "variant_candidates_selected": duplicate_selected,
            "jmdict_severe_selected": severe_selected,
            "jmdict_rare_selected": rare_selected,
            "frequency_le_2_5_selected": low_frequency_selected,
            "confidence_counts": dict(confidence_counts),
            "stage_counts": dict(stage_counts),
            "action_counts": dict(action_counts),
            "core_selected_by_mistake": len(selected_ids & core_ids),
        },
        "quotas": quota_rows,
        "rules": [
            "PDF 최빈출 기존 일치 단어는 무조건 보호",
            "변형 그룹마다 대표 표제어 최소 1개 보호",
            "동일 JMdict 표제어·동일 읽기/뜻·명사/する 변형을 우선 후보화",
            "JMdict 희귀/비표준 표기, 낮은 Zipf 빈도, 예문 없음 순으로 제거 점수 가산",
            "JMdict 우선 어휘, 검증 예문, 기존 freq-core 태그는 제거 점수 감산",
            "급수별 기존 개수는 강제하지 않음: 고빈도 초급 단어를 보호하고 전체 점수로 1,346개 선정",
            "낮음 신뢰도는 전체 수량을 맞추기 위한 상대적 하위 후보이므로 2차 보류",
        ],
        "candidates": selected,
        "variant_groups": variant_groups,
    }

    if output["summary"]["core_selected_by_mistake"]:
        raise RuntimeError("a protected PDF core word was selected")
    if len(selected) != required_removals:
        raise RuntimeError("global removal count mismatch")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output["summary"], ensure_ascii=False, indent=2))
    print(json.dumps(output["quotas"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
