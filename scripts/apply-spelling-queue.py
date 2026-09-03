#!/usr/bin/env python3
"""Resolve the remaining NAVER search-unmatched spelling queue.

- Merge inflected extras into an existing lemma card.
- Rewrite な/だ/に/と extras to the lemma when the lemma is not yet a card.
- Keep modern 々 forms, set phrases, and distinct compounds; accept those.
"""

from __future__ import annotations

import csv
import importlib.util
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: i for i, level in enumerate(LEVELS)}
TAG = "spelling-queue-2026-08-21"
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

# extra (surface, reading) -> lemma (surface, reading)
MERGES = [
    ("確かに", "たしかに", "確か", "たしか"),
    ("代表的な", "だいひょうてきな", "代表的", "だいひょうてき"),
    ("清潔な", "せいけつな", "清潔", "せいけつ"),
    ("別々に", "べつべつに", "別々", "べつべつ"),
    ("絶対に", "ぜったいに", "絶対", "ぜったい"),
    ("一斉に", "いっせいに", "一斉", "いっせい"),
    ("いい加減に", "いいかげんに", "いい加減", "いいかげん"),
    ("頻繁に", "ひんぱんに", "頻繁", "ひんぱん"),
    ("曖昧に", "あいまいに", "曖昧", "あいまい"),
    ("猛烈に", "もうれつに", "猛烈", "もうれつ"),
    ("盛大に", "せいだいに", "盛大", "せいだい"),
    ("早急に", "さっきゅうに", "早急", "さっきゅう"),
    ("一律に", "いちりつに", "一律", "いちりつ"),
    ("勇敢に", "ゆうかんに", "勇敢", "ゆうかん"),
    ("強硬に", "きょうこうに", "強硬", "きょうこう"),
    ("軽率な", "けいそつな", "軽率", "けいそつ"),
    ("軽快な", "けいかいな", "軽快", "けいかい"),
    ("疎かに", "おろそかに", "疎か", "おろそか"),
    ("克明に", "こくめいに", "克明", "こくめい"),
    ("ご主人", "ごしゅじん", "主人", "しゅじん"),
    ("思いっきり", "おもいっきり", "思い切り", "おもいきり"),
    ("慕われる", "したわれる", "慕う", "したう"),
    ("心地よく", "ここちよく", "心地よい", "ここちよい"),
    ("俄には", "にわかには", "俄", "にわか"),
]

# extra (surface, reading) -> lemma surface/reading/meaning/pos
REWRITES = [
    ("大らかな", "おおらかな", "大らか", "おおらか", "대범한", "adjective"),
    ("華やかな", "はなやかな", "華やか", "はなやか", "화려한", "adjective"),
    ("旺盛だ", "おうせいだ", "旺盛", "おうせい", "왕성한", "adjective"),
    ("億劫だ", "おっくうだ", "億劫", "おっくう", "귀찮은", "adjective"),
    ("疎らだ", "まばらだ", "疎ら", "まばら", "드문드문한", "adjective"),
    ("些細な", "ささいな", "些細", "ささい", "사소한", "adjective"),
    ("奔放な", "ほんぽうな", "奔放", "ほんぽう", "분방한", "adjective"),
    ("多角的な", "たかくてきな", "多角的", "たかくてき", "다각적인", "adjective"),
    ("精力的に", "せいりょくてきに", "精力的", "せいりょくてき", "정력적인", "adjective"),
    ("爽やかだ", "さわやかだ", "爽やか", "さわやか", "상쾌한, 산뜻한", "adjective"),
    ("コンスタントに", "コンスタントに", "コンスタント", "コンスタント", "일정한, 꾸준한", "adjective"),
    ("有耶無耶に", "うやむやに", "有耶無耶", "うやむや", "흐지부지한, 애매한", "adjective"),
    ("煌々と", "こうこうと", "煌々", "こうこう", "환한, 밝은", "adverb"),
    ("歴然と", "れきぜんと", "歴然", "れきぜん", "역연한, 또렷한", "adjective"),
    ("ひしひしと", "ひしひしと", "ひしひし", "ひしひし", "절실히, 절절히", "adverb"),
    ("ずっしりと", "ずっしりと", "ずっしり", "ずっしり", "묵직함, 무거운 느낌", "adverb"),
    ("せかせかと", "せかせかと", "せかせか", "せかせか", "조급함, 분주함", "adverb"),
    ("忠実に", "ちゅうじつに", "忠実", "ちゅうじつ", "충실한", "adjective"),
    ("一挙に", "いっきょに", "一挙", "いっきょ", "일거", "noun"),
    ("豪快に", "ごうかいに", "豪快", "ごうかい", "호쾌한", "adjective"),
    ("遺憾に", "いかんに", "遺憾", "いかん", "유감", "noun"),
    ("如実に", "にょじつに", "如実", "にょじつ", "여실함", "noun"),
    ("徐々に", "じょじょに", "徐々", "じょじょ", "서서히", "adverb"),
    ("貶される", "けなされる", "貶す", "けなす", "비난하다, 깎아내리다", "verb"),
    ("お出掛け", "おでかけ", "お出かけ", "おでかけ", "외출", "noun"),
]

# Catalog doubled-kanji alt for modern 々 spellings.
ITERATION_ALTS = {
    "色々": ["色色", "いろいろ"],
    "中々": ["中中"],
    "我々": ["我我", "吾吾"],
    "方々": ["方方"],
    "次々": ["次次"],
    "少々": ["少少"],
    "何々": ["何何"],
    "別々": ["別別"],
    "様々": ["様様"],
    "各々": ["各各"],
    "元々": ["元元", "本本"],
    "続々": ["続続"],
    "着々": ["着着"],
    "転々": ["転転"],
    "若々しい": ["若若しい"],
    "騒々しい": ["騒騒しい"],
    "順々": ["順順"],
    "銘々": ["銘銘"],
    "堂々": ["堂堂"],
    "華々しい": ["花花しい", "華華しい"],
    "重々しい": ["重重しい"],
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


def parse_tags(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except json.JSONDecodeError:
        pass
    return [part.strip() for part in text.split(";") if part.strip()]


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
        if item and item not in alts and item != row["surface"]:
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


def find_pair(words: list[dict[str, str]], surface: str, reading: str) -> dict[str, str]:
    for row in words:
        if row["surface"] == surface and row["reading_kana"] == reading:
            return row
    raise RuntimeError(f"missing card {surface} {reading}")


def remap_examples(rows: list[dict[str, str]], id_map: dict[str, str], drop: set[str]) -> list[dict[str, str]]:
    out = []
    seen = set()
    for row in rows:
        if row["word_id"] in drop:
            continue
        if row["word_id"] in id_map:
            continue
        row = dict(row)
        out.append(row)
        seen.add(row["word_id"])
    for row in rows:
        if row["word_id"] not in drop:
            continue
        word_id = id_map.get(row["word_id"], row["word_id"])
        if word_id in seen or word_id in drop:
            continue
        row = dict(row)
        row["word_id"] = word_id
        out.append(row)
        seen.add(word_id)
    out.sort(key=lambda item: item["word_id"])
    return out


def main() -> None:
    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    by_pair = {(row["surface"], row["reading_kana"]): row for row in words}
    successors: dict[str, str] = {}
    dropped: set[str] = set()
    rewritten: list[dict[str, str]] = []
    merged: list[dict[str, str]] = []

    for extra_s, extra_r, lemma_s, lemma_r in MERGES:
        extra = find_pair(words, extra_s, extra_r)
        lemma = find_pair(words, lemma_s, lemma_r)
        successors[extra["id"]] = lemma["id"]
        dropped.add(extra["id"])
        set_alts(lemma, [extra_s, extra_r])
        add_tag(lemma, TAG)
        merged.append({
            "from_id": extra["id"], "to_id": lemma["id"],
            "from": extra_s, "to": lemma_s, "level": extra["level"],
        })

    for extra_s, extra_r, new_s, new_r, meaning, pos in REWRITES:
        extra = find_pair(words, extra_s, extra_r)
        new_id = RB.stable_word_id(new_s, new_r)
        if new_id in {row["id"] for row in words if row["id"] not in dropped} and new_id != extra["id"]:
            raise RuntimeError(f"rewrite collides {new_s} {new_id}")
        if extra["id"] != new_id:
            successors[extra["id"]] = new_id
        extra["surface"] = new_s
        extra["reading_kana"] = new_r
        extra["furigana"] = new_r
        extra["meaning_ko"] = meaning
        extra["part_of_speech"] = pos
        extra["card_type"] = RB.infer_card_type(new_s)
        extra["id"] = new_id
        set_alts(extra, [extra_s, extra_r])
        add_tag(extra, TAG)
        rewritten.append({
            "from": extra_s, "to": new_s, "old_id": successors.get(new_id, extra["id"]),
            "new_id": new_id, "level": extra["level"],
        })

    kept = []
    for row in words:
        if row["id"] in dropped:
            continue
        if row["surface"] in ITERATION_ALTS:
            set_alts(row, ITERATION_ALTS[row["surface"]])
            add_tag(row, TAG)
            kept.append({"id": row["id"], "surface": row["surface"], "reason": "modern-iteration-mark"})
        elif row["surface"] == "どう致しまして":
            set_alts(row, ["如何致しまして", "どういたしまして"])
            add_tag(row, TAG)
            kept.append({"id": row["id"], "surface": row["surface"], "reason": "set-phrase"})
        elif row["surface"] == "にも関わらず":
            set_alts(row, ["にも拘らず", "にもかかわらず"])
            add_tag(row, TAG)
            kept.append({"id": row["id"], "surface": row["surface"], "reason": "set-phrase"})
        elif row["surface"] == "繋がり":
            set_alts(row, ["繫がり", "つながり"])
            add_tag(row, TAG)
            kept.append({"id": row["id"], "surface": row["surface"], "reason": "modern-kanji"})

    words = [row for row in words if row["id"] not in dropped]
    ids = [row["id"] for row in words]
    if len(ids) != len(set(ids)):
        dup = [wid for wid, count in Counter(ids).items() if count > 1]
        raise RuntimeError(f"duplicate ids after rewrite: {dup}")

    refresh_sort(words)
    counts = Counter(row["level"] for row in words)

    id_map = dict(successors)
    naver = remap_examples(read_csv(DATA / "naver_examples_final_qa_work.csv"), id_map, dropped)
    examples = remap_examples(read_csv(DATA / "examples_final_qa_work.csv"), id_map, dropped)
    self_rows = remap_examples(read_csv(DATA / "self_authored_examples_qa_work.csv"), id_map, dropped)

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

    keep_surfaces = {
        "色々", "どう致しまして", "中々", "日本製", "一度に", "我々", "方々", "次々", "少々",
        "落ち着く", "行ってきます", "始めに", "その頃", "その他", "何々", "別々", "様々",
        "各々", "初めに", "元々", "繋がり", "割合に", "続々", "構いません", "斬る",
        "ウェイトレス", "転々", "若々しい", "騒々しい", "ご苦労さま", "順々", "銘々",
        "何なり", "にも関わらず", "堂々", "幾つか", "ロープウェイ", "足手まとい", "埋め込む",
        "華々しい", "重々しい", "着々",
    }
    accepted_keep = []
    for row in words:
        if row["surface"] in keep_surfaces:
            accepted_keep.append({
                "id": row["id"],
                "level": row["level"],
                "surface": row["surface"],
                "reading_kana": row["reading_kana"],
                "reason": "modern-form-or-set-phrase",
            })

    manifest = {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "word_count": len(words),
        "level_counts": dict(counts),
        "successors": successors,
        "merged": merged,
        "rewritten": rewritten,
        "kept": accepted_keep,
        "dropped": sorted(dropped),
    }
    (DATA / "jlpt_spelling_queue_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "word_count": len(words),
        "level_counts": dict(counts),
        "merged": len(merged),
        "rewritten": len(rewritten),
        "kept": len(accepted_keep),
        "naver_examples": len(naver),
        "examples": len(examples),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
