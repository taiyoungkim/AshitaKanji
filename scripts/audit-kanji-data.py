#!/usr/bin/env python3
"""Audit active kanji data across vocabulary, QA CSV, SQLite, and KANJIDIC2."""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / "assets" / "jlpt.db"
DEFAULT_WORDS = ROOT / "data" / "pdf-vocab" / "jlpt_final_wordlist.csv"
DEFAULT_QA = ROOT / "data" / "track-a" / "kanji_qa_work.csv"
DEFAULT_KANJIDIC = ROOT / ".cache" / "kanjidic2.xml.gz"
DEFAULT_RADICAL_NAMES = ROOT / "data" / "track-a" / "kanji_radical_names_ko.json"
DEFAULT_REPORT = ROOT / "data" / "track-a" / "kanji_audit_report.json"
DEFAULT_QUEUE = ROOT / "data" / "track-a" / "kanji_audit_flagged.csv"
KANJI_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
HANGUL_RE = re.compile(r"[가-힣]")
LATIN_RE = re.compile(r"[A-Za-z]")
QA_STATUSES = {"verified", "auto", "needs_review", "rejected"}
KANJI_RADICALS = (
    "一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大"
    "女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳心戈戶手支攴文斗斤方无日曰"
    "月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目"
    "矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣"
    "襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨青非面革韋韭音頁"
    "風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--words", type=Path, default=DEFAULT_WORDS)
    parser.add_argument("--qa", type=Path, default=DEFAULT_QA)
    parser.add_argument("--kanjidic", type=Path, default=DEFAULT_KANJIDIC)
    parser.add_argument("--radical-names", type=Path, default=DEFAULT_RADICAL_NAMES)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_array(value: Any) -> tuple[list[str], str | None]:
    if value is None or value == "":
        return [], None
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()], None
    try:
        parsed = json.loads(str(value))
    except json.JSONDecodeError as exc:
        return [], f"invalid_json:{exc.msg}"
    if not isinstance(parsed, list) or any(not isinstance(item, str) for item in parsed):
        return [], "not_string_array"
    cleaned = [item.strip() for item in parsed if item.strip()]
    return cleaned, None


def unique_kanji(*texts: str | None) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for text in texts:
        for literal in KANJI_RE.findall(text or ""):
            if literal not in seen:
                seen.add(literal)
                result.append(literal)
    return result


def parse_kanjidic(path: Path) -> dict[str, dict[str, Any]]:
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rb") as handle:
        root = ET.parse(handle).getroot()

    entries: dict[str, dict[str, Any]] = {}
    for node in root.findall("character"):
        literal = (node.findtext("literal") or "").strip()
        if not literal:
            continue
        radical_values = node.findall("radical/rad_value")
        classical = next(
            (item.text for item in radical_values if item.get("rad_type") == "classical"),
            radical_values[0].text if radical_values else None,
        )
        radical_number = int(classical) if classical and classical.isdigit() else None
        readings = node.findall("reading_meaning/rmgroup/reading")
        meanings = node.findall("reading_meaning/rmgroup/meaning")
        entries[literal] = {
            "meanings_en": unique_values(
                item.text for item in meanings if item.get("m_lang") is None
            ),
            "onyomi": unique_values(
                item.text for item in readings if item.get("r_type") == "ja_on"
            ),
            "kunyomi": unique_values(
                item.text for item in readings if item.get("r_type") == "ja_kun"
            ),
            "radical": KANJI_RADICALS[radical_number - 1]
            if radical_number and radical_number <= len(KANJI_RADICALS)
            else "",
            "radical_number": radical_number,
            "stroke_count": integer_or_none(node.findtext("misc/stroke_count")),
        }
    return entries


def read_radical_names(path: Path) -> dict[int, dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    rows = payload.get("radicals") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or len(rows) != 214:
        raise ValueError(f"Radical name mapping must contain 214 rows: {path}")
    result: dict[int, dict[str, Any]] = {}
    for row in rows:
        number = integer_or_none(row.get("number")) if isinstance(row, dict) else None
        radical = str(row.get("radical") or "").strip() if isinstance(row, dict) else ""
        name_ko = str(row.get("name_ko") or "").strip() if isinstance(row, dict) else ""
        if not number or number in result or not radical or not name_ko:
            raise ValueError(f"Invalid radical name mapping row: {row}")
        result[number] = {"radical": radical, "name_ko": name_ko}
    if set(result) != set(range(1, 215)):
        raise ValueError("Radical name mapping numbers must be exactly 1 through 214")
    return result


def unique_values(values: Any) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = (value or "").strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


def integer_or_none(value: Any) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def normalized_db_value(field: str, value: Any) -> Any:
    if field in {"meanings_ko", "onyomi", "kunyomi"}:
        parsed, error = parse_array(value)
        return {"value": parsed, "error": error}
    if field in {"radical_number", "stroke_count", "data_version"}:
        return integer_or_none(value)
    return str(value or "").strip()


def relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def add_issue(
    issues: list[dict[str, Any]],
    literal: str,
    severity: str,
    check: str,
    detail: str,
) -> None:
    issues.append(
        {"literal": literal, "severity": severity, "check": check, "detail": detail}
    )


def main() -> int:
    args = parse_args()
    required = [args.db, args.words, args.qa, args.kanjidic, args.radical_names]
    missing_inputs = [str(path) for path in required if not path.exists()]
    if missing_inputs:
        raise SystemExit(f"Missing inputs: {', '.join(missing_inputs)}")

    words = [row for row in read_csv(args.words) if row.get("deprecated", "0").strip() != "1"]
    qa_rows = read_csv(args.qa)
    kanjidic = parse_kanjidic(args.kanjidic)
    radical_names = read_radical_names(args.radical_names)

    word_by_id = {row.get("id", "").strip(): row for row in words}
    expected_links: set[tuple[str, str, int]] = set()
    words_by_literal: dict[str, list[str]] = defaultdict(list)
    for row in words:
        word_id = row.get("id", "").strip()
        for position, literal in enumerate(
            unique_kanji(row.get("surface"), row.get("furigana"))
        ):
            expected_links.add((word_id, literal, position))
            words_by_literal[literal].append(word_id)
    active_literals = set(words_by_literal)

    qa_counts = Counter(row.get("literal", "").strip() for row in qa_rows)
    duplicate_qa_literals = sorted(literal for literal, count in qa_counts.items() if literal and count > 1)
    qa_by_literal = {
        row.get("literal", "").strip(): row
        for row in qa_rows
        if row.get("literal", "").strip()
    }
    qa_literals = set(qa_by_literal)

    with sqlite3.connect(args.db) as conn:
        conn.row_factory = sqlite3.Row
        db_rows = [dict(row) for row in conn.execute("SELECT * FROM kanji ORDER BY literal")]
        db_links = {
            (str(row[0]), str(row[1]), int(row[2]))
            for row in conn.execute(
                "SELECT word_id, literal, position FROM word_kanji ORDER BY word_id, position"
            )
        }
    db_by_literal = {str(row["literal"]): row for row in db_rows}
    db_literals = set(db_by_literal)
    link_literals = {literal for _, literal, _ in db_links}

    issues: list[dict[str, Any]] = []
    structural_fields = [
        "meanings_en",
        "onyomi",
        "kunyomi",
        "radical",
        "radical_number",
        "stroke_count",
    ]
    db_parity_fields = [
        "meanings_ko",
        "onyomi",
        "kunyomi",
        "radical",
        "radical_name_ko",
        "radical_number",
        "stroke_count",
        "source",
        "source_url",
        "license",
        "qa_status",
        "data_version",
    ]

    set_checks = {
        "active_missing_from_qa": sorted(active_literals - qa_literals),
        "qa_not_active": sorted(qa_literals - active_literals),
        "active_missing_from_db": sorted(active_literals - db_literals),
        "db_not_active": sorted(db_literals - active_literals),
        "active_missing_from_links": sorted(active_literals - link_literals),
        "link_literals_not_active": sorted(link_literals - active_literals),
        "expected_links_missing_from_db": sorted(expected_links - db_links),
        "unexpected_db_links": sorted(db_links - expected_links),
        "duplicate_qa_literals": duplicate_qa_literals,
    }
    for check, values in set_checks.items():
        for value in values:
            literal = value[1] if isinstance(value, tuple) and len(value) > 1 else str(value)
            add_issue(issues, literal, "error", check, json.dumps(value, ensure_ascii=False))

    for literal in sorted(active_literals):
        qa = qa_by_literal.get(literal)
        db = db_by_literal.get(literal)
        source = kanjidic.get(literal)
        if not qa or not db:
            continue
        if not source:
            add_issue(issues, literal, "error", "missing_from_kanjidic", literal)
            continue

        parsed_qa: dict[str, Any] = {}
        for field in ("meanings_ko", "meanings_en", "onyomi", "kunyomi"):
            parsed, error = parse_array(qa.get(field))
            parsed_qa[field] = parsed
            if error:
                add_issue(issues, literal, "error", f"qa_{field}_format", error)
            if len(parsed) != len(set(parsed)):
                add_issue(issues, literal, "warning", f"qa_{field}_duplicates", json.dumps(parsed, ensure_ascii=False))

        meanings_ko = parsed_qa["meanings_ko"]
        if not meanings_ko:
            add_issue(issues, literal, "error", "missing_meanings_ko", "empty Korean meanings")
        for meaning in meanings_ko:
            if not HANGUL_RE.search(meaning):
                add_issue(issues, literal, "warning", "meaning_ko_without_hangul", meaning)
            if LATIN_RE.search(meaning):
                add_issue(issues, literal, "warning", "meaning_ko_contains_latin", meaning)
            if meaning.count("(") != meaning.count(")"):
                add_issue(issues, literal, "warning", "meaning_ko_unbalanced_parentheses", meaning)
            if len(meaning) > 40:
                add_issue(issues, literal, "warning", "meaning_ko_too_long", meaning)

        status = (qa.get("qa_status") or "").strip()
        if status not in QA_STATUSES:
            add_issue(issues, literal, "error", "invalid_qa_status", status or "<empty>")
        elif status != "verified":
            add_issue(issues, literal, "review", "manual_review_required", status)

        radical_number = integer_or_none(qa.get("radical_number"))
        expected_radical_name = radical_names.get(radical_number or 0)
        actual_radical_name = (qa.get("radical_name_ko") or "").strip()
        if not expected_radical_name:
            add_issue(issues, literal, "error", "missing_radical_name_mapping", str(radical_number))
        elif expected_radical_name["radical"] != (qa.get("radical") or "").strip():
            add_issue(
                issues,
                literal,
                "error",
                "radical_name_mapping_radical_mismatch",
                json.dumps({"qa": qa.get("radical"), "mapping": expected_radical_name}, ensure_ascii=False),
            )
        elif actual_radical_name != expected_radical_name["name_ko"]:
            add_issue(
                issues,
                literal,
                "error",
                "radical_name_ko_mismatch",
                json.dumps({"qa": actual_radical_name, "expected": expected_radical_name["name_ko"]}, ensure_ascii=False),
            )

        for field in structural_fields:
            if field in {"meanings_en", "onyomi", "kunyomi"}:
                qa_value = parsed_qa[field]
            elif field in {"radical_number", "stroke_count"}:
                qa_value = integer_or_none(qa.get(field))
            else:
                qa_value = (qa.get(field) or "").strip()
            if qa_value != source[field]:
                add_issue(
                    issues,
                    literal,
                    "error",
                    f"kanjidic_{field}_mismatch",
                    json.dumps({"qa": qa_value, "kanjidic": source[field]}, ensure_ascii=False),
                )

        for field in db_parity_fields:
            qa_value = normalized_db_value(field, qa.get(field))
            db_value = normalized_db_value(field, db.get(field))
            if qa_value != db_value:
                add_issue(
                    issues,
                    literal,
                    "error",
                    f"db_{field}_mismatch",
                    json.dumps({"qa": qa_value, "db": db_value}, ensure_ascii=False),
                )

    severity_counts = Counter(issue["severity"] for issue in issues)
    check_counts = Counter(issue["check"] for issue in issues)
    issue_by_literal: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for issue in issues:
        issue_by_literal[issue["literal"]].append(issue)

    queue_rows: list[dict[str, Any]] = []
    severity_rank = {"error": 0, "warning": 1, "review": 2, "followup": 3}
    for literal in sorted(issue_by_literal):
        literal_issues = sorted(
            issue_by_literal[literal], key=lambda item: (severity_rank[item["severity"]], item["check"])
        )
        qa = qa_by_literal.get(literal, {})
        linked_words = [word_by_id[word_id] for word_id in words_by_literal.get(literal, []) if word_id in word_by_id]
        examples = [
            f"{row.get('surface', '')}/{row.get('reading_kana', '')}:{row.get('meaning_ko', '')}"
            for row in linked_words[:8]
        ]
        queue_rows.append(
            {
                "literal": literal,
                "highest_severity": literal_issues[0]["severity"],
                "checks": "|".join(dict.fromkeys(item["check"] for item in literal_issues)),
                "details": " | ".join(item["detail"] for item in literal_issues if item["severity"] != "review"),
                "meanings_ko": qa.get("meanings_ko", ""),
                "meanings_en": qa.get("meanings_en", ""),
                "onyomi": qa.get("onyomi", ""),
                "kunyomi": qa.get("kunyomi", ""),
                "radical": qa.get("radical", ""),
                "radical_name_ko": qa.get("radical_name_ko", ""),
                "radical_number": qa.get("radical_number", ""),
                "stroke_count": qa.get("stroke_count", ""),
                "qa_status": qa.get("qa_status", ""),
                "linked_word_count": len(linked_words),
                "linked_word_examples": " || ".join(examples),
            }
        )

    queue_rows.sort(
        key=lambda row: (
            severity_rank[row["highest_severity"]],
            -len(issue_by_literal[row["literal"]]),
            row["literal"],
        )
    )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "passed_structural": severity_counts["error"] == 0,
        "inputs": {
            "db": relative(args.db),
            "words": relative(args.words),
            "qa": relative(args.qa),
            "kanjidic": relative(args.kanjidic),
            "radical_names": relative(args.radical_names),
        },
        "counts": {
            "active_words": len(words),
            "active_kanji": len(active_literals),
            "qa_rows": len(qa_rows),
            "qa_unique_kanji": len(qa_literals),
            "db_kanji": len(db_literals),
            "expected_word_kanji_links": len(expected_links),
            "db_word_kanji_links": len(db_links),
            "kanjidic_entries": len(kanjidic),
        },
        "qa_status_counts": dict(sorted(Counter((row.get("qa_status") or "").strip() for row in qa_rows).items())),
        "reading_absence": {
            "no_onyomi": sorted(literal for literal, row in qa_by_literal.items() if not parse_array(row.get("onyomi"))[0]),
            "no_kunyomi": sorted(literal for literal, row in qa_by_literal.items() if not parse_array(row.get("kunyomi"))[0]),
            "neither": sorted(
                literal
                for literal, row in qa_by_literal.items()
                if not parse_array(row.get("onyomi"))[0] and not parse_array(row.get("kunyomi"))[0]
            ),
        },
        "set_checks": {key: values for key, values in set_checks.items()},
        "issue_counts_by_severity": dict(sorted(severity_counts.items())),
        "issue_counts_by_check": dict(sorted(check_counts.items())),
        "flagged_kanji": len(issue_by_literal),
        "issues": issues,
        "notes": [
            "Empty onyomi/kunyomi is reported but only treated as an error when it differs from KANJIDIC2.",
            "Korean meaning semantics cannot be proven automatically; every non-verified row is queued for manual review.",
            "radical_name_ko must match the 214-entry Korean Kangxi radical mapping by radical number.",
        ],
    }

    args.report.parent.mkdir(parents=True, exist_ok=True)
    with args.report.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    args.queue.parent.mkdir(parents=True, exist_ok=True)
    queue_headers = list(queue_rows[0]) if queue_rows else ["literal"]
    with args.queue.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=queue_headers)
        writer.writeheader()
        writer.writerows(queue_rows)

    summary = {
        "passed_structural": report["passed_structural"],
        **report["counts"],
        "qa_status_counts": report["qa_status_counts"],
        "issue_counts_by_severity": report["issue_counts_by_severity"],
        "flagged_kanji": report["flagged_kanji"],
        "report": relative(args.report),
        "queue": relative(args.queue),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if report["passed_structural"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
