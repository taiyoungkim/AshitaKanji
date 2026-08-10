#!/usr/bin/env python3
"""Audit kana-only JLPT headwords and propose pedagogically useful kanji faces.

The PDF source spelling remains untouched.  This script emits a reviewed display
override file that can be consumed by the final-word-list builder.  JMdict form
priority, the curated Japanese example, and explicit semantic overrides are used
to avoid teaching obscure spellings such as 此方 for こちら.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Any


KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
KANA_USUAL = "word usually written using kana alone"


# Context or inflected forms that do not have an exact JMdict headword entry.
# These have been checked against the meaning and the curated Japanese example.
MANUAL_BY_ID: dict[str, str] = {
    # N5
    "w_9ac4eb19ccb26979": "嫌いです",
    "w_89e001a5ce85e728": "綺麗です",
    "w_44bc31f10823f315": "結婚する",
    "w_b24621b76259caa8": "三冊",
    "w_59c56506badd0309": "質問する",
    "w_1dc2a01d84d091eb": "新聞を読む",
    "w_3f5f8950779c095c": "洗濯する",
    "w_d8b942a0bbdb88b3": "違います",
    "w_de109ade477aaf3c": "賑やかです",
    "w_5284226e672d96c5": "二冊",
    "w_412d7a3479a4f8a3": "二匹",
    "w_e3d3cc0b38f77224": "二キロ",
    "w_a1a38e164f0a3264": "八十円",
    "w_661368cc7fe5e352": "暇でした",
    "w_49d4a04f0684a107": "下手です",
    "w_72e1cb4ba34fc820": "勉強がしたい",
    "w_950bfdb77150e285": "有名だ",
    # N4
    "w_7d52aa26e8ea1bff": "謝りました",
    "w_5d44d44a212aa9b3": "嘘です",
    "w_9f4e85bedd654fca": "危険です",
    "w_82efffce3d2c635a": "退院する",
    "w_dc3906550d4c187f": "間違えやすい",
    "w_c1395761ef105cb2": "痩せましたね",
    # N3
    "w_f641945e8d6571c0": "慌てて",
    "w_bb82ebdcacdf5f3e": "簡単な",
    "w_02120114862d3c4a": "好きだ",
    "w_3ef3013e7a8e4116": "全ての",
    "w_34cbcd4491dcafdb": "内緒にする",
    "w_75e6de69c398c013": "楽な",
    "w_91e8c336d4454520": "立派な",
    # N1
    "w_fb689f67f99328fc": "曖昧に",
    "w_70b4e5c2f2319ca3": "諦めずに",
    "w_ce70656918f80907": "いい加減に",
    "w_ac2312063a365246": "有耶無耶に",
    "w_cc78ebd8b2b6037f": "大らかな",
    "w_ea4b80af3a66574a": "穏やかな",
    "w_1715b578802aa5e8": "億劫だ",
    "w_9a9c3881eecb9849": "愚かな",
    "w_cc7e713c46e8ee0b": "疎かに",
    "w_1f093ceab4675dbd": "頑なな",
    "w_75fe6fbac6e7ce8b": "貶される",
    "w_4d71c8e8bb9e8afa": "心地よく",
    "w_862152d331038cdb": "些細な",
    "w_c7a2b0e5ff4b6e30": "爽やかだ",
    "w_628691a446bfd8e5": "邪魔する",
    "w_4f3c623502b2e1fc": "速やかに",
    "w_c9278b57465a3ff2": "俄には",
    "w_216be17021a4cb21": "疎らだ",
}


# JMdict can offer several valid spellings.  These explicit decisions resolve
# meaning-sensitive homophones and reject outdated/search-only first forms.
PREFERRED_BY_ID: dict[str, str] = {
    "w_0d26f4ecd5bf00c4": "暖かい",
    "w_7bd42a74b3f21cd5": "明日",
    "w_794b4334a01909b6": "置く",
    "w_be0c2a8c15c51508": "押す",
    "w_3c9e0c4d130ffe55": "掛かる",
    "w_44191f7e02bdbca4": "掛ける",
    "w_e08e5b558857d76c": "風邪",
    "w_232fd4c69baafd5f": "差す",
    "w_8599f01b62ec3b89": "閉める",
    "w_409c10a69baafd5f": "出る",
    "w_6ec2f5694292b36a": "取る",
    "w_f12b7cd5ea51cf7a": "貼る",
    "w_38856be7d8a54293": "欲しい",
    "w_ac9371491b36f6a2": "帽子",
    "w_9c2d3700794d4e08": "昨夜",
    "w_98601c5f9fe56540": "上手い",
    "w_2afc4f4102d1bf3f": "喧嘩",
    "w_f47ff1eed7e97a5c": "さっき",
    "w_2e1101ee126c77c4": "とうとう",
    "w_8fdb066e76411edb": "諦める",
    "w_59e6ccaef4f27f08": "溜まる",
    "w_128d29f45bc02c6a": "大体",
    "w_a61620b169657c43": "剥く",
    "w_05060983e5f24a85": "延ばす",
    "w_c36280d2912eaabe": "掬う",
    "w_3fdb6246f1e9c47f": "只",
    "w_52019f7d0cd6186e": "概ね",
    "w_00b884bb498a4ecb": "術",
    # Automatic tie-break corrections.
    "w_c01b591995b9335a": "飛ぶ",
    "w_e8bf101d5d035c24": "初めて",
    "w_50ffd2ba2cc08cff": "二日",
    "w_5b4445d187ac74c5": "二十歳",
    "w_d09fc1ab6a37791a": "点く",
    "w_1ffdc03d4cddffda": "嫌み",
    "w_38c9c0e9cf84d685": "蘇る",
    "w_690a4fa3e51077a6": "清々しい",
    "w_b44959bb47bfe991": "大勢",
    "w_3c8a052098392b1a": "降りる",
}


# Valid but pedagogically unhelpful/obsolete kanji spellings stay in kana.
KEEP_KANA_IDS: set[str] = {
    "w_66c87676a778f34f",  # おや (interjection), not 親
    "w_b685581646830d57",  # こちらこそ, not obscure 此方こそ
    "w_035875c57095c84d",  # それでは, not obscure 其れでは
    "w_2c0a491e51162b7d",  # だらしない
    "w_3f0352fdd33c8b6b",  # どうしようもない
    "w_df2c2e00cd40ceee",  # やんわり
    "w_4fdd9f73dd3e62a1",  # ページ, not uncommon 頁 spelling
    "w_31141f538d260d85",  # つまらない, not outdated 詰らない
    "w_98601c5f9fe56540",  # うまい combines tasty/skilled senses
    "w_f47ff1eed7e97a5c",  # さっき, not an unrelated homophone
    "w_2e1101ee126c77c4",  # とうとう, not 等々
    "w_ec666a473c6c95cc",  # なるべく, not archaic 成るべく
    "w_04d5f5cb597c1c62",  # いらっしゃる, not uncommon 居らっしゃる
    "w_0eb7fb9f9547d8f1",  # いつも, not uncommon 何時も
    "w_dd6cfb328dbd2400",  # せい (cause), not 性
    "w_3ad346e39e2ff177",  # つまり (in other words), not 詰まり
    "w_18a15a1c8844b218",  # そのまま, not obscure 其の儘
    "w_66e3b8ac6e5991e1",  # まごつく, not obscure 間誤つく
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--words", type=Path, default=Path("data/pdf-vocab/jlpt_final_wordlist.csv")
    )
    parser.add_argument(
        "--examples", type=Path, default=Path("data/pdf-vocab/examples_final_qa_work.csv")
    )
    parser.add_argument("--jmdict", type=Path, default=Path(".cache/JMdict_e.gz"))
    parser.add_argument(
        "--csv-out", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_audit.csv")
    )
    parser.add_argument(
        "--json-out", type=Path, default=Path("data/pdf-vocab/jlpt_orthography_overrides.json")
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


def load_jmdict(path: Path, readings: set[str]) -> dict[str, list[dict[str, Any]]]:
    entries: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            forms = [
                {
                    "surface": node.findtext("keb") or "",
                    "priority": [item.text or "" for item in node.findall("ke_pri")],
                    "info": [item.text or "" for item in node.findall("ke_inf")],
                }
                for node in entry.findall("k_ele")
            ]
            senses = [
                {
                    "misc": [item.text or "" for item in sense.findall("misc")],
                    "gloss": [item.text or "" for item in sense.findall("gloss")][:4],
                }
                for sense in entry.findall("sense")
            ]
            for reading_node in entry.findall("r_ele"):
                reading = reading_node.findtext("reb") or ""
                if reading not in readings:
                    continue
                restrictions = {
                    item.text or "" for item in reading_node.findall("re_restr")
                }
                applicable = [
                    form
                    for form in forms
                    if not restrictions or form["surface"] in restrictions
                ]
                entries[reading].append(
                    {
                        "sequence": entry.findtext("ent_seq") or "",
                        "forms": applicable,
                        "no_kanji": reading_node.find("re_nokanji") is not None,
                        "senses": senses,
                    }
                )
            entry.clear()
    return entries


def usually_kana(entry: dict[str, Any]) -> bool:
    return any(
        KANA_USUAL in marker
        for sense in entry["senses"]
        for marker in sense["misc"]
    )


def proposed_surface(
    row: dict[str, str],
    example: str,
    entries: list[dict[str, Any]],
) -> tuple[str, str, str]:
    word_id = row["id"]
    if word_id in KEEP_KANA_IDS:
        return "", "keep-kana-reviewed", "explicit modern-kana preference"
    if word_id in MANUAL_BY_ID:
        return MANUAL_BY_ID[word_id], "manual-context", "meaning and inflection reviewed"
    if word_id in PREFERRED_BY_ID:
        return PREFERRED_BY_ID[word_id], "manual-homophone", "meaning-sensitive JMdict choice"

    viable = [entry for entry in entries if entry["forms"] and not entry["no_kanji"]]
    has_kana_only_entry = any(entry["no_kanji"] or not entry["forms"] for entry in entries)
    candidates = sorted(
        (
            form_priority(form["priority"], form["info"]),
            form["surface"],
            entry,
        )
        for entry in viable
        for form in entry["forms"]
        if form["surface"]
    )
    candidates.sort(key=lambda item: (-item[0], item[1]))

    # A curated example that replaces the kana headword with exactly one JMdict
    # kanji form is stronger evidence than arbitrary JMdict form ordering.
    mentioned = [item for item in candidates if item[1] in example]
    mentioned_surfaces = {item[1] for item in mentioned}
    if (
        len(mentioned_surfaces) == 1
        and row["surface"] not in example
        and not has_kana_only_entry
    ):
        chosen = mentioned[0]
        if chosen[0] > 0 or not usually_kana(chosen[2]):
            return chosen[1], "example-exact", "unique JMdict form occurs in curated example"

    if len(entries) == 1 and viable and candidates and not has_kana_only_entry:
        chosen = candidates[0]
        if chosen[0] > 0 or not usually_kana(chosen[2]):
            evidence = "common JMdict form" if chosen[0] > 0 else "unambiguous JMdict form"
            return chosen[1], "jmdict-unambiguous", evidence

    return "", "needs-review" if candidates else "keep-kana", "ambiguous or no common kanji form"


def main() -> None:
    args = parse_args()
    words = read_csv(args.words)
    examples = {
        row["word_id"]: row["jp"]
        for row in read_csv(args.examples)
        if row.get("word_id") and row.get("jp")
    }
    kana_rows = [row for row in words if not KANJI_RE.search(row["surface"])]
    entries = load_jmdict(args.jmdict, {row["reading_kana"] for row in kana_rows})
    existing_pairs = {(row["surface"], row["reading_kana"]): row for row in words}

    audit: list[dict[str, Any]] = []
    overrides: dict[str, dict[str, Any]] = {}
    for row in kana_rows:
        display, decision, evidence = proposed_surface(
            row, examples.get(row["id"], ""), entries.get(row["reading_kana"], [])
        )
        collision = existing_pairs.get((display, row["reading_kana"])) if display else None
        item = {
            "id": row["id"],
            "level": row["level"],
            "surface": row["surface"],
            "reading_kana": row["reading_kana"],
            "meaning_ko": row["meaning_ko"],
            "display_surface": display,
            "decision": decision,
            "evidence": evidence,
            "collides_with": collision["id"] if collision and collision["id"] != row["id"] else "",
            "example_jp": examples.get(row["id"], ""),
        }
        audit.append(item)
        if display and display != row["surface"]:
            overrides[row["id"]] = {
                "surface": row["surface"],
                "reading_kana": row["reading_kana"],
                "display_surface": display,
                "decision": decision,
                "evidence": evidence,
                "collides_with": item["collides_with"],
            }

    args.csv_out.parent.mkdir(parents=True, exist_ok=True)
    with args.csv_out.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(audit[0]))
        writer.writeheader()
        writer.writerows(audit)

    # An explicit keep decision may return the original spelling; do not count it
    # as an override or emit a no-op display mapping.
    for item in audit:
        if item["display_surface"] == item["surface"]:
            item["display_surface"] = ""
            item["collides_with"] = ""

    summary = {
        "total_words": len(words),
        "kana_only_audited": len(kana_rows),
        "kanji_display_overrides": len(overrides),
        "display_collisions": sum(bool(item["collides_with"]) for item in audit),
        "kept_or_needs_review": len(kana_rows) - len(overrides),
    }
    payload = {"summary": summary, "overrides": overrides}
    args.json_out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
