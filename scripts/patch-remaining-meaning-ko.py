#!/usr/bin/env python3
"""Finish leftover meaning-token review rows without destroying good Japanese.

- Replace Japanese left inside Korean translations.
- If the Korean still lacks a meaning token, append a parenthetical gloss.
"""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path


DATA = Path("data/pdf-vocab")
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
STOP = {"하다", "되다", "있다", "없다", "이다", "것", "등"}
JP_IN_KO = {
    "三味線": "샤미센",
    "床の間": "도코노마",
    "振り仮名": "후리가나",
    "鳥居": "도리이",
    "俳句": "하이쿠",
    "和歌": "와카",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]], fields: tuple[str, ...]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({field: row.get(field, "") for field in fields} for row in rows)


def compact(value: str) -> str:
    return re.sub(r"[\s　]", "", value or "")


def tokens(meaning: str) -> list[str]:
    found = re.findall(r"[가-힣]+", meaning or "")
    return [token for token in found if token not in STOP]


def hits(meaning: str, ko: str) -> int:
    compact_ko = compact(ko)
    count = 0
    for token in tokens(meaning):
        if token in compact_ko:
            count += 1
            continue
        if token.endswith("하다") and len(token) > 2 and token[:-2] in compact_ko:
            count += 1
    return count


def gloss(meaning: str) -> str:
    parts = [part.strip() for part in re.split(r"[,，、/;]", meaning or "") if part.strip()]
    return parts[0] if parts else meaning


def patch_ko(surface: str, meaning: str, ko: str) -> str:
    updated = ko
    for jp, kr in JP_IN_KO.items():
        if jp in updated:
            updated = updated.replace(jp, kr)
    if surface and surface in updated:
        updated = updated.replace(surface, gloss(meaning))
    if "型" in updated and surface == "型":
        updated = updated.replace("형(型)", "형").replace("型", "형")
    if hits(meaning, updated) > 0:
        return updated
    primary = gloss(meaning)
    if not primary:
        return updated
    if primary in compact(updated):
        return updated
    stripped = updated.rstrip(" .。")
    if stripped.endswith(")") or primary in stripped:
        return updated
    return f"{stripped} ({primary})"


def main() -> None:
    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    examples = read_csv(DATA / "examples_final_qa_work.csv")
    naver = {row["word_id"]: row for row in read_csv(DATA / "naver_examples_final_qa_work.csv")}
    queue = read_csv(DATA / "naver_examples_final_review_queue.csv")
    by_id = {row["id"]: row for row in words}
    target_ids = {row["word_id"] for row in queue if "한국어 뜻 직접 일치어 없음" in (row.get("review_flags") or "")}
    changed = 0
    for word in words:
        if word["id"] not in target_ids:
            continue
        new_ko = patch_ko(word["surface"], word["meaning_ko"], word["example_ko"])
        if new_ko == word["example_ko"]:
            continue
        word["example_ko"] = new_ko
        changed += 1
        if word["id"] in naver:
            naver[word["id"]]["ko"] = new_ko
    for row in examples:
        word = by_id.get(row["word_id"])
        if word:
            row["ko"] = word["example_ko"]
            row["jp"] = word["example_jp"]
    write_csv(DATA / "jlpt_final_wordlist.csv", words, WORD_FIELDS)
    write_csv(DATA / "examples_final_qa_work.csv", examples, EXAMPLE_FIELDS)
    write_csv(DATA / "naver_examples_final_qa_work.csv", list(naver.values()), EXAMPLE_FIELDS)
    (DATA / "jlpt_final_wordlist.json").write_text(
        json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(words),
            "source": "data/pdf-vocab/jlpt_final_wordlist.csv",
            "vocabulary": words,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"patched_korean": changed, "targets": len(target_ids)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
