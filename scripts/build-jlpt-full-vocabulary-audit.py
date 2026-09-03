#!/usr/bin/env python3
"""Build a non-mutating, release-wide JLPT vocabulary audit report.

This combines the current JMdict audit with structural, provenance, prior
curation-regression, phrase, duplicate, and linkage checks.  It never edits
the release word list.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data/pdf-vocab"
WORDS = DATA / "jlpt_final_wordlist.csv"
EXAMPLES = DATA / "examples_final_qa_work.csv"
SOURCES = DATA / "jlpt_source_entries.csv"
HEAD_AUDIT = DATA / "jlpt_full_audit_2026-08-18_headwords.json"
PRIOR_REVIEW = DATA / "jlpt_all_headword_reviewed.json"
PHRASE_DECISIONS = DATA / "jlpt_phrase_review_decisions.json"
SCOPE_MANIFEST = DATA / "jlpt_scope_curated_manifest.json"
OUT_JSON = DATA / "jlpt_full_vocabulary_audit_2026-08-18.json"
OUT_CSV = DATA / "jlpt_full_vocabulary_audit_2026-08-18_issues.csv"
OUT_MD = DATA / "jlpt_full_vocabulary_audit_2026-08-18.md"

LEVEL_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}
KANA_RE = re.compile(r"^[ぁ-ゖァ-ヺー・ヽヾゝゞ]+$")
HANGUL_RE = re.compile(r"[가-힣]")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def add_issue(
    issues: list[dict[str, str]],
    seen: set[tuple[str, str]],
    severity: str,
    category: str,
    row: dict[str, Any] | None,
    detail: str,
    evidence: str,
    action: str,
) -> None:
    word_id = str((row or {}).get("id", ""))
    key = (category, word_id or detail)
    if key in seen:
        return
    seen.add(key)
    issues.append(
        {
            "severity": severity,
            "category": category,
            "id": word_id,
            "level": str((row or {}).get("level", "")),
            "surface": str((row or {}).get("surface", "")),
            "reading_kana": str((row or {}).get("reading_kana", "")),
            "meaning_ko": str((row or {}).get("meaning_ko", "")),
            "detail": detail,
            "evidence": evidence,
            "recommended_action": action,
        }
    )


def main() -> None:
    words = read_csv(WORDS)
    examples = read_csv(EXAMPLES)
    sources = read_csv(SOURCES)
    head_doc = json.loads(HEAD_AUDIT.read_text(encoding="utf-8"))
    prior_doc = json.loads(PRIOR_REVIEW.read_text(encoding="utf-8"))
    phrase_doc = json.loads(PHRASE_DECISIONS.read_text(encoding="utf-8"))
    scope_doc = json.loads(SCOPE_MANIFEST.read_text(encoding="utf-8"))

    by_id = {row["id"]: row for row in words}
    by_pair: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    by_surface: dict[str, list[dict[str, str]]] = defaultdict(list)
    by_reading_meaning: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in words:
        by_pair[(row["surface"], row["reading_kana"])].append(row)
        by_surface[row["surface"]].append(row)
        by_reading_meaning[(row["reading_kana"], row["meaning_ko"].strip())].append(row)

    head_by_id = {row["id"]: row for row in head_doc["rows"]}
    prior_ids = {row["id"] for row in prior_doc["rows"]}
    issues: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    # Objective JMdict surface-reading conflicts.
    for row in head_doc["rows"]:
        if "surface-reading-mismatch" in row["flags"]:
            add_issue(
                issues,
                seen,
                "critical",
                "jmdict_surface_reading_conflict",
                row,
                f"JMdict readings for {row['surface']}: {', '.join(row['jmdict_surface_readings'])}",
                "Current surface exists in JMdict, but the shipped reading does not match it.",
                "Correct the reading or merge into the existing canonical entry.",
            )

    # Regressions against the completed all-headword adjudication.
    for old in prior_doc["rows"]:
        decision = old["review_decision"]
        if decision == "keep":
            continue
        current_rows = by_pair.get((old["surface"], old["reading_kana"]), [])
        if not current_rows:
            continue
        changed_surface = old["surface"] != old["review_surface"]
        changed_reading = old["reading_kana"] != old["review_reading_kana"]
        changed_meaning = old["meaning_ko"] != old["review_meaning_ko"]
        for current in current_rows:
            fields = []
            if changed_surface:
                fields.append(f"surface {old['surface']} -> {old['review_surface']}")
            if changed_reading:
                fields.append(
                    f"reading {old['reading_kana']} -> {old['review_reading_kana']}"
                )
            if changed_meaning and current["meaning_ko"] == old["meaning_ko"]:
                fields.append(
                    f"meaning {old['meaning_ko']} -> {old['review_meaning_ko']}"
                )
            # Same-key merges are already represented by the one surviving row.
            if not fields:
                continue
            severity = "critical" if changed_reading else "review"
            add_issue(
                issues,
                seen,
                severity,
                "prior_headword_correction_regressed",
                current,
                "; ".join(fields),
                old["review_reason"],
                "Reapply the prior adjudication by lexical key, not historical ID alone.",
            )

    # Regressed phrase normalization and removal decisions.
    for decision in phrase_doc.get("normalizations", []):
        for current in by_surface.get(decision["surface"], []):
            add_issue(
                issues,
                seen,
                "major",
                "phrase_normalization_regressed",
                current,
                (
                    f"{decision['surface']}/{current['reading_kana']} -> "
                    f"{decision['target_surface']}/{decision['target_reading']}"
                ),
                "The prior phrase audit converted this inflected form to a dictionary headword.",
                "Normalize to the recorded target and resolve any collision.",
            )
    for decision in phrase_doc.get("removals", []):
        for current in by_surface.get(decision["surface"], []):
            add_issue(
                issues,
                seen,
                "major",
                "phrase_removal_regressed",
                current,
                f"Remove card; attach to {decision['target_surface']} ({decision['kind']}).",
                "The prior phrase audit classified this as a collocation or explanatory phrase.",
                "Restore the prior removal/example-promotion decision.",
            )

    # Same reading and exactly the same Korean meaning is a strong duplicate signal.
    duplicate_groups = []
    for (reading, meaning), group in by_reading_meaning.items():
        if len(group) < 2:
            continue
        group = sorted(group, key=lambda row: (LEVEL_ORDER[row["level"]], row["surface"]))
        group_id = "|".join(row["id"] for row in group)
        duplicate_groups.append(
            {
                "reading_kana": reading,
                "meaning_ko": meaning,
                "ids": [row["id"] for row in group],
                "levels": [row["level"] for row in group],
                "surfaces": [row["surface"] for row in group],
            }
        )
        representative = dict(group[0])
        representative["id"] = group_id
        add_issue(
            issues,
            seen,
            "major",
            "same_reading_same_meaning_duplicate_group",
            representative,
            " / ".join(f"{r['level']}:{r['surface']}" for r in group),
            "Every member has the same reading and exactly the same Korean gloss.",
            "Merge spelling duplicates; retain only when distinct usage is documented in the gloss.",
        )

    # Definite Korean gloss/data errors found by deterministic checks and review.
    known_meaning_errors = {
        "w_90b4dd79bc0d9463": ("금새", "금새 is a spelling error", "곧바로, 즉시"),
        "w_717479e0869c099f": (
            "따라잡다 (감정,요구를)억제하다,",
            "The gloss has an unrelated appended sense and a trailing comma",
            "따라잡다",
        ),
        "w_e662da8e9deb3398": (
            "고치다, 고정하다",
            "所定 means prescribed/designated, not 고치다·고정하다",
            "소정의, 정해진",
        ),
    }
    for word_id, (bad_value, detail, suggestion) in known_meaning_errors.items():
        current = by_id.get(word_id)
        if current and current["meaning_ko"].strip() == bad_value:
            add_issue(
                issues,
                seen,
                "major",
                "meaning_error",
                current,
                detail,
                f"Current gloss: {current['meaning_ko']}",
                f"Review suggested gloss: {suggestion}",
            )

    # High-confidence broad POS errors. Other noun/adjectival-noun differences are
    # intentionally not auto-failed because the app uses a coarse POS taxonomy.
    known_pos_errors = {
        "w_8f43b180efb6a864": ("noun", "虹 is a noun, not an adjective."),
        "w_2042955fbd7ed6b5": ("noun", "話中 is a noun/no-adjectival noun, not an adjective."),
        "w_c804e191ffa9046c": ("adjective", "単なる is prenominal/adjectival, not an adverb."),
    }
    for word_id, (expected_pos, detail) in known_pos_errors.items():
        current = by_id.get(word_id)
        if current and current["part_of_speech"] != expected_pos:
            add_issue(
                issues,
                seen,
                "major",
                "part_of_speech_error",
                current,
                detail,
                f"Current part_of_speech={current['part_of_speech']}",
                "Correct the coarse app POS value.",
            )

    # Structural and linkage checks across all 6,638 rows.
    required = ("id", "level", "surface", "reading_kana", "meaning_ko", "part_of_speech", "source")
    structural = {
        "word_count": len(words),
        "unique_ids": len(by_id),
        "unique_surface_reading_pairs": len(by_pair),
        "blank_required_fields": sum(
            any(not row[field].strip() for field in required) for row in words
        ),
        "invalid_readings": sum(not KANA_RE.fullmatch(row["reading_kana"]) for row in words),
        "meanings_without_hangul": sum(not HANGUL_RE.search(row["meaning_ko"]) for row in words),
        "example_count": len(examples),
        "unique_example_word_ids": len({row["word_id"] for row in examples}),
        "missing_example_ids": len(set(by_id) - {row["word_id"] for row in examples}),
        "unknown_example_ids": len({row["word_id"] for row in examples} - set(by_id)),
        "blank_examples": sum(not row["jp"].strip() or not row["ko"].strip() for row in examples),
    }

    # Difficulty provenance: the builder should choose the easiest exact PDF level.
    source_levels: dict[tuple[str, str], set[str]] = defaultdict(set)
    for row in sources:
        if row["include_in_app"] == "1":
            source_levels[(row["surface"], row["reading_kana"])].add(row["level"])
    easier_source_conflicts = []
    for row in words:
        levels = source_levels.get((row["surface"], row["reading_kana"]), set())
        easier = [level for level in levels if LEVEL_ORDER[level] < LEVEL_ORDER[row["level"]]]
        if easier:
            easier_source_conflicts.append(row["id"])

    # Excluded pass-book synonym/usage rows must not be the sole PDF support.
    removed_scope_ids = {row["id"] for row in scope_doc["removed_scope_rows"]}
    independently_backfilled_ids = {row["id"] for row in scope_doc["backfills"]}
    pass_scope_leaks = sorted((removed_scope_ids - independently_backfilled_ids) & set(by_id))

    issues.sort(
        key=lambda row: (
            {"critical": 0, "major": 1, "review": 2}[row["severity"]],
            row["category"],
            -LEVEL_ORDER.get(row["level"], -1),
            row["reading_kana"],
            row["surface"],
        )
    )
    severity_counts = Counter(row["severity"] for row in issues)
    category_counts = Counter(row["category"] for row in issues)
    critical_word_ids = {
        row["id"] for row in issues if row["severity"] == "critical" and row["id"]
    }
    duplicate_groups_by_level = Counter(
        level for group in duplicate_groups for level in set(group["levels"])
    )
    new_rows = [row for row in words if row["id"] not in prior_ids]
    structural_ok = (
        structural["word_count"] == 6638
        and structural["unique_ids"] == 6638
        and structural["unique_surface_reading_pairs"] == 6638
        and not any(structural[key] for key in (
            "blank_required_fields", "invalid_readings", "meanings_without_hangul",
            "missing_example_ids", "unknown_example_ids", "blank_examples",
        ))
    )
    status = "PASS" if not issues and structural_ok and not easier_source_conflicts and not pass_scope_leaks else "FAIL_CONTENT_QA"
    summary = {
        "status": status,
        "scope": "all 6,638 release vocabulary rows",
        "structural": structural,
        "level_counts": dict(Counter(row["level"] for row in words)),
        "jmdict": head_doc["summary"],
        "issues_by_severity": dict(severity_counts),
        "unique_critical_word_ids": len(critical_word_ids),
        "issues_by_category": dict(category_counts),
        "same_reading_same_meaning_duplicate_groups": len(duplicate_groups),
        "duplicate_groups_containing_level": dict(duplicate_groups_by_level),
        "rows_not_in_prior_headword_review": len(new_rows),
        "new_rows_with_jmdict_attention": sum(
            head_by_id[row["id"]]["attention"] != "none" for row in new_rows
        ),
        "easier_exact_pdf_level_conflicts": len(easier_source_conflicts),
        "pass_excluded_section_leaks": len(pass_scope_leaks),
        "limitations": [
            "JLPT does not publish an official post-2010 vocabulary list; Kaggle-only level labels cannot be independently certified here.",
            "Korean meanings were format-checked across all rows and compared with prior adjudication; only deterministic or manually confirmed semantic errors are failed.",
            "JMdict non-exact rows include valid productive/inflected PDF forms and require policy review rather than automatic deletion.",
        ],
    }
    output = {
        "generated_at": "2026-08-18",
        "summary": summary,
        "duplicate_groups": duplicate_groups,
        "easier_source_conflict_ids": easier_source_conflicts,
        "pass_scope_leak_ids": pass_scope_leaks,
        "issues": issues,
    }
    OUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    columns = [
        "severity", "category", "id", "level", "surface", "reading_kana",
        "meaning_ko", "detail", "evidence", "recommended_action",
    ]
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        writer.writerows(issues)

    lines = [
        "# JLPT 어휘 6,638개 전수 감사 (2026-08-18)",
        "",
        f"결론: **{'통과' if status == 'PASS' else '내용 QA 실패'}**.",
        "",
        "## 핵심 집계",
        "",
        f"- 구조: {structural['word_count']}개, 고유 ID {structural['unique_ids']}개, 고유 표제어/읽기 {structural['unique_surface_reading_pairs']}개",
        f"- JMdict 표면형·읽기 충돌: {category_counts['jmdict_surface_reading_conflict']}건",
        f"- 치명 판정 고유 단어: {len(critical_word_ids)}개 (교차 검사 중복 집계 제외)",
        f"- 과거 표제어 교정 회귀: {category_counts['prior_headword_correction_regressed']}건",
        f"- 구절 정규화/제거 회귀: {category_counts['phrase_normalization_regressed'] + category_counts['phrase_removal_regressed']}건",
        f"- 동일 읽기·동일 뜻 중복 후보: {len(duplicate_groups)}그룹",
        f"- 그중 N5가 포함된 중복 후보: {duplicate_groups_by_level['N5']}그룹",
        f"- 확정 뜻 오류: {category_counts['meaning_error']}건",
        f"- 확정 품사 오류: {category_counts['part_of_speech_error']}건",
        f"- 더 쉬운 PDF 급수와 충돌: {len(easier_source_conflicts)}건",
        f"- pass PDF 유의어·용법 제외 섹션 단독 유입: {len(pass_scope_leaks)}건",
        f"- 예문 누락/미연결/빈칸: {structural['missing_example_ids'] + structural['unknown_example_ids'] + structural['blank_examples']}건",
        "",
        "## 판정",
        "",
        "- `critical`: 표제어와 읽기가 사전에 직접 충돌하거나 과거 읽기 교정이 되돌아온 항목",
        "- `major`: 구절 카드 재유입, 동일 읽기·동일 뜻 중복, 확정 뜻/품사 오류",
        "- `review`: 표준 표기 선택 등 과거 수동 교정이 되돌아온 항목",
        "",
        "상세 항목은 동명 JSON과 `_issues.csv`에 모두 기록했다.",
        "",
        "## 원인 판단",
        "",
        (
            "pass PDF의 유의어·용법 섹션을 전 레벨에서 제외하고, 기존 표제어·구절 교정과 중복 제거 결정을 재적용했다."
            if status == "PASS"
            else f"현재 목록에서 해결되지 않은 감사 항목이 {len(issues)}건 발견됐다."
        ),
        "",
        "## 한계",
        "",
        *[f"- {item}" for item in summary["limitations"]],
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"wrote {len(issues)} issue rows")


if __name__ == "__main__":
    main()
