#!/usr/bin/env python3
"""Apply 2026-08-21 NAVER manual review of unconfirmed catalog mismatches
and homographs. Moves only when live search has an exact form+reading badge;
otherwise keep the card and record it as accepted.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
WORD_FIELDS = (
    "id", "level", "surface", "reading_kana", "furigana", "meaning_ko",
    "part_of_speech", "card_type", "example_jp", "example_ko",
    "example_jp_id", "example_jp_author", "example_ko_id", "example_ko_author",
    "example_license", "alt_forms", "disambig", "source", "qa_status",
    "deprecated", "tags", "data_version", "frequency", "reading_chapter",
    "deprecated_reason", "superseded_by",
)
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: i for i, level in enumerate(LEVELS)}
TAG = "naver-manual-review-2026-08-21"

# Live NAVER search has an exact written-form + reading JLPT badge that
# disagrees with the app and matches this card's sense.
LEVEL_MOVES = {
    "w_25d246fcafff391e": "N4",  # お手洗い
    "w_a4116bf6cc58ca05": "N2",  # 氏/し
    "w_92eb50477a0ece80": "N5",  # ごめんなさい
    "w_631cf27db2365483": "N5",  # 降りる/おりる
    "w_452bc6078da69d6b": "N1",  # 苦/く
    "w_d728d1f32a31b6f6": "N2",  # 遭う
    "w_47d515589fa58fd2": "N4",  # お待たせしました
    "w_54c71aa5ccbde2f4": "N4",  # 行ってらっしゃい
    "w_e19bb44678c7262b": "N4",  # 非常に
    "w_ea9d5a7abc96492d": "N3",  # 非/ひ
    "w_37ce577d9573c9b7": "N4",  # 方/かた
    "w_1f3b58708b016b7f": "N4",  # そば = beside, not 蕎麦
    "w_232fd4c69bca3059": "N4",  # さす = 差す umbrella
    "w_25b648bf778c94cd": "N5",  # する = 為る
    "w_44f5a21a231cf355": "N4",  # いつか = 何時か, not 五日
    "w_f372d394a0a4c4e1": "N2",  # 現す
}

KEEP_REASONS = {
    "w_ac4a28f37332b6a0": "catalog N2 is とどまる; live exact とまる is N4 like the app.",
    "w_52b71369ec5db591": "live has both N3 and N2 for 漬ける/つける; not unique.",
    "w_a85e91e780f1675c": "catalog N1 is しゅ/ぬし; おも has no unique live badge.",
    "w_bd181301cc7c5324": "live さけ has no unique JLPT badge; catalog N2 is homograph-prone.",
    "w_08fb3f57661da121": "live lists N4 堅い·硬い·固い and N2 硬い for かたい.",
    "w_80d1fde9c12ec7bb": "live did not exact-match 活発/かっぱつ; catalog N1 unconfirmed.",
    "w_9a69e415985ac07b": "live lists both N4 and N2 for やわらかい.",
    "w_33687b5b97477220": "N5 badge is おととい, not this いっさくじつ reading.",
    "w_4ef84fc2ec9cfeb": "N5 badge is おととし, not this いっさくねん reading.",
    "w_a9ecc3b353d6e247": "N5 居る matches 있다; N2 is 煎る.",
    "w_1da8dde639dcee40": "live exact でも is N5.",
    "w_901e9473e86b14cd": "N5 又 is 또; N1 is 股.",
    "w_98e68681f275b2c8": "N5 此処 is 여기; N1 is 個個.",
    "w_d631fd55fbc45d65": "live has an N5 大変 entry for this card.",
    "w_27f194a34e98e0b0": "live has both N4 and N2 ゲーム.",
    "w_e12f8a407f734e3c": "live has N4 and N5 一杯; app sense matches N4.",
    "w_98601c5f9fe56540": "N4 旨い covers this card; N2 is 上手い only.",
    "w_98c5ecbe9b1af8f0": "N4 髭 is 수염; N3 is 卑下.",
    "w_66c87676a778f34f": "N4 おや is the interjection; N2 is 親.",
    "w_7bbc01295f752849": "N4 塵 is 쓰레기; N3 is 五味.",
    "w_8510568b02e96bd2": "live exact 空く/すく is N4.",
    "w_dd6cfb328dbd2400": "せい=탓 has no unique badge; N4 背 is the wrong sense.",
    "w_d2920b329afac048": "live has both N2 and N3 当然.",
    "w_422094ff0a79b584": "live has both N4 and N2 付く.",
    "w_fc603d292698586c": "N3 擤む is 코를 풀다; N4 is 噛む.",
    "w_e8527e876dc06d94": "live exact 音/おん is N2.",
    "w_c9624a11c7f3b950": "live exact 尤も is N2.",
    "w_4e62d76c327ed8cd": "live exact ファン is N1.",
    "w_3fdb6246f1e9c47f": "live has an N1 只 entry for 공짜.",
    "w_3dd265dc10e79033": "live has both N3 and N1 カンニング.",
    "w_df7a287483888d5b": "live exact 表(わ)す/あらわす is N3.",
    "w_d59a9029ddc91532": "live exact 碁/ご is N2.",
    "w_412d7a3479a4f8a3": "counter compound; JMdict has no 二匹 lemma.",
}


def parse_tags(value: object) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    return [str(item) for item in json.loads(text)]


def add_tag(row: dict[str, str], tag: str) -> None:
    tags = parse_tags(row.get("tags"))
    if tag not in tags:
        tags.append(tag)
    row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))


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


def main() -> None:
    words_path = DATA / "jlpt_final_wordlist.csv"
    with words_path.open(encoding="utf-8-sig", newline="") as handle:
        words = list(csv.DictReader(handle))
    by_id = {row["id"]: row for row in words}

    keep_reasons = dict(KEEP_REASONS)
    for row in words:
        if row["surface"] == "一昨年" and row["reading_kana"] == "いっさくねん":
            keep_reasons.pop("w_4ef84fc2ec9cfeb", None)
            keep_reasons[row["id"]] = "N5 badge is おととし, not this いっさくねん reading."

    missing_moves = sorted(set(LEVEL_MOVES) - set(by_id))
    if missing_moves:
        raise RuntimeError(f"move ids missing: {missing_moves}")

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

    kept = []
    missing_keep = []
    for word_id, reason in keep_reasons.items():
        row = by_id.get(word_id)
        if not row:
            missing_keep.append(word_id)
            continue
        add_tag(row, TAG)
        kept.append({
            "id": word_id,
            "level": row["level"],
            "surface": row["surface"],
            "reading_kana": row["reading_kana"],
            "reason": reason,
        })
    if missing_keep:
        raise RuntimeError(f"keep ids missing: {missing_keep}")

    refresh_sort(words)
    counts = Counter(row["level"] for row in words)

    with words_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=WORD_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(words)
    (DATA / "jlpt_final_wordlist.json").write_text(
        json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(words),
            "source": str(words_path),
            "vocabulary": words,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    decisions = {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "word_count": len(words),
        "level_counts": dict(counts),
        "moves": moves,
        "kept": kept,
        "policy": (
            "Move only when NAVER live search has an exact surface+reading JLPT "
            "badge that matches this card's sense. Homographs and unconfirmed "
            "catalog mismatches stay at the app level and are accepted."
        ),
    }
    (DATA / "jlpt_naver_manual_review_2026-08-21.json").write_text(
        json.dumps(decisions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "word_count": len(words),
        "level_counts": dict(counts),
        "moves": len(moves),
        "kept": len(kept),
        "move_preview": moves,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
