#!/usr/bin/env python3
"""Apply the 2026-08-21 NAVER cross-check fixes.

Moves confirmed unique JLPT-badge mismatches, patches two Korean glosses,
and splits その他 to the dictionary reading そのた.
"""

from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: i for i, level in enumerate(LEVELS)}
TAG = "naver-crosscheck-2026-08-21"
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

LEVEL_MOVES = {
    "w_80d1fde9c12ec7bb": "N1",  # 活発: catalog+search N1 only
    "w_124b8bc840f69c1e": "N2",  # 我々 / 我我 N2
    "w_14b7a7565fa9e8f4": "N2",  # 度々 / 度度 N2
    "w_cbaa90d9cde4ed8e": "N3",  # 別々 / 別別 N3
    "w_fe5026000bdbdfdf": "N3",  # 続々 / 続続 N3
    "w_b846d60ec7ea8a3a": "N3",  # 若々しい / 若若しい N3
    "w_269ddebb94cfa099": "N3",  # 図々しい / 図図しい N3
    "w_7e841837b10f6c95": "N3",  # 長々 / 長長 N3
    "w_52b71369ec5db591": "N3",  # 漬ける pickle sense is N3
    "w_422094ff0a79b584": "N4",  # 付く '붙다' is N4
    "w_3fdb6246f1e9c47f": "N3",  # 只 '공짜' is N3; N1 was a kanji NAMEYN tag
    "w_dd6cfb328dbd2400": "N2",  # せい / 所為 N2
    "w_08fb3f57661da121": "N4",  # 硬い common sense is N4 堅い·硬い·固い
}

MEANING_FIXES = {
    "w_421ac61489eec84b": "흘끗, 잠깐, 언뜻",  # ちらっと
    "w_4e15782eca5e57f4": "학습, 배움",  # 学習 noun gloss
}

READING_FIXES = {
    "w_f6461fe50fbc18a7": {
        "reading_kana": "そのた",
        "furigana": "そのた",
        "alts": ["そのほか", "其の外"],
        "reason": "표제어 その他의 사전 읽기는 そのた. そのほか는 其の外.",
    },
}

EXTRA_ALTS = {
    "w_08fb3f57661da121": ["堅い", "固い"],
    "w_422094ff0a79b584": ["附く"],
    "w_80d1fde9c12ec7bb": ["活溌"],
    "w_dd6cfb328dbd2400": ["所為"],
    "w_3fdb6246f1e9c47f": ["徒"],
    "w_14b7a7565fa9e8f4": ["度度"],
    "w_269ddebb94cfa099": ["図図しい"],
    "w_7e841837b10f6c95": ["長長"],
}

# After the move these cards catalog-match and leave the accepted queue.
DROP_FROM_ACCEPTED = {
    "w_80d1fde9c12ec7bb",  # 活発 N1
    "w_52b71369ec5db591",  # 漬ける N3
}

ACCEPTED_UPDATES = {
    "w_08fb3f57661da121": {
        "queue": "catalog-mismatch-unconfirmed",
        "reason": "일상 ‘딱딱하다’는 검색 N4 堅い·硬い·固い. 목록 단독 硬い는 N2. N3 배지는 없음.",
    },
    "w_422094ff0a79b584": {
        "queue": "homograph",
        "reason": "카드 뜻 ‘붙다’는 검색 N4 付く. N2는 의태어 접미사.",
    },
    "w_3fdb6246f1e9c47f": {
        "queue": "homograph",
        "reason": "공짜 뜻은 검색 N3 只·徒. 이전 N1은 한자 NAMEYN 태그 오인.",
    },
    "w_dd6cfb328dbd2400": {
        "queue": "homograph",
        "reason": "탓/원인 뜻은 목록 所為 N2. せい 검색은 동음이의.",
    },
    "w_124b8bc840f69c1e": {
        "queue": "search-unmatched",
        "reason": "현대 표기 我々. 네이버 목록/검색 표제어는 我我 N2.",
    },
    "w_14b7a7565fa9e8f4": {
        "queue": "search-unmatched",
        "reason": "현대 표기 度々. 네이버 목록/검색 표제어는 度度 N2.",
    },
    "w_cbaa90d9cde4ed8e": {
        "queue": "search-unmatched",
        "reason": "현대 표기 別々. 네이버 목록/검색 표제어는 別別 N3.",
    },
    "w_fe5026000bdbdfdf": {
        "queue": "search-unmatched",
        "reason": "현대 표기 続々. 네이버 목록/검색 표제어는 続続 N3.",
    },
    "w_b846d60ec7ea8a3a": {
        "queue": "search-unmatched",
        "reason": "현대 표기 若々しい. 네이버 목록/검색 표제어는 若若しい N3.",
    },
    "w_269ddebb94cfa099": {
        "queue": "search-unmatched",
        "reason": "현대 표기 図々しい. 네이버 목록/검색 표제어는 図図しい N3.",
    },
    "w_7e841837b10f6c95": {
        "queue": "search-unmatched",
        "reason": "현대 표기 長々. 네이버 목록/검색 표제어는 長長 N3.",
    },
}


def load_rebalance():
    spec = importlib.util.spec_from_file_location(
        "naver_rebalance", ROOT / "scripts/apply-naver-jlpt-rebalance.py"
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


RB = load_rebalance()


def stable_word_id(surface: str, reading: str) -> str:
    basis = f"{unicodedata.normalize('NFKC', surface)}\u0001{unicodedata.normalize('NFKC', reading)}"
    return f"w_{hashlib.sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def parse_tags(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    parsed = json.loads(text)
    return [str(item) for item in parsed]


def add_tag(row: dict[str, Any], tag: str) -> None:
    tags = parse_tags(row.get("tags"))
    if tag not in tags:
        tags.append(tag)
    row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))


def parse_alts(value: Any) -> list[str]:
    return RB.parse_alt_forms(value)


def set_alts(row: dict[str, Any], extras: list[str]) -> None:
    alts = parse_alts(row.get("alt_forms"))
    for item in extras:
        if item and item not in alts and item != row["surface"] and item != row["reading_kana"]:
            alts.append(item)
    row["alt_forms"] = json.dumps(alts, ensure_ascii=False, separators=(",", ":")) if alts else ""


def refresh_sort(words: list[dict[str, str]]) -> None:
    for row in words:
        freq = zipf_frequency(row["surface"], "ja") or zipf_frequency(row["reading_kana"], "ja")
        row["frequency"] = f"{freq:.3f}"
    for level in LEVELS:
        level_rows = sorted(
            (row for row in words if row["level"] == level),
            key=lambda row: (-float(row["frequency"]), row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = str(index // 50 + 1)
    words.sort(key=lambda row: (
        LEVEL_RANK[row["level"]], int(row["reading_chapter"] or 1),
        -float(row["frequency"] or 0), row["surface"], row["id"],
    ))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def remap_example_ids(rows: list[dict[str, str]], id_map: dict[str, str]) -> list[dict[str, str]]:
    out = []
    seen = set()
    for row in rows:
        row = dict(row)
        row["word_id"] = id_map.get(row["word_id"], row["word_id"])
        if row["word_id"] in seen:
            continue
        seen.add(row["word_id"])
        out.append(row)
    out.sort(key=lambda item: item["word_id"])
    return out


def main() -> None:
    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    by_id = {row["id"]: row for row in words}
    needed = set(LEVEL_MOVES) | set(MEANING_FIXES) | set(READING_FIXES) | set(EXTRA_ALTS)
    missing = sorted(needed - set(by_id))
    if missing:
        raise RuntimeError(f"ids missing: {missing}")

    moves = []
    for word_id, new_level in LEVEL_MOVES.items():
        row = by_id[word_id]
        before = row["level"]
        if before == new_level:
            continue
        row["level"] = new_level
        add_tag(row, TAG)
        add_tag(row, "naver-level-corrected")
        moves.append({
            "id": word_id,
            "surface": row["surface"],
            "reading_kana": row["reading_kana"],
            "before": before,
            "after": new_level,
            "meaning_ko": row["meaning_ko"],
        })

    meaning_changes = []
    for word_id, meaning in MEANING_FIXES.items():
        row = by_id[word_id]
        before = row["meaning_ko"]
        if before == meaning:
            continue
        row["meaning_ko"] = meaning
        add_tag(row, TAG)
        meaning_changes.append({
            "id": word_id,
            "surface": row["surface"],
            "before": before,
            "after": meaning,
        })

    successors: dict[str, str] = {}
    reading_changes = []
    for word_id, payload in READING_FIXES.items():
        row = by_id[word_id]
        old_id = row["id"]
        old_reading = row["reading_kana"]
        row["reading_kana"] = payload["reading_kana"]
        row["furigana"] = payload["furigana"]
        new_id = stable_word_id(row["surface"], row["reading_kana"])
        if new_id != old_id:
            if new_id in by_id:
                raise RuntimeError(f"reading rewrite collides {row['surface']} {new_id}")
            successors[old_id] = new_id
            row["id"] = new_id
            del by_id[old_id]
            by_id[new_id] = row
        set_alts(row, payload["alts"])
        add_tag(row, TAG)
        reading_changes.append({
            "old_id": old_id,
            "new_id": new_id,
            "surface": row["surface"],
            "before": old_reading,
            "after": row["reading_kana"],
            "reason": payload["reason"],
        })

    for word_id, extras in EXTRA_ALTS.items():
        current_id = successors.get(word_id, word_id)
        row = by_id[current_id]
        set_alts(row, extras)
        add_tag(row, TAG)

    refresh_sort(words)
    ids = [row["id"] for row in words]
    if len(ids) != len(set(ids)):
        dup = [wid for wid, count in Counter(ids).items() if count > 1]
        raise RuntimeError(f"duplicate ids: {dup}")

    naver = remap_example_ids(read_csv(DATA / "naver_examples_final_qa_work.csv"), successors)
    examples = remap_example_ids(read_csv(DATA / "examples_final_qa_work.csv"), successors)
    self_rows = remap_example_ids(read_csv(DATA / "self_authored_examples_qa_work.csv"), successors)
    example_by_id = {row["word_id"]: row for row in examples}
    missing_ex = [row["id"] for row in words if row["id"] not in example_by_id]
    if missing_ex:
        raise RuntimeError(f"example coverage missing {missing_ex[:12]}")
    for row in words:
        example = example_by_id[row["id"]]
        row["example_jp"] = example["jp"]
        row["example_ko"] = example["ko"]

    write_csv(DATA / "jlpt_final_wordlist.csv", words, WORD_FIELDS)
    (DATA / "jlpt_final_wordlist.json").write_text(
        json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(words),
            "source": str(DATA / "jlpt_final_wordlist.csv"),
            "vocabulary": words,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_csv(DATA / "naver_examples_final_qa_work.csv", naver, EXAMPLE_FIELDS)
    write_csv(DATA / "examples_final_qa_work.csv", examples, EXAMPLE_FIELDS)
    write_csv(DATA / "self_authored_examples_qa_work.csv", self_rows, EXAMPLE_FIELDS)

    accepted_path = DATA / "naver_audit_accepted_queue.json"
    accepted_doc = json.loads(accepted_path.read_text(encoding="utf-8"))
    accepted_rows = []
    for item in accepted_doc.get("accepted") or []:
        old_id = str(item.get("id") or "")
        if old_id in DROP_FROM_ACCEPTED:
            continue
        new_id = successors.get(old_id, old_id)
        row = by_id.get(new_id)
        if not row:
            continue
        item = dict(item)
        item["id"] = new_id
        item["level"] = row["level"]
        item["surface"] = row["surface"]
        item["reading_kana"] = row["reading_kana"]
        item["source_url"] = "https://ja.dict.naver.com/#/search?query=" + quote(row["surface"])
        update = ACCEPTED_UPDATES.get(old_id) or ACCEPTED_UPDATES.get(new_id)
        if update:
            item["queue"] = update["queue"]
            item["reason"] = update["reason"]
        accepted_rows.append(item)
    accepted_rows.sort(key=lambda item: (item["queue"], item["surface"], item["id"]))
    queue_counts = dict(Counter(item["queue"] for item in accepted_rows))
    accepted_doc.update({
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "count": len(accepted_rows),
        "counts": queue_counts,
        "accepted": accepted_rows,
        "crosscheck_tag": TAG,
    })
    accepted_path.write_text(json.dumps(accepted_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = Counter(row["level"] for row in words)
    manifest = {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "word_count": len(words),
        "level_counts": dict(counts),
        "moves": moves,
        "meaning_fixes": meaning_changes,
        "reading_fixes": reading_changes,
        "successors": successors,
        "dropped_from_accepted": sorted(DROP_FROM_ACCEPTED),
        "policy": (
            "Move when NAVER catalog or live search has a unique form+reading "
            "JLPT badge that matches this card's sense. Keep modern 々 surfaces. "
            "NAMEYN kanji tags are not word JLPT badges."
        ),
    }
    (DATA / "jlpt_naver_crosscheck_fix_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "word_count": len(words),
        "level_counts": dict(counts),
        "moves": len(moves),
        "meaning_fixes": len(meaning_changes),
        "reading_fixes": len(reading_changes),
        "successors": successors,
        "accepted_count": len(accepted_rows),
        "move_preview": moves,
        "meaning_preview": meaning_changes,
        "reading_preview": reading_changes,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
