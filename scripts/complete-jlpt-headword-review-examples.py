#!/usr/bin/env python3
"""Canonicalize changed examples and add self-authored backfill examples."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote


FIELDS = (
    "word_id", "jp", "ko", "source", "source_url", "license",
    "permission_status", "attribution", "captured_at", "qa_status",
    "sort_order", "naver_example_id", "naver_source_cid", "naver_source_name",
    "query", "qa_note",
)

BACKFILL_EXAMPLES = {
    "w_65b969c52dc19ac2": ("水を少し飲みました。", "물을 조금 마셨습니다."),
    "w_aee488186f66c2a2": ("この紙は白です。", "이 종이는 흰색입니다."),
    "w_039c519fd62d3882": ("毎朝、新聞を読みます。", "매일 아침 신문을 읽습니다."),
    "w_4c61acba86c4d604": ("水曜日に図書館へ行きます。", "수요일에 도서관에 갑니다."),
    "w_1e9f921233a4335f": (
        "長い間ご無沙汰して、すみません。",
        "오랫동안 연락드리지 못해 죄송합니다.",
    ),
    "w_393a2f780ea3a234": ("先々月、日本へ出張しました。", "지지난달에 일본으로 출장 갔습니다."),
    "w_efac32fc7e566446": (
        "先々週からこの本を読んでいます。",
        "지지난주부터 이 책을 읽고 있습니다.",
    ),
    "w_007680925f9898a2": ("火口から煙が上がっている。", "분화구에서 연기가 피어오르고 있다."),
    "w_c12c4efe43384aa2": ("茶色い靴を買いました。", "갈색 신발을 샀습니다."),
    "w_43c420f6bdcd573b": ("笑いたいのを必死に堪えた。", "웃고 싶은 것을 필사적으로 참았다."),
    "w_3f7be39781ba3513": ("この道は駅に通じている。", "이 길은 역으로 이어져 있다."),
    "w_f1fcc99d67415f95": (
        "他人の成功を羨んでも仕方がない。",
        "다른 사람의 성공을 부러워해도 소용없다.",
    ),
    "w_b98563c83919ac09": ("最後の一分で試合を逆転した。", "마지막 1분에 경기를 역전했다."),
    "w_21dd11caaa9c3389": ("注意事項をよく読んでください。", "주의 사항을 잘 읽어 주세요."),
    "w_aa4d76b169602e1e": (
        "彼はその事件への関与を否定した。",
        "그는 그 사건에 관여했다는 사실을 부인했다.",
    ),
    "w_10284144fa6f8fa9": (
        "受付で身分証明書を提示してください。",
        "접수처에서 신분증을 제시해 주세요.",
    ),
    "w_74f7e87454f7a2e7": ("今回だけは勘弁してください。", "이번만은 용서해 주세요."),
    "w_261a31967386799c": (
        "被災者を救済する制度が必要だ。",
        "재해 피해자를 구제하는 제도가 필요하다.",
    ),
    "w_1a549e7eef1574a3": (
        "市場の動向を注意深く見守る。",
        "시장의 동향을 주의 깊게 지켜본다.",
    ),
}

BACKFILL_MATCHES = {
    "w_43c420f6bdcd573b": "堪え",
    "w_3f7be39781ba3513": "通じ",
    "w_f1fcc99d67415f95": "羨ん",
}

EXAMPLE_REWRITES = {
    "w_053f7db9e9a81e55": ("学校で新しい友達ができました。", "학교에서 새로운 친구가 생겼습니다."),
    "w_26913edea9440b3b": ("子供たちが公園で遊んでいます。", "아이들이 공원에서 놀고 있습니다."),
    "w_245d63ae14dc7240": ("火曜日に友達と会います。", "화요일에 친구를 만납니다."),
    "w_2cd841d468cc927a": ("金曜日は仕事が早く終わります。", "금요일에는 일이 일찍 끝납니다."),
    "w_078c37ed2c920c51": ("土曜日に家族と買い物に行きます。", "토요일에 가족과 쇼핑하러 갑니다."),
    "w_716e7b794dbcaf51": ("木曜日に病院へ行きます。", "목요일에 병원에 갑니다."),
    "w_58ebca3b2291ffb6": ("石鹸で手を洗います。", "비누로 손을 씻습니다."),
    "w_728f59d1c6f9c5f4": ("出かける前に靴を履きます。", "외출하기 전에 신발을 신습니다."),
    "w_2a768ef5dc0abdb7": (
        "豆腐にはタンパク質が多く含まれている。",
        "두부에는 단백질이 많이 들어 있다.",
    ),
    "w_157443e88683e1c9": (
        "環境に関わる問題について話し合った。",
        "환경과 관련된 문제에 관해 논의했다.",
    ),
    "w_2042955fbd7ed6b5": (
        "電話をかけたが、相手は話し中だった。",
        "전화를 걸었지만 상대는 통화 중이었다.",
    ),
    "w_ec8e542da036aeea": (
        "駅の近くに小さな店が一軒あります。",
        "역 근처에 작은 가게가 한 채 있습니다.",
    ),
}

CHANGED_MATCHES = {
    "w_728f59d1c6f9c5f4": "履き",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--words", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_wordlist.csv"),
    )
    parser.add_argument(
        "--old-words", type=Path,
        default=Path("data/pdf-vocab/jlpt_orthography_wordlist.csv"),
    )
    parser.add_argument(
        "--seed", type=Path,
        default=Path("data/pdf-vocab/examples_headword_review_seed.csv"),
    )
    parser.add_argument(
        "--manifest", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_manifest.json"),
    )
    parser.add_argument(
        "--out", type=Path,
        default=Path("data/pdf-vocab/examples_headword_review_qa_work.csv"),
    )
    parser.add_argument(
        "--words-out", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_wordlist_final.csv"),
    )
    parser.add_argument(
        "--words-json-out", type=Path,
        default=Path("data/pdf-vocab/jlpt_headword_review_wordlist_final.json"),
    )
    parser.add_argument(
        "--report", type=Path,
        default=Path("data/pdf-vocab/examples_headword_review_report.json"),
    )
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in FIELDS})


def main() -> None:
    args = parse_args()
    word_rows = read_csv(args.words)
    words = {row["id"]: row for row in word_rows}
    old_words = {row["id"]: row for row in read_csv(args.old_words)}
    examples = {row["word_id"]: row for row in read_csv(args.seed)}
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    changed_example_ids: list[str] = []

    for word_id in manifest["changed_ids"]:
        if word_id not in examples:
            continue
        new_surface = words[word_id]["surface"]
        old_surface = old_words[word_id]["surface"]
        row = examples[word_id]
        if new_surface not in row["jp"] and old_surface in row["jp"]:
            row["jp"] = row["jp"].replace(old_surface, new_surface)
            row["query"] = new_surface
            note = row.get("qa_note", "").strip()
            addition = f"전수 표기 교정에 맞춰 예문 {old_surface}→{new_surface} 동기화"
            row["qa_note"] = f"{note}; {addition}" if note else addition
            changed_example_ids.append(word_id)

    captured_at = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    rewritten_example_ids: list[str] = []
    for word_id, (jp, ko) in EXAMPLE_REWRITES.items():
        if word_id not in examples or word_id not in words:
            raise RuntimeError(f"example rewrite word is missing: {word_id}")
        surface = words[word_id]["surface"]
        row = examples[word_id]
        row.update(
            {
                "jp": jp,
                "ko": ko,
                "source": "self",
                "source_url": "https://ja.dict.naver.com/#/search?query=" + quote(surface),
                "license": "self",
                "permission_status": "self",
                "attribution": "AshitaKanji 편집 예문",
                "captured_at": captured_at,
                "qa_status": "auto",
                "naver_example_id": "",
                "naver_source_cid": "",
                "naver_source_name": "",
                "query": surface,
                "qa_note": "자체 작성·번역; 표제어 교정 후 초급 학습 문맥으로 재작성",
            }
        )
        rewritten_example_ids.append(word_id)
    for word_id, (jp, ko) in BACKFILL_EXAMPLES.items():
        if word_id not in words:
            raise RuntimeError(f"backfill example word is missing: {word_id}")
        surface = words[word_id]["surface"]
        examples[word_id] = {
            "word_id": word_id,
            "jp": jp,
            "ko": ko,
            "source": "self",
            "source_url": "https://ja.dict.naver.com/#/search?query=" + quote(surface),
            "license": "self",
            "permission_status": "self",
            "attribution": "AshitaKanji 편집 예문",
            "captured_at": captured_at,
            "qa_status": "auto",
            "sort_order": "0",
            "naver_example_id": "",
            "naver_source_cid": "",
            "naver_source_name": "",
            "query": surface,
            "qa_note": "자체 작성·번역; NAVER 일본어사전에서 표제어 용법 확인; 전수 표제어 QA",
        }

    unknown = sorted(set(examples) - set(words))
    missing = sorted(set(words) - set(examples))
    blank = sorted(
        word_id for word_id, row in examples.items()
        if not row.get("jp", "").strip() or not row.get("ko", "").strip()
    )
    target_misses = sorted(
        word_id for word_id in BACKFILL_EXAMPLES
        if BACKFILL_MATCHES.get(word_id, words[word_id]["surface"])
        not in examples[word_id]["jp"]
    )
    changed_surface_misses = sorted(
        word_id for word_id in manifest["changed_ids"]
        if word_id in examples
        and CHANGED_MATCHES.get(word_id, words[word_id]["surface"])
        not in examples[word_id]["jp"]
    )
    # Conjugated verbs can legitimately omit the exact dictionary ending, but
    # every surface changed in this pass is expected to remain exact in its example.
    if unknown or missing or blank or target_misses or changed_surface_misses:
        raise RuntimeError(
            "example validation failed: "
            f"unknown={unknown[:5]} missing={missing[:5]} blank={blank[:5]} "
            f"target_misses={target_misses[:5]} changed_misses={changed_surface_misses[:5]}"
        )

    rows = sorted(examples.values(), key=lambda row: row["word_id"])
    write_csv(args.out, rows)
    word_fields = tuple(word_rows[0].keys())
    for word in word_rows:
        example = examples[word["id"]]
        word["example_jp"] = example["jp"]
        word["example_ko"] = example["ko"]
        word["example_jp_author"] = example.get("attribution", "")
        word["example_license"] = example.get("license", "")
    args.words_out.parent.mkdir(parents=True, exist_ok=True)
    with args.words_out.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=word_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({field: row.get(field, "") for field in word_fields} for row in word_rows)
    words_document = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(word_rows),
        "source": str(args.words),
        "vocabulary": word_rows,
    }
    args.words_json_out.parent.mkdir(parents=True, exist_ok=True)
    args.words_json_out.write_text(
        json.dumps(words_document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report = {
        "status": "PASS",
        "word_count": len(words),
        "example_count": len(rows),
        "canonicalized_existing_examples": len(changed_example_ids),
        "canonicalized_existing_example_ids": sorted(changed_example_ids),
        "rewritten_existing_examples": len(rewritten_example_ids),
        "rewritten_existing_example_ids": sorted(rewritten_example_ids),
        "self_authored_backfill_examples": len(BACKFILL_EXAMPLES),
        "self_authored_backfill_ids": sorted(BACKFILL_EXAMPLES),
        "missing": 0,
        "unknown": 0,
        "blank": 0,
        "target_misses": 0,
        "synced_word_rows": len(word_rows),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
