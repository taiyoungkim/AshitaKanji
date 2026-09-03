#!/usr/bin/env python3
"""Rank auto-drafted Korean kanji meanings for manual semantic review."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / "assets" / "jlpt.db"
DEFAULT_QA = ROOT / "data" / "track-a" / "kanji_qa_work.csv"
DEFAULT_REPORT = ROOT / "data" / "track-a" / "kanji_semantic_review_report.json"
DEFAULT_QUEUE = ROOT / "data" / "track-a" / "kanji_semantic_review_queue.csv"

DIGIT_RE = re.compile(r"\d")
MARKUP_RE = re.compile(r"[<>～~]|\([1-9]\)|（[1-9]）")
PAREN_RE = re.compile(r"[()（）]")
REGISTER_RE = re.compile(
    r"자동사|타동사|겸양어|존경어|속어|문어|구어|접두|접미|조수사|단위|행정구역|"
    r"문법|어조|강조|금속|원소|식물|동물|질병|성씨|지명"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--qa", type=Path, default=DEFAULT_QA)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_array(value: Any) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
    except (json.JSONDecodeError, TypeError):
        return []
    return [str(item).strip() for item in parsed if str(item).strip()] if isinstance(parsed, list) else []


def normalized_parts(values: list[str]) -> set[str]:
    result: set[str] = set()
    for value in values:
        for part in re.split(r"\s*[,;/·]\s*", value):
            cleaned = re.sub(r"\s+", "", part)
            if cleaned:
                result.add(cleaned)
    return result


def priority(score: int) -> str:
    if score >= 55:
        return "P0"
    if score >= 30:
        return "P1"
    if score > 0:
        return "P2"
    return "P3"


def relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def main() -> int:
    args = parse_args()
    for path in (args.db, args.qa):
        if not path.exists():
            raise SystemExit(f"Missing input: {path}")

    qa_rows = read_csv(args.qa)
    with sqlite3.connect(args.db) as conn:
        conn.row_factory = sqlite3.Row
        links = [
            dict(row)
            for row in conn.execute(
                """
                SELECT wk.literal, w.id, w.level, w.surface, w.reading_kana, w.meaning_ko
                FROM word_kanji wk
                JOIN word w ON w.id = wk.word_id
                WHERE w.deprecated = 0
                ORDER BY wk.literal, w.level, w.id
                """
            )
        ]

    words_by_literal: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in links:
        words_by_literal[str(row["literal"])].append(row)

    queue: list[dict[str, Any]] = []
    for row in qa_rows:
        if row.get("qa_status", "").strip() != "auto":
            continue
        literal = row.get("literal", "").strip()
        meanings_ko = parse_array(row.get("meanings_ko"))
        meanings_en = parse_array(row.get("meanings_en"))
        text = " / ".join(meanings_ko)
        linked = words_by_literal.get(literal, [])
        signals: list[tuple[str, int]] = []

        def flag(name: str, weight: int, condition: bool) -> None:
            if condition:
                signals.append((name, weight))

        flag("contains_digit", 45, bool(DIGIT_RE.search(text)))
        flag("grammar_or_enumeration_markup", 40, bool(MARKUP_RE.search(text)))
        flag("context_parentheses", 22, bool(PAREN_RE.search(text)))
        flag("register_or_domain_note", 18, bool(REGISTER_RE.search(text)))
        flag("long_phrase", 15, any(len(value) >= 18 for value in meanings_ko))
        flag("sentence_like", 12, any(len(value.split()) >= 4 for value in meanings_ko))

        compound_only = bool(linked) and all(item["surface"] != literal for item in linked)
        single_evidence = len(linked) == 1
        flag("single_compound_evidence", 28, compound_only and single_evidence)

        ko_parts = normalized_parts(meanings_ko)
        linked_parts = normalized_parts([str(item["meaning_ko"]) for item in linked])
        exact_linked_gloss = bool(ko_parts) and ko_parts <= linked_parts
        flag("copied_linked_word_gloss", 25, compound_only and exact_linked_gloss)
        flag("narrow_ko_vs_english", 8, len(meanings_en) >= 5 and len(meanings_ko) == 1)

        content_score = sum(weight for _, weight in signals)
        impact = min(15, round(math.log2(len(linked) + 1) * 3)) if content_score else 0
        score = min(100, content_score + impact)
        examples = [
            f'{item["level"]}:{item["surface"]}={item["meaning_ko"]}' for item in linked[:5]
        ]
        queue.append(
            {
                "priority": priority(score),
                "risk_score": score,
                "literal": literal,
                "meanings_ko": json.dumps(meanings_ko, ensure_ascii=False),
                "meanings_en": json.dumps(meanings_en, ensure_ascii=False),
                "signals": ";".join(name for name, _ in signals),
                "linked_word_count": len(linked),
                "linked_examples": " | ".join(examples),
                "qa_status": row.get("qa_status", "").strip(),
                "qa_note": row.get("qa_note", "").strip(),
            }
        )

    queue.sort(key=lambda item: (-item["risk_score"], item["literal"]))
    args.queue.parent.mkdir(parents=True, exist_ok=True)
    with args.queue.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(queue[0]))
        writer.writeheader()
        writer.writerows(queue)

    priority_counts = Counter(item["priority"] for item in queue)
    signal_counts = Counter(
        signal for item in queue for signal in item["signals"].split(";") if signal
    )
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Deterministic triage only; risk scores are not semantic correctness judgments.",
        "inputs": {"db": relative(args.db), "qa": relative(args.qa)},
        "output": relative(args.queue),
        "included_status": "auto",
        "excluded_statuses": ["verified", "needs_review", "rejected"],
        "total_queued": len(queue),
        "priority_counts": dict(sorted(priority_counts.items())),
        "signal_counts": dict(signal_counts.most_common()),
        "thresholds": {"P0": ">=55", "P1": "30-54", "P2": "1-29", "P3": "0"},
        "top_candidates": [
            {key: item[key] for key in ("priority", "risk_score", "literal", "meanings_ko", "signals", "linked_word_count", "linked_examples")}
            for item in queue[:50]
        ],
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Queued {len(queue)} auto kanji: " + ", ".join(f"{key}={priority_counts[key]}" for key in ("P0", "P1", "P2", "P3")))
    print(f"Queue: {relative(args.queue)}")
    print(f"Report: {relative(args.report)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
