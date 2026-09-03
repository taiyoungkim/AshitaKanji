#!/usr/bin/env python3
"""Apply the 2026-08-19 priority vocabulary fixes in order.

P1 broken spelling/meanings/examples, P2 high-confidence NAVER levels,
P3 rare-kanji orthography, P4 な/だ duplicate collapse.  Level targets stay
N5 393 / N4 726 / N3 1499 / N2 1909 / N1 2500; dropped cards are backfilled
from the NAVER JLPT catalog using the same lexical filters as the rebalance pass.
"""

from __future__ import annotations

import argparse
import csv
import html
import importlib.util
import json
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/pdf-vocab"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LEVEL_RANK = {level: i for i, level in enumerate(LEVELS)}
EXPECTED = {"N5": 393, "N4": 726, "N3": 1499, "N2": 1909, "N1": 2500}
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
SELF_ATTRIBUTION = "AshitaKanji 편집 예문"
TAG = "priority-fix-2026-08-19"
KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
ADJ_POS = {"adjective", "na_adjective"}

MEANING_FIXES = {
    "w_86fa3ff38f45c9f6": "먼저, 먼저 실례합니다",
    "w_47d515589fa58fd2": "기다리게 해서 미안합니다",
    "w_5774ff04f7f580b5": "부탁합니다, 제발",
}

EXAMPLE_FIXES = {
    "w_91c6df1ecc084985": ("駅前の医院で熱を診てもらった。", "역앞 의원에서 열을 진찰받았다."),
    "w_28a0a4b3ffaf3efe": ("ハンドルを右に回す。", "핸들을 오른쪽으로 돌린다."),
    "w_5b4445d187ac74c5": ("来年で二十歳になる。", "내년에 스무 살이 된다."),
    "w_1fb1432fdae5690a": ("部屋の電気が点く。", "방의 불이 켜진다."),
    "w_8df0fff24f94cc63": ("電車代を払って改札を通った。", "전철 요금을 내고 개찰구를 통과했다."),
    "w_06e7e51d003ac3e4": ("夜の街はまだにぎやかだ。", "밤거리는 아직 붐빈다."),
    "w_9c2d3700794d4e08": ("昨夜は早く寝た。", "어젯밤에는 일찍 잤다."),
    "w_f12b7cd5ea51cf7a": ("壁にポスターを貼る。", "벽에 포스터를 붙인다."),
    "w_728f59d1c6f9c5f4": ("出かける前に靴を履く。", "외출하기 전에 신발을 신는다."),
}

ORTHOGRAPHY = {
    "w_3cf8a59fa4a831ad": {
        "surface": "まさか", "reading_kana": "まさか", "furigana": "まさか",
        "part_of_speech": "adverb", "meaning_ko": "설마",
    },
    "w_bd960bb319ab4a2a": {
        "surface": "あくび", "reading_kana": "あくび", "furigana": "あくび",
        "part_of_speech": "noun", "meaning_ko": "하품",
    },
    "w_878b871f0e14bc7c": {
        "surface": "かむ", "reading_kana": "かむ", "furigana": "かむ",
        "part_of_speech": "verb", "meaning_ko": "코를 풀다",
    },
    "w_cd8f0f97b64b50c1": {
        "surface": "どっち", "reading_kana": "どっち", "furigana": "どっち",
        "part_of_speech": "pronoun", "meaning_ko": "어느 쪽",
    },
    "w_69eda9773a03779e": {
        "surface": "空き地", "reading_kana": "あきち", "furigana": "あきち",
        "part_of_speech": "noun", "meaning_ko": "공터, 빈터",
    },
    "w_5a0c146e1f62fe06": {
        "surface": "あれこれ", "reading_kana": "あれこれ", "furigana": "あれこれ",
        "part_of_speech": "adverb", "meaning_ko": "이것저것",
    },
}

MERGE_DROPS = {
    "w_a844546befebc416": "w_93d81f41564b0400",  # 新ただ → 新た
    "w_1632528f965aa8ca": "w_83d7e9a89b603bbb",  # 負んぶ → おんぶ
    "w_d77f137891d73cca": "w_a2ca14c5418e955f",  # 摑む → 掴む
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--words", type=Path, default=DATA / "jlpt_final_wordlist.csv")
    parser.add_argument("--words-json", type=Path, default=DATA / "jlpt_final_wordlist.json")
    parser.add_argument("--naver-examples", type=Path, default=DATA / "naver_examples_final_qa_work.csv")
    parser.add_argument("--examples", type=Path, default=DATA / "examples_final_qa_work.csv")
    parser.add_argument("--issues", type=Path, default=DATA / "naver_full_verification_2026-08-19_issues.csv")
    parser.add_argument("--catalog", type=Path, default=ROOT / ".cache/naver-jlpt-catalog.json")
    parser.add_argument("--jmdict", type=Path, default=ROOT / ".cache/JMdict_e.gz")
    parser.add_argument("--manifest-out", type=Path, default=DATA / "jlpt_priority_fix_manifest.json")
    parser.add_argument("--additions-out", type=Path, default=DATA / "jlpt_priority_fix_additions.csv")
    parser.add_argument("--addition-examples", type=Path, default=DATA / "naver_examples_priority_fix_qa_work.csv")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-backfill", action="store_true")
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({field: "" if row.get(field) is None else row.get(field) for field in fields} for row in rows)


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


def self_example_row(word_id: str, surface: str, jp: str, ko: str, captured_at: str, note: str) -> dict[str, str]:
    return {
        "word_id": word_id,
        "jp": jp,
        "ko": ko,
        "source": "self",
        "source_url": "https://ja.dict.naver.com/#/search?query=" + quote(surface),
        "license": "self",
        "permission_status": "self",
        "attribution": SELF_ATTRIBUTION,
        "captured_at": captured_at,
        "qa_status": "verified",
        "sort_order": "0",
        "naver_example_id": "",
        "naver_source_cid": "",
        "naver_source_name": "",
        "query": surface,
        "qa_note": note,
    }


def apply_self_example(row: dict[str, Any], jp: str, ko: str) -> None:
    row["example_jp"] = jp
    row["example_ko"] = ko
    row["example_jp_author"] = SELF_ATTRIBUTION
    row["example_license"] = "self"


def retarget_id(row: dict[str, Any], new_id: str) -> None:
    row["id"] = new_id
    row["card_type"] = RB.infer_card_type(row["surface"])
    freq = zipf_frequency(row["surface"], "ja") or zipf_frequency(row["reading_kana"], "ja")
    row["frequency"] = f"{freq:.3f}"
    add_tag(row, TAG)


def adjective_stem(row: dict[str, str]) -> tuple[str, str] | None:
    if row.get("part_of_speech") not in ADJ_POS:
        return None
    surface = row["surface"]
    reading = row["reading_kana"]
    for suffix in ("だ", "な"):
        if surface.endswith(suffix) and reading.endswith(suffix) and len(surface) > len(suffix):
            stem_surface = surface[: -len(suffix)]
            stem_reading = reading[: -len(suffix)]
            if not stem_surface or not stem_reading:
                return None
            if not KANJI_RE.search(stem_surface) and len(stem_reading) < 2:
                return None
            return stem_surface, stem_reading
    return None


def load_level_moves(path: Path) -> dict[str, str]:
    moves = {}
    for row in read_csv(path):
        flags = set(row.get("issues", "").split(";"))
        if "level-mismatch-confirmed" not in flags:
            continue
        if row.get("catalog_status") != "mismatch":
            continue
        if row.get("catalog_level") != row.get("search_level"):
            continue
        if row.get("search_level") not in EXPECTED:
            continue
        if row.get("level") == row.get("search_level"):
            continue
        moves[row["id"]] = row["search_level"]
    return moves


def discouraged_kanji(info: set[str]) -> bool:
    blob = " ".join(sorted(info)).lower()
    return any(mark in blob for mark in ("rarely", "irregular", "out-dated", "outdated", "search-only"))


def choose_catalog_additions(
    words: list[dict[str, str]],
    deficits: dict[str, int],
    args: argparse.Namespace,
    reserved_ids: set[str],
    banned_surfaces: set[str],
) -> list[dict[str, Any]]:
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))["items"]
    existing_pairs = set()
    existing_semantic = set()
    existing_ids = {row["id"] for row in words} | set(reserved_ids)
    existing_pair_meanings: dict[tuple[str, str], set[str]] = {}
    for row in words:
        reading = RB.normalize(row["reading_kana"])
        existing_semantic.add((reading, RB.compact_meaning(row["meaning_ko"]).split("/")[0]))
        for form in [row["surface"], *RB.parse_alt_forms(row.get("alt_forms")), row["reading_kana"]]:
            if normalized := RB.dedupe_form(form):
                existing_pairs.add((normalized, reading))
                existing_pair_meanings.setdefault((normalized, reading), set()).add(row["meaning_ko"])
    raw_candidates = []
    for index, item in enumerate(catalog):
        level = str(item.get("level") or "")
        if deficits.get(level, 0) <= 0:
            continue
        reading = RB.normalize(item.get("entry"))
        forms = RB.split_naver_forms(item.get("pron")) or ([reading] if reading else [])
        meaning = RB.korean_meaning(item.get("means") or [])
        if not RB.candidate_is_lexical(item, reading, forms, meaning):
            continue
        if any((RB.dedupe_form(form), reading) in existing_pairs for form in forms):
            continue
        if any(form in banned_surfaces for form in forms):
            continue
        forms = [form for form in forms if not re.search(r"([一-龯])\1", form) and form not in banned_surfaces]
        if not forms:
            continue
        if (reading, RB.compact_meaning(meaning).split("/")[0]) in existing_semantic:
            continue
        raw_candidates.append({
            "catalog_index": index,
            "item": item,
            "level": level,
            "reading": reading,
            "forms": forms,
            "meaning": meaning,
        })
    candidate_pairs = {
        (form, candidate["reading"]) for candidate in raw_candidates for form in candidate["forms"]
    }
    jmdict = RB.load_jmdict_metadata(args.jmdict, candidate_pairs | set(existing_pair_meanings))
    sequence_existing_meanings: dict[str, set[str]] = {}
    for pair, meanings in existing_pair_meanings.items():
        for sequence in jmdict.get(pair, {}).get("sequences", set()):
            sequence_existing_meanings.setdefault(sequence, set()).update(meanings)
    eligible = []
    for candidate in raw_candidates:
        accepted = []
        for form_index, form in enumerate(candidate["forms"]):
            metadata = jmdict.get((form, candidate["reading"]))
            if not metadata:
                continue
            if discouraged_kanji(set(metadata["info"])):
                continue
            accepted.append((form, form_index, metadata))
        if not accepted:
            continue
        collided = {
            existing_meaning
            for _form, _index, metadata in accepted
            for sequence in metadata.get("sequences", set())
            for existing_meaning in sequence_existing_meanings.get(sequence, set())
        }
        if any(RB.meanings_overlap(candidate["meaning"], value) for value in collided):
            continue
        accepted.sort(key=lambda value: (
            -RB.priority_score(value[2]["priority"]),
            value[1],
            -zipf_frequency(value[0], "ja"),
            len(value[0]),
            value[0],
        ))
        surface, _index, metadata = accepted[0]
        candidate.update({
            "surface": surface,
            "priority_score": RB.priority_score(metadata["priority"]),
            "frequency": zipf_frequency(surface, "ja") or zipf_frequency(candidate["reading"], "ja"),
            "pair": (RB.dedupe_form(surface), candidate["reading"]),
            "id": RB.stable_word_id(surface, candidate["reading"]),
            "accepted": accepted,
        })
        if candidate["id"] in existing_ids:
            continue
        eligible.append(candidate)
    selected = []
    selected_pairs = set(existing_pairs)
    selected_semantic = set(existing_semantic)
    selected_ids = set(existing_ids)
    for level in LEVELS:
        need = deficits.get(level, 0)
        if need <= 0:
            continue
        pool = sorted(
            (item for item in eligible if item["level"] == level),
            key=lambda item: (-item["priority_score"], -item["frequency"], item["catalog_index"], item["surface"]),
        )
        picked = 0
        for candidate in pool:
            if picked >= need:
                break
            if candidate["id"] in selected_ids or candidate["pair"] in selected_pairs:
                continue
            semantic = (candidate["reading"], RB.compact_meaning(candidate["meaning"]).split("/")[0])
            if semantic in selected_semantic:
                continue
            selected.append(candidate)
            selected_ids.add(candidate["id"])
            selected_pairs.add(candidate["pair"])
            selected_semantic.add(semantic)
            picked += 1
        if picked != need:
            print(f"warning: {level} backfill short picked={picked} need={need}", flush=True)
    return selected


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


def extra_example_fixes(words: list[dict[str, str]]) -> dict[str, tuple[str, str]]:
    wanted = {
        "見逃す": ("小さな変化を見逃す。", "작은 변화를 놓친다."),
        "羨む": ("他人の成功を羨む。", "남의 성공을 부러워한다."),
        "通ずる": ("この道は駅に通ずる。", "이 길은 역으로 통한다."),
        "逆さ": ("絵を逆さにする。", "그림을 거꾸로 한다."),
        "誓う": ("未来を誓う。", "미래를 맹세한다."),
        "摩る": ("猫の頭を摩る。", "고양이 머리를 쓰다듬는다."),
    }
    found = {}
    for row in words:
        if row["surface"] in wanted:
            found[row["id"]] = wanted[row["surface"]]
    return found


def main() -> None:
    args = parse_args()
    words = read_csv(args.words)
    by_id = {row["id"]: row for row in words}
    naver_rows = read_csv(args.naver_examples)
    example_rows = read_csv(args.examples)
    captured_at = str(int(time.time() * 1000))
    successors: dict[str, str] = {}
    changes: list[dict[str, Any]] = []
    dropped_ids: set[str] = set()
    self_replaced: set[str] = set()
    example_fixes = dict(EXAMPLE_FIXES)
    example_fixes.update(extra_example_fixes(words))

    def note(kind: str, row: dict[str, str], **extra: Any) -> None:
        changes.append({"kind": kind, "id": row["id"], "level": row["level"],
                        "surface": row["surface"], "reading_kana": row["reading_kana"], **extra})

    # P1 meanings
    for word_id, meaning in MEANING_FIXES.items():
        row = by_id[word_id]
        before = row["meaning_ko"]
        row["meaning_ko"] = meaning
        add_tag(row, TAG)
        note("meaning", row, before=before, after=meaning)

    # P1/P5 examples
    for word_id, (jp, ko) in example_fixes.items():
        if word_id in MERGE_DROPS:
            continue
        row = by_id[word_id]
        apply_self_example(row, jp, ko)
        add_tag(row, TAG)
        self_replaced.add(word_id)
        note("example", row, example_jp=jp)

    # P2 levels
    moves = load_level_moves(args.issues)
    for word_id, new_level in moves.items():
        row = by_id[word_id]
        before = row["level"]
        row["level"] = new_level
        add_tag(row, "naver-level-corrected")
        add_tag(row, TAG)
        note("level", row, before=before, after=new_level)

    # P3 orthography rewrites
    for word_id, payload in ORTHOGRAPHY.items():
        row = by_id[word_id]
        old_id = row["id"]
        row.update(payload)
        row["furigana"] = payload["reading_kana"]
        new_id = RB.stable_word_id(row["surface"], row["reading_kana"])
        if new_id in by_id and new_id != old_id:
            raise RuntimeError(f"orthography collides: {row['surface']} {new_id}")
        retarget_id(row, new_id)
        if new_id != old_id:
            successors[old_id] = new_id
            by_id.pop(old_id)
            by_id[new_id] = row
            if old_id in self_replaced:
                self_replaced.remove(old_id)
                self_replaced.add(new_id)
            note("orthography", row, old_id=old_id, new_id=new_id)
        else:
            note("orthography-inplace", row)

    # P3/P1 explicit merges
    for old_id, new_id in MERGE_DROPS.items():
        if old_id not in by_id:
            continue
        if new_id not in by_id:
            raise RuntimeError(f"merge target missing: {old_id} -> {new_id}")
        row = by_id[old_id]
        successors[old_id] = new_id
        dropped_ids.add(old_id)
        note("merge-drop", row, successor=new_id)
        del by_id[old_id]

    words = [row for row in words if row["id"] in by_id]

    # P4 な/だ collapse
    pair_index: dict[tuple[str, str], dict[str, str]] = {
        (row["surface"], row["reading_kana"]): row for row in words
    }
    adj_forms = []
    for row in words:
        stem = adjective_stem(row)
        if stem:
            adj_forms.append((row, stem))
    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row, stem in adj_forms:
        grouped[stem].append(row)
    for stem, rows in grouped.items():
        stem_surface, stem_reading = stem
        existing = pair_index.get((stem_surface, stem_reading))
        extras = [row for row in rows if row["id"] not in dropped_ids]
        if existing and existing["id"] not in {row["id"] for row in extras}:
            winner = existing
            losers = extras
        elif existing:
            winner = existing
            losers = [row for row in extras if row["id"] != existing["id"]]
        else:
            winner = extras[0]
            old_id = winner["id"]
            winner["surface"] = stem_surface
            winner["reading_kana"] = stem_reading
            winner["furigana"] = stem_reading
            new_id = RB.stable_word_id(stem_surface, stem_reading)
            if new_id in by_id and new_id != old_id:
                # stem ID already taken by a different POS/reading collision; merge into it
                successors[old_id] = new_id
                dropped_ids.add(old_id)
                note("na-merge-existing", winner, successor=new_id)
                losers = extras[1:]
                for row in losers:
                    successors[row["id"]] = new_id
                    dropped_ids.add(row["id"])
                    note("na-drop", row, successor=new_id)
                continue
            retarget_id(winner, new_id)
            if new_id != old_id:
                successors[old_id] = new_id
                by_id.pop(old_id, None)
                by_id[new_id] = winner
                pair_index[(stem_surface, stem_reading)] = winner
                note("na-convert", winner, old_id=old_id, new_id=new_id)
            losers = extras[1:]
        for row in losers:
            successors[row["id"]] = winner["id"]
            dropped_ids.add(row["id"])
            note("na-drop", row, successor=winner["id"])

    if dropped_ids:
        words = [row for row in words if row["id"] not in dropped_ids]
        by_id = {row["id"]: row for row in words}

    refresh_sort(words)
    counts = Counter(row["level"] for row in words)
    deficits = {level: EXPECTED[level] - counts.get(level, 0) for level in LEVELS}
    additions: list[dict[str, Any]] = []
    if not args.skip_backfill:
        positive = {level: max(0, amount) for level, amount in deficits.items()}
        banned_surfaces = {
            "真逆", "負んぶ", "擤む", "何方", "空地", "摑む", "彼此", "新ただ", "欠",
        }
        banned_surfaces.update(item["surface"] for item in changes if item.get("kind") in {"merge-drop", "na-drop"})
        rebalance_excluded = set(json.loads(
            (DATA / "jlpt_naver_rebalance_manifest.json").read_text(encoding="utf-8")
        ).get("excluded_addition_ids", []))
        selected = choose_catalog_additions(
            words,
            positive,
            args,
            reserved_ids=set(successors) | dropped_ids | rebalance_excluded,
            banned_surfaces={item for item in banned_surfaces if item},
        ) if any(positive.values()) else []
        addition_examples = {
            row["word_id"]: row for row in read_csv(args.addition_examples)
        } if args.addition_examples.exists() else {}
        for candidate in selected:
            row = {field: "" for field in WORD_FIELDS}
            item = candidate["item"]
            row.update({
                "id": candidate["id"],
                "level": candidate["level"],
                "surface": candidate["surface"],
                "reading_kana": candidate["reading"],
                "furigana": candidate["reading"],
                "meaning_ko": candidate["meaning"],
                "part_of_speech": RB.select_pos(item.get("parts") or []),
                "card_type": RB.infer_card_type(candidate["surface"]),
                "source": "naver:ja-dict-jlpt-list",
                "qa_status": "verified",
                "deprecated": "0",
                "tags": json.dumps(
                    ["naver-level-backfill", "jmdict-exact", "ko-from-naver", TAG],
                    ensure_ascii=False, separators=(",", ":"),
                ),
                "data_version": "3",
                "frequency": f"{candidate['frequency']:.3f}",
            })
            example = addition_examples.get(row["id"])
            if example:
                row["example_jp"] = example["jp"]
                row["example_ko"] = example["ko"]
                row["example_jp_author"] = example.get("attribution", "")
                row["example_license"] = example.get("license", "")
            additions.append(row)
            words.append(row)
            by_id[row["id"]] = row
            note("backfill", row)
        refresh_sort(words)

    counts = Counter(row["level"] for row in words)
    missing_examples = [row["id"] for row in additions if not row.get("example_jp") or not row.get("example_ko")]
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pass": "priority-fix-2026-08-19",
        "word_count": len(words),
        "level_counts": dict(counts),
        "successors": successors,
        "level_moves": moves,
        "dropped_ids": sorted(dropped_ids),
        "addition_ids": [row["id"] for row in additions],
        "self_replaced_example_ids": sorted(self_replaced),
        "missing_addition_examples": missing_examples,
        "changes": changes,
        "deficits_before_backfill": deficits,
    }

    if args.dry_run:
        print(json.dumps({
            "word_count": len(words),
            "level_counts": dict(counts),
            "expected": EXPECTED,
            "successors": len(successors),
            "drops": len(dropped_ids),
            "level_moves": len(moves),
            "additions": len(additions),
            "missing_addition_examples": missing_examples,
            "change_kinds": dict(Counter(item["kind"] for item in changes)),
        }, ensure_ascii=False, indent=2))
        return

    if len({row["id"] for row in words}) != len(words):
        raise RuntimeError("duplicate word ids after priority fix")
    if missing_examples:
        write_csv(args.additions_out, additions, WORD_FIELDS)
        args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise RuntimeError(
            f"collect examples for {len(missing_examples)} additions into {args.addition_examples} and rerun"
        )

    # examples
    id_map = dict(successors)
    naver_keep = []
    for row in naver_rows:
        word_id = id_map.get(row["word_id"], row["word_id"])
        if word_id in dropped_ids or word_id not in by_id:
            continue
        if word_id in self_replaced:
            continue
        row = dict(row)
        row["word_id"] = word_id
        naver_keep.append(row)
    self_keep = []
    seen_self = set()
    for row in example_rows:
        if row.get("source") != "self" and row.get("license") != "self":
            continue
        word_id = id_map.get(row["word_id"], row["word_id"])
        if word_id in dropped_ids or word_id not in by_id or word_id in self_replaced:
            continue
        row = dict(row)
        row["word_id"] = word_id
        self_keep.append(row)
        seen_self.add(word_id)
    for word_id in sorted(self_replaced):
        word = by_id[word_id]
        self_keep.append(self_example_row(
            word_id, word["surface"], word["example_jp"], word["example_ko"],
            captured_at, "priority-fix example rewrite; 표제어 원형 포함",
        ))
        seen_self.add(word_id)
    for row in additions:
        if row["id"] in seen_self:
            continue
        example = {
            "word_id": row["id"],
            "jp": row["example_jp"],
            "ko": row["example_ko"],
            "source": "naver-ja-dict" if row.get("example_license") != "self" else "self",
            "source_url": "https://ja.dict.naver.com/#/search?query=" + quote(row["surface"]),
            "license": row.get("example_license") or "self",
            "permission_status": "cleared" if row.get("example_license") != "self" else "self",
            "attribution": row.get("example_jp_author") or SELF_ATTRIBUTION,
            "captured_at": captured_at,
            "qa_status": "verified",
            "sort_order": "0",
            "naver_example_id": "",
            "naver_source_cid": "",
            "naver_source_name": "",
            "query": row["surface"],
            "qa_note": "priority-fix backfill",
        }
        if example["permission_status"] == "cleared":
            naver_keep.append(example)
        else:
            self_keep.append(example)
        # copy into word row license fields if missing
        if not row.get("example_license"):
            row["example_license"] = example["license"]
            row["example_jp_author"] = example["attribution"]

    naver_keep.sort(key=lambda row: row["word_id"])
    self_keep.sort(key=lambda row: row["word_id"])
    final_examples = naver_keep + self_keep
    final_examples.sort(key=lambda row: row["word_id"])
    if {row["word_id"] for row in final_examples} != {row["id"] for row in words}:
        missing = {row["id"] for row in words} - {row["word_id"] for row in final_examples}
        extra = {row["word_id"] for row in final_examples} - {row["id"] for row in words}
        raise RuntimeError(f"example coverage mismatch missing={len(missing)} extra={len(extra)} sample={list(missing)[:8]}")

    # sync wordlist example text from final examples
    example_by_id = {row["word_id"]: row for row in final_examples}
    for row in words:
        example = example_by_id[row["id"]]
        row["example_jp"] = example["jp"]
        row["example_ko"] = example["ko"]
        row["example_jp_author"] = example.get("attribution", "")
        row["example_license"] = "self" if example.get("source") == "self" or example.get("license") == "self" else example.get("license", "")

    write_csv(args.words, words, WORD_FIELDS)
    args.words_json.write_text(
        json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(words),
            "source": str(args.words),
            "vocabulary": words,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_csv(args.naver_examples, naver_keep, EXAMPLE_FIELDS)
    write_csv(args.examples, final_examples, EXAMPLE_FIELDS)
    write_csv(args.additions_out, additions, WORD_FIELDS)
    args.manifest_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "word_count": len(words),
        "level_counts": dict(counts),
        "naver_examples": len(naver_keep),
        "self_examples": len(self_keep),
        "successors": len(successors),
        "additions": len(additions),
        "change_kinds": dict(Counter(item["kind"] for item in changes)),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
