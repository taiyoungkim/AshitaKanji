#!/usr/bin/env python3
"""Drop な-adjective duplicates and restore per-level 6638 counts."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from wordfreq import zipf_frequency

LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: i for i, level in enumerate(LEVELS)}
TARGET_COUNTS = {"N5": 339, "N4": 600, "N3": 1499, "N2": 1700, "N1": 2500}
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

# N1 37 / N3 10 — unused verified QA rows. First 10 N1 keep cleared NAVER examples.
BACKFILLS = [
    ("N1", "w_c97b11e6ab1be52d", "naver"),
    ("N1", "w_6eb5db28959e8997", "naver"),
    ("N1", "w_191dfbbe75110b87", "naver"),
    ("N1", "w_48a942088c2a3c4f", "naver"),
    ("N1", "w_bb08904f23e2f634", "naver"),
    ("N1", "w_4449a3e240899014", "naver"),
    ("N1", "w_4b6957098523bfbf", "naver"),
    ("N1", "w_1bbdac2276d06c29", "naver"),
    ("N1", "w_b186b411d3378bf0", "naver"),
    ("N1", "w_aea6e104360336b5", "naver"),
    ("N1", "w_2026b6b32990426e", "self", "食堂で定食を注文した。", "식당에서 정식을 주문했다."),
    ("N1", "w_fde1cf586d8156ad", "self", "展覧会の観覧券を買った。", "전시회 관람권을 샀다."),
    ("N1", "w_0d2e035038fd2112", "self", "神社に仕える仕事をしている。", "신사에서 섬기는 일을 하고 있다."),
    ("N1", "w_f90dd87cee0db62b", "self", "犬に新しい首輪を付けた。", "개에게 새 목걸이를 채워 주었다."),
    ("N1", "w_f5c412b586dc076e", "self", "駅前で昼飯を済ませた。", "역앞에서 점심을 해결했다."),
    ("N1", "w_b0f4bce3104bf1ab", "self", "机の上に私物を置かないでください。", "책상 위에 개인 물건을 두지 마세요."),
    ("N1", "w_9ba5cbd4b3f88eaf", "self", "選手は等級ごとに分かれる。", "선수는 등급별로 나뉜다."),
    ("N1", "w_8d440df94f874e3d", "self", "新入生向けの案内がある。", "신입생을 위한 안내가 있다."),
    ("N1", "w_ce400948a4bd2903", "self", "税務署に書類を提出した。", "세무서에 서류를 제출했다."),
    ("N1", "w_297abfe50b158c32", "self", "仕事に区切りを付けたい。", "일에 매듭을 짓고 싶다."),
    ("N1", "w_4d7acd386cf44adf", "self", "その薬品は体に危害を及ぼす。", "그 약품은 몸에 해를 끼친다."),
    ("N1", "w_9e880a7b23f69c39", "self", "無論、反対はしない。", "물론 반대하지 않는다."),
    ("N1", "w_3bd2b2abe2a89189", "self", "その服は窮屈で着にくい。", "그 옷은 갑갑해서 입기 힘들다."),
    ("N1", "w_d68f81e25ebc16a6", "self", "天地がひっくり返るようだった。", "천지가 뒤집히는 것 같았다."),
    ("N1", "w_07b3929512d229c4", "self", "コンサートへの来場者が増えた。", "콘서트 참석자가 늘었다."),
    ("N1", "w_012a3956391c7abf", "self", "揃いの制服を着ている。", "맞춰 입은 교복을 입고 있다."),
    ("N1", "w_955f496f0673fc78", "self", "彼の生き方には粋がある。", "그의 사는 방식에는 멋이 있다."),
    ("N1", "w_ec9e607fc8bac604", "self", "欲深い人だと思われた。", "욕심 많은 사람으로 보였다."),
    ("N1", "w_7ea1acd07319c07b", "self", "帝国は隣国を滅ぼす計画を立てた。", "제국은 이웃 나라를 멸망시킬 계획을 세웠다."),
    ("N1", "w_f6a5dec8e420f557", "self", "ただの世辞だと思った。", "그저 빈말이라고 생각했다."),
    ("N1", "w_7242f9295eb55a17", "self", "村の役場で手続きをした。", "마을 사무소에서 수속을 했다."),
    ("N1", "w_69e2159df1fe1017", "self", "色を組み合わせるのが難しい。", "색을 조합하는 일이 어렵다."),
    ("N1", "w_65741a2d9cd1b73b", "self", "店を構える場所を探している。", "가게를 낼 장소를 찾고 있다."),
    ("N1", "w_effc91aeacccca08", "self", "執筆で生計を立てている。", "집필로 생계를 잇고 있다."),
    ("N1", "w_64743e419fe04f91", "self", "先輩の仕事を手本にする。", "선배의 일을 본보기로 삼는다."),
    ("N1", "w_4b443a5d13ad2b4c", "self", "面白い喜劇を見た。", "재미있는 희극을 보았다."),
    ("N1", "w_f63f959c0ec9f805", "self", "彼の消息が分からない。", "그의 소식이 궁금하다."),
    ("N3", "w_ad199ec93837f88c", "self", "割れた皿を捨てました。", "깨진 접시를 버렸습니다."),
    ("N3", "w_2f256f75a63c5742", "self", "日本には四季があります。", "일본에는 사계절이 있습니다."),
    ("N3", "w_d8b3e84d92486874", "self", "今日は湿度が高いです。", "오늘은 습도가 높습니다."),
    ("N3", "w_488258c2323a5ce5", "self", "銀行の支店は駅の前です。", "은행 지점은 역 앞입니다."),
    ("N3", "w_12939f589a0b61a0", "self", "公園の芝生に座った。", "공원 잔디에 앉았다."),
    ("N3", "w_bf30f1583d89c4b0", "self", "ホテルに一泊宿泊した。", "호텔에 하룻밤 숙박했다."),
    ("N3", "w_b9599de28963836c", "self", "彼は有名な詩人です。", "그는 유명한 시인입니다."),
    ("N3", "w_dd9e841a5617210f", "self", "試験の結果に失望した。", "시험 결과에 실망했다."),
    ("N3", "w_664972e7c1fa3bf3", "self", "週末に芝居を見に行く。", "주말에 연극을 보러 간다."),
    ("N3", "w_4c934f2120b1a7b8", "self", "食べ過ぎて胃が痛い。", "과식해서 위가 아프다."),
]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--words", type=Path, default=Path("data/pdf-vocab/jlpt_final_wordlist.csv"))
    p.add_argument("--examples", type=Path, default=Path("data/pdf-vocab/examples_final_qa_work.csv"))
    p.add_argument("--qa", type=Path, default=Path("data/track-a/jlpt_qa_work.csv"))
    p.add_argument("--candidate-examples", type=Path, default=Path("data/track-a/naver_examples_qa_work.csv"))
    p.add_argument("--naver-final", type=Path, default=Path("data/pdf-vocab/naver_examples_final_qa_work.csv"))
    p.add_argument("--csv-out", type=Path, default=Path("data/pdf-vocab/jlpt_na_dedupe_wordlist.csv"))
    p.add_argument("--json-out", type=Path, default=Path("data/pdf-vocab/jlpt_na_dedupe_wordlist.json"))
    p.add_argument("--examples-out", type=Path, default=Path("data/pdf-vocab/examples_na_dedupe_qa_work.csv"))
    p.add_argument("--manifest-out", type=Path, default=Path("data/pdf-vocab/jlpt_na_adjective_dedupe_manifest.json"))
    p.add_argument("--promote", action="store_true")
    return p.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(
            {field: "" if row.get(field) is None else row.get(field) for field in fields}
            for row in rows
        )


def parse_array(value: Any) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return list(dict.fromkeys(str(item).strip() for item in parsed if str(item).strip()))
    except json.JSONDecodeError:
        pass
    return list(dict.fromkeys(part.strip() for part in text.split(";") if part.strip()))


def with_values(value: Any, *items: str) -> str:
    values = parse_array(value)
    for item in items:
        if item and item not in values:
            values.append(item)
    return json.dumps(values, ensure_ascii=False, separators=(",", ":"))


def infer_card_type(surface: str) -> str:
    import re
    if all("ぁ" <= ch <= "ゟ" or ch == "ー" for ch in surface):
        return "C"
    if all("゠" <= ch <= "ヿ" or ch == "ー" for ch in surface):
        return "D"
    has_kanji = bool(re.search(r"[一-龯々〆ヶ]", surface))
    has_hira = any("ぁ" <= ch <= "ゟ" for ch in surface)
    if has_kanji and has_hira:
        return "B"
    return "A" if has_kanji else "E"


def find_na_pairs(rows: list[dict[str, str]]) -> list[tuple[dict[str, str], dict[str, str]]]:
    by_surface = {row["surface"]: [] for row in rows}
    for row in rows:
        by_surface[row["surface"]].append(row)
    pairs = []
    for row in rows:
        surface = row["surface"]
        if not surface.endswith("な") or len(surface) <= 1:
            continue
        stem = surface[:-1]
        stem_reading = row["reading_kana"][:-1] if row["reading_kana"].endswith("な") else row["reading_kana"]
        matches = [
            other for other in rows
            if other["id"] != row["id"]
            and other["surface"] == stem
            and other["reading_kana"] in (stem_reading, row["reading_kana"])
        ]
        if len(matches) == 1:
            pairs.append((matches[0], row))
    return pairs


def self_example(word_id: str, surface: str, jp: str, ko: str, captured_at: str) -> dict[str, str]:
    if surface not in jp:
        raise RuntimeError(f"self example must contain {surface}: {jp}")
    return {
        "word_id": word_id, "jp": jp, "ko": ko, "source": "self",
        "source_url": "", "license": "self", "permission_status": "self",
        "attribution": "self", "captured_at": captured_at, "qa_status": "verified",
        "sort_order": "0", "naver_example_id": "", "naver_source_cid": "",
        "naver_source_name": "", "query": surface,
        "qa_note": "na-adjective-dedupe backfill",
    }


def main() -> None:
    args = parse_args()
    words = read_csv(args.words)
    examples = {row["word_id"]: row for row in read_csv(args.examples)}
    qa = {row["id"]: row for row in read_csv(args.qa)}
    candidate_examples = {row["word_id"]: row for row in read_csv(args.candidate_examples)}
    pairs = find_na_pairs(words)
    if len(pairs) != 47:
        raise RuntimeError(f"expected 47 な-pairs, found {len(pairs)}")

    drop_ids = {na["id"] for _, na in pairs}
    successors = {na["id"]: stem["id"] for stem, na in pairs}
    active = {row["id"]: dict(row) for row in words if row["id"] not in drop_ids}

    captured_at = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    backfill_rows: list[dict[str, Any]] = []
    backfill_examples: dict[str, dict[str, str]] = {}
    for item in BACKFILLS:
        level, word_id, kind = item[0], item[1], item[2]
        source = qa.get(word_id)
        if not source:
            raise RuntimeError(f"missing QA row {word_id}")
        if source["id"] in active:
            raise RuntimeError(f"backfill already active: {word_id}")
        row = {field: source.get(field, "") for field in WORD_FIELDS}
        row.update({
            "level": level,
            "card_type": infer_card_type(source["surface"]),
            "qa_status": "verified",
            "deprecated": "0",
            "data_version": "2",
            "deprecated_reason": "",
            "superseded_by": "",
            "tags": with_values(source.get("tags"), "na-adjective-dedupe-backfill"),
            "source": with_values(source.get("source"), "na-adjective-dedupe-backfill"),
        })
        if kind == "naver":
            example = candidate_examples.get(word_id)
            if not example:
                raise RuntimeError(f"missing NAVER example for {word_id}")
            example = dict(example)
            for field in EXAMPLE_FIELDS:
                example.setdefault(field, "")
            example["word_id"] = word_id
        else:
            example = self_example(word_id, source["surface"], item[3], item[4], captured_at)
        backfill_examples[word_id] = example
        active[word_id] = row
        backfill_rows.append(row)

    final_rows = list(active.values())
    for row in final_rows:
        row["frequency"] = f"{zipf_frequency(str(row['surface']), 'ja'):.3f}"
    for level in LEVELS:
        level_rows = sorted(
            (row for row in final_rows if row["level"] == level),
            key=lambda row: (-float(row["frequency"]), row["surface"], row["id"]),
        )
        for index, row in enumerate(level_rows):
            row["reading_chapter"] = str(index // 50 + 1)
    final_rows.sort(key=lambda row: (
        LEVEL_RANK[row["level"]], int(row["reading_chapter"]),
        -float(row["frequency"]), row["surface"], row["id"],
    ))

    example_by_id = {wid: dict(ex) for wid, ex in examples.items() if wid not in drop_ids}
    example_by_id.update(backfill_examples)
    missing = sorted({row["id"] for row in final_rows} - set(example_by_id))
    if missing:
        raise RuntimeError(f"missing examples: {missing[:8]}")

    for row in final_rows:
        example = example_by_id[row["id"]]
        row.update({
            "example_jp": example["jp"],
            "example_ko": example["ko"],
            "example_license": example.get("license", ""),
        })

    levels = Counter(row["level"] for row in final_rows)
    ids = [row["id"] for row in final_rows]
    pairs_key = [(row["surface"], row["reading_kana"]) for row in final_rows]
    if len(final_rows) != 6638 or len(set(ids)) != 6638 or len(set(pairs_key)) != 6638:
        raise RuntimeError("count/uniqueness failed")
    if any(levels[level] != TARGET_COUNTS[level] for level in LEVELS):
        raise RuntimeError(f"level counts failed: {dict(levels)}")
    leftover = find_na_pairs(final_rows)
    if leftover:
        raise RuntimeError(
            "な-pairs remain after dedupe: "
            + ", ".join(f"{na['surface']}→{stem['surface']}" for stem, na in leftover)
        )

    generated_at = datetime.now(timezone.utc).isoformat()
    document = {
        "generated_at": generated_at,
        "count": len(final_rows),
        "source": str(args.words),
        "vocabulary": [{field: row.get(field) for field in WORD_FIELDS} for row in final_rows],
    }
    manifest = {
        "generated_at": generated_at,
        "policy": "Keep the na-adjective stem; drop the な inflection as a separate study card.",
        "summary": {
            "dropped_na_forms": len(drop_ids),
            "backfills": len(backfill_rows),
            "backfill_counts": dict(Counter(row["level"] for row in backfill_rows)),
            "final_count": len(final_rows),
            "level_counts": dict(levels),
        },
        "dropped": [
            {
                "removed_id": na["id"],
                "retained_id": stem["id"],
                "removed_surface": na["surface"],
                "retained_surface": stem["surface"],
                "reading_kana": stem["reading_kana"],
                "removed_level": na["level"],
                "retained_level": stem["level"],
            }
            for stem, na in pairs
        ],
        "backfills": [
            {"id": row["id"], "level": row["level"], "surface": row["surface"],
             "reading_kana": row["reading_kana"], "meaning_ko": row["meaning_ko"]}
            for row in backfill_rows
        ],
        "successors": successors,
    }
    final_examples = sorted(example_by_id.values(), key=lambda row: row["word_id"])
    write_csv(args.csv_out, final_rows, WORD_FIELDS)
    args.json_out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(args.examples_out, final_examples, EXAMPLE_FIELDS)
    args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.promote:
        write_csv(Path("data/pdf-vocab/jlpt_final_wordlist.csv"), final_rows, WORD_FIELDS)
        Path("data/pdf-vocab/jlpt_final_wordlist.json").write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
        )
        naver_rows = [
            row for row in read_csv(args.naver_final) if row["word_id"] not in drop_ids
        ]
        for word_id, example in backfill_examples.items():
            if example.get("source") == "naver-ja-dict" or example.get("permission_status") == "cleared":
                if all(row["word_id"] != word_id for row in naver_rows):
                    naver_rows.append(example)
        write_csv(args.naver_final, sorted(naver_rows, key=lambda r: r["word_id"]), EXAMPLE_FIELDS)
        write_csv(Path("data/pdf-vocab/examples_final_qa_work.csv"), final_examples, EXAMPLE_FIELDS)

    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
