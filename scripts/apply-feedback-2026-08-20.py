#!/usr/bin/env python3
"""Apply the 2026-08-20 re-review: headword/meaning/example fixes, 93 NAVER
level moves, then N3+25 / N2+64 catalog backfill only.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import re
import time
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
MIN_COUNTS = {"N5": 393, "N4": 726, "N3": 1499, "N2": 1909, "N1": 2500}
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
TAG = "feedback-fix-2026-08-20"
MISMATCH_REPORT = DATA / "naver_full_verification_2026-08-20_fresh.json"

HEADWORD_FIXES = {
    "w_9ae6757294f044b5": {
        "surface": "頑な",
        "reading_kana": "かたくな",
        "furigana": "かたくな",
        "meaning_ko": "완고하다, 고집스럽다",
        "part_of_speech": "adjective",
        "example_jp": "頑なに口をつぐむ。",
        "example_ko": "고집스럽게 입을 다문다.",
    },
    "w_a7f61dd68b46c6ee": {
        "surface": "とんだ",
        "reading_kana": "とんだ",
        "furigana": "とんだ",
        "meaning_ko": "엄청난, 뜻밖의, 당치도 않은",
        "part_of_speech": "adjective",
        "example_jp": "今日はとんだ厄日だった。",
        "example_ko": "오늘은 되게 운수 사나운 날이었다.",
    },
}
MERGE_DROPS = {
    "w_b22a6ac9a6be784c": "w_75de41fe96c1c937",  # 大き → 大きい
}
MEANING_FIXES = {
    "w_5f8d9c8b49934159": "무모한",
    "w_107011573571e52d": "상세한, 꼼꼼한",
}
EXAMPLE_FIXES = {
    "w_ce70656918f80907": ("いい加減にしてください。", "적당히 하세요."),
    "w_f25835b153fd2a07": ("靴ひもが解ける。", "신발 끈이 풀린다."),
    "w_93470228cf879755": ("別れが辛い。", "이별이 괴롭다."),
    "w_fe75e712d18b48f2": ("車を止める。", "차를 세운다."),
    "w_ff6f5d47acd78352": ("被害を最小限に止める。", "피해를 최소한으로 막는다."),
    "w_30fede19350e0b02": ("箱の中が空だ。", "상자 안이 비어 있다."),
    "w_cd21637b9647fa3c": ("上の空で話を聞く。", "다른 생각을 하며 이야기를 듣는다."),
    "w_dfb409211ee33e05": ("川の下に村がある。", "강 하류에 마을이 있다."),
    "w_df40eb9087b51ff0": ("世論が分かれる。", "여론이 갈린다."),
}

# Remaining NAVER catalog leftovers after the 6,962 list. One-kanji N3
# lemmas were previously dropped by the len>=2 lexical filter. Curated to
# unique modern lemmas at the matching catalog level; no junk variants.
CURATED_BACKFILL = [
    ("N3", "箸", "はし", "젓가락", "noun", "箸でご飯を食べる。", "젓가락으로 밥을 먹는다."),
    ("N3", "虎", "とら", "호랑이", "noun", "虎が森に潜む。", "호랑이가 숲에 숨어 있다."),
    ("N3", "毒", "どく", "독, 독극물", "noun", "そのキノコには毒がある。", "그 버섯에는 독이 있다."),
    ("N3", "泥", "どろ", "진흙", "noun", "靴が泥で汚れた。", "신발이 진흙으로 더러워졌다."),
    ("N3", "腹", "はら", "배, 복부", "noun", "腹が減った。", "배가 고프다."),
    ("N3", "針", "はり", "바늘", "noun", "針に糸を通す。", "바늘에 실을 꿰다."),
    ("N3", "紐", "ひも", "끈", "noun", "靴の紐が解けた。", "신발 끈이 풀렸다."),
    ("N3", "埃", "ほこり", "먼지", "noun", "棚の上に埃が積もる。", "선반 위에 먼지가 쌓인다."),
    ("N3", "筆", "ふで", "붓", "noun", "筆で字を書く。", "붓으로 글씨를 쓴다."),
    ("N3", "柱", "はしら", "기둥", "noun", "家の柱が太い。", "집 기둥이 굵다."),
    ("N3", "畑", "はたけ", "밭", "noun", "畑で野菜を作る。", "밭에서 채소를 기른다."),
    ("N3", "鶏", "にわとり", "닭", "noun", "鶏が卵を産む。", "닭이 알을 낳는다."),
    ("N3", "鼠", "ねずみ", "쥐", "noun", "鼠が台所に出た。", "쥐가 주방에 나타났다."),
    ("N3", "種", "たね", "씨, 종자", "noun", "花の種をまく。", "꽃씨를 뿌린다."),
    ("N3", "微笑む", "ほほえむ", "미소 짓다", "verb", "彼女は優しく微笑んだ。", "그녀는 다정하게 미소 지었다."),
    ("N3", "人々", "ひとびと", "사람들", "noun", "人々が広場に集まる。", "사람들이 광장에 모인다."),
    ("N3", "宛先", "あてさき", "수신인, 받는 주소", "noun", "荷物の宛先を確認する。", "짐의 수신인을 확인한다."),
    ("N3", "自由席", "じゆうせき", "자유석", "noun", "自由席に座った。", "자유석에 앉았다."),
    ("N3", "始発駅", "しはつえき", "시발역", "noun", "この電車の始発駅は東京だ。", "이 전철의 시발역은 도쿄다."),
    ("N3", "味見", "あじみ", "맛보기", "noun", "スープを味見する。", "수프 맛을 본다."),
    ("N3", "くしゃみ", "くしゃみ", "재채기", "noun", "くしゃみが出る。", "재채기가 나온다."),
    ("N3", "やる気", "やるき", "의욕", "noun", "やる気が出ない。", "의욕이 나지 않는다."),
    ("N3", "なだらか", "なだらか", "완만한", "adjective", "なだらかな坂を上る。", "완만한 언덕을 오른다."),
    ("N3", "我慢強い", "がまんづよい", "참을성이 많다", "adjective", "彼は我慢強い。", "그는 참을성이 많다."),
    ("N3", "いつの間にか", "いつのまにか", "어느새", "adverb", "いつの間にか夜になった。", "어느새 밤이 되었다."),
    ("N2", "日本", "にほん", "일본", "noun", "日本に住んでいる。", "일본에 살고 있다."),
    ("N2", "チーム", "チーム", "팀", "noun", "チームで試合に出る。", "팀으로 경기에 나간다."),
    ("N2", "最大", "さいだい", "최대", "noun", "最大の課題は時間だ。", "최대 과제는 시간이다."),
    ("N2", "何でも", "なんでも", "무엇이든", "adverb", "何でも聞いてください。", "무엇이든 물어보세요."),
    ("N2", "第一", "だいいち", "제일, 첫째", "noun", "第一に安全を考える。", "제일 먼저 안전을 생각한다."),
    ("N2", "投票", "とうひょう", "투표", "noun", "選挙で投票する。", "선거에서 투표한다."),
    ("N2", "犯罪", "はんざい", "범죄", "noun", "犯罪を防ぐ。", "범죄를 막는다."),
    ("N2", "円高", "えんだか", "엔고, 엔화 강세", "noun", "円高で輸出が減る。", "엔고로 수출이 줄어든다."),
    ("N2", "円安", "えんやす", "엔저, 엔화 약세", "noun", "円安で輸入品が高くなる。", "엔저로 수입품이 비싸진다."),
    ("N2", "納得", "なっとく", "납득", "noun", "説明に納得した。", "설명에 납득했다."),
    ("N2", "同僚", "どうりょう", "동료", "noun", "同僚と昼食を食べる。", "동료와 점심을 먹는다."),
    ("N2", "結婚式", "けっこんしき", "결혼식", "noun", "来月結婚式がある。", "다음 달에 결혼식이 있다."),
    ("N2", "社員", "しゃいん", "사원, 회사원", "noun", "新しい社員が入った。", "새 사원이 들어왔다."),
    ("N2", "居酒屋", "いざかや", "이자카야, 선술집", "noun", "仕事の後で居酒屋に行く。", "퇴근 후 이자카야에 간다."),
    ("N2", "遺産", "いさん", "유산", "noun", "遺産を相続する。", "유산을 상속한다."),
    ("N2", "衣服", "いふく", "의복, 옷", "noun", "冬の衣服をしまう。", "겨울 옷을 넣어 둔다."),
    ("N2", "一家", "いっか", "일가, 한 가족", "noun", "一家で旅行する。", "온 가족이 여행한다."),
    ("N2", "誤り", "あやまり", "잘못, 실수", "noun", "計算の誤りを直す。", "계산 실수를 고친다."),
    ("N2", "当てる", "あてる", "맞히다, 대다", "verb", "答えを当てる。", "답을 맞힌다."),
    ("N2", "青空", "あおぞら", "푸른 하늘", "noun", "青空が広がっている。", "푸른 하늘이 펼쳐져 있다."),
    ("N2", "生み出す", "うみだす", "만들어 내다", "verb", "新しい価値を生み出す。", "새로운 가치를 만들어 낸다."),
    ("N2", "演説", "えんぜつ", "연설", "noun", "広場で演説する。", "광장에서 연설한다."),
    ("N2", "大型", "おおがた", "대형", "noun", "大型の車が通る。", "대형 차가 지나간다."),
    ("N2", "お昼", "おひる", "점심, 낮", "noun", "お昼を一緒に食べる。", "점심을 같이 먹는다."),
    ("N2", "飼い主", "かいぬし", "주인, 기르는 사람", "noun", "犬が飼い主の後を追う。", "개가 주인을 따라간다."),
    ("N2", "各国", "かっこく", "각국", "noun", "各国の代表が集まる。", "각국 대표가 모인다."),
    ("N2", "外見", "がいけん", "외견, 겉모습", "noun", "外見で判断しない。", "겉모습으로 판단하지 않는다."),
    ("N2", "奇妙", "きみょう", "기묘한, 이상한", "adjective", "奇妙な音がする。", "이상한 소리가 난다."),
    ("N2", "急激", "きゅうげき", "급격한", "adjective", "気温が急激に下がる。", "기온이 급격히 떨어진다."),
    ("N2", "救助", "きゅうじょ", "구조", "noun", "遭難者を救助する。", "조난자를 구조한다."),
    ("N2", "教員", "きょういん", "교원, 교사", "noun", "彼は高校の教員だ。", "그는 고등학교 교사다."),
    ("N2", "金銭", "きんせん", "금전, 돈", "noun", "金銭のトラブルが起きた。", "금전 문제가 생겼다."),
    ("N2", "苦痛", "くつう", "고통", "noun", "手術後の苦痛が残る。", "수술 후 고통이 남는다."),
    ("N2", "研究所", "けんきゅうじょ", "연구소", "noun", "研究所で実験する。", "연구소에서 실험한다."),
    ("N2", "芸能人", "げいのうじん", "연예인", "noun", "芸能人が番組に出る。", "연예인이 방송에 나온다."),
    ("N2", "原子力", "げんしりょく", "원자력", "noun", "原子力の利用を議論する。", "원자력 이용을 논의한다."),
    ("N2", "好奇心", "こうきしん", "호기심", "noun", "子供の好奇心は強い。", "아이의 호기심은 강하다."),
    ("N2", "小型", "こがた", "소형", "noun", "小型のカメラを買う。", "소형 카메라를 산다."),
    ("N2", "克服", "こくふく", "극복", "noun", "苦手を克服する。", "약점을 극복한다."),
    ("N2", "国旗", "こっき", "국기", "noun", "国旗を掲げる。", "국기를 게양한다."),
    ("N2", "強盗", "ごうとう", "강도", "noun", "強盗事件が起きた。", "강도 사건이 일어났다."),
    ("N2", "合理的", "ごうりてき", "합리적인", "adjective", "合理的な方法を選ぶ。", "합리적인 방법을 고른다."),
    ("N2", "視聴者", "しちょうしゃ", "시청자", "noun", "視聴者が増えた。", "시청자가 늘었다."),
    ("N2", "市長", "しちょう", "시장", "noun", "市長が挨拶する。", "시장이 인사한다."),
    ("N2", "尻尾", "しっぽ", "꼬리", "noun", "犬が尻尾を振る。", "개가 꼬리를 흔든다."),
    ("N2", "奨学金", "しょうがくきん", "장학금", "noun", "奨学金を申請する。", "장학금을 신청한다."),
    ("N2", "承知", "しょうち", "承知, 승낙", "noun", "その件は承知しています。", "그 건은 알고 있습니다."),
    ("N2", "賞味期限", "しょうみきげん", "유통 기한", "noun", "賞味期限を確認する。", "유통 기한을 확인한다."),
    ("N2", "省略", "しょうりゃく", "생략", "noun", "説明を省略する。", "설명을 생략한다."),
    ("N2", "充電", "じゅうでん", "충전", "noun", "スマホを充電する。", "스마트폰을 충전한다."),
    ("N2", "上達", "じょうたつ", "향상, 늘다", "noun", "日本語が上達した。", "일본어가 늘었다."),
    ("N2", "戦後", "せんご", "전후", "noun", "戦後の日本を学ぶ。", "전후 일본을 배운다."),
    ("N2", "担任", "たんにん", "담임", "noun", "クラスの担任に相談する。", "반 담임에게 상담한다."),
    ("N2", "男女", "だんじょ", "남녀", "noun", "男女平等を考える。", "남녀평등을 생각한다."),
    ("N2", "店長", "てんちょう", "점장", "noun", "店長に報告する。", "점장에게 보고한다."),
    ("N2", "電子", "でんし", "전자", "noun", "電子メールを送る。", "이메일을 보낸다."),
    ("N2", "同時", "どうじ", "동시", "noun", "同時に二つの仕事をする。", "동시에 두 일을 한다."),
    ("N2", "独特", "どくとく", "독특한", "adjective", "独特な味がする。", "독특한 맛이 난다."),
    ("N2", "納税", "のうぜい", "납세", "noun", "期限内に納税する。", "기한 안에 세금을 낸다."),
    ("N2", "爆発", "ばくはつ", "폭발", "noun", "ガスが爆発した。", "가스가 폭발했다."),
    ("N2", "必死", "ひっし", "필사적", "adjective", "必死に走る。", "필사적으로 달린다."),
    ("N2", "平等", "びょうどう", "평등", "noun", "機会の平等が大切だ。", "기회의 평등이 중요하다."),
    ("N2", "分野", "ぶんや", "분야", "noun", "新しい分野を学ぶ。", "새로운 분야를 배운다."),
    ("N2", "防災", "ぼうさい", "방재", "noun", "防災訓練を行う。", "방재 훈련을 한다."),
]


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
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-backfill", action="store_true")
    parser.add_argument("--addition-examples", type=Path, default=DATA / "naver_examples_feedback_backfill_qa_work.csv")
    parser.add_argument("--catalog", type=Path, default=ROOT / ".cache/naver-jlpt-catalog.json")
    parser.add_argument("--jmdict", type=Path, default=ROOT / ".cache/JMdict_e.gz")
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
    return [str(item) for item in json.loads(text)]


def add_tag(row: dict[str, Any], tag: str) -> None:
    tags = parse_tags(row.get("tags"))
    if tag not in tags:
        tags.append(tag)
    row["tags"] = json.dumps(tags, ensure_ascii=False, separators=(",", ":"))


def self_example_row(word: dict[str, str], captured_at: str, note: str) -> dict[str, str]:
    return {
        "word_id": word["id"],
        "jp": word["example_jp"],
        "ko": word["example_ko"],
        "source": "self",
        "source_url": "https://ja.dict.naver.com/#/search?query=" + quote(word["surface"]),
        "license": "self",
        "permission_status": "self",
        "attribution": SELF_ATTRIBUTION,
        "captured_at": captured_at,
        "qa_status": "verified",
        "sort_order": "0",
        "naver_example_id": "",
        "naver_source_cid": "",
        "naver_source_name": "",
        "query": word["surface"],
        "qa_note": note,
    }


def apply_self_example(row: dict[str, Any], jp: str, ko: str) -> None:
    row["example_jp"] = jp
    row["example_ko"] = ko
    row["example_jp_author"] = SELF_ATTRIBUTION
    row["example_license"] = "self"


def discouraged_kanji(info: set[str]) -> bool:
    blob = " ".join(sorted(info)).lower()
    return any(mark in blob for mark in ("rarely", "irregular", "out-dated", "outdated", "search-only"))


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


def choose_catalog_additions(
    words: list[dict[str, str]],
    deficits: dict[str, int],
    catalog_path: Path,
    jmdict_path: Path,
    reserved_ids: set[str],
) -> list[dict[str, Any]]:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))["items"]
    existing_pairs = set()
    existing_semantic = set()
    existing_surfaces = set()
    existing_ids = {row["id"] for row in words} | set(reserved_ids)
    existing_pair_meanings: dict[tuple[str, str], set[str]] = {}
    for row in words:
        reading = RB.normalize(row["reading_kana"])
        existing_semantic.add((reading, RB.compact_meaning(row["meaning_ko"]).split("/")[0]))
        for form in [row["surface"], *RB.parse_alt_forms(row.get("alt_forms")), row["reading_kana"]]:
            if normalized := RB.dedupe_form(form):
                existing_pairs.add((normalized, reading))
                existing_surfaces.add(normalized)
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
        if "→" in meaning or "⇒" in meaning or "준말" in meaning:
            continue
        if any((RB.dedupe_form(form), reading) in existing_pairs for form in forms):
            continue
        if any(RB.dedupe_form(form) in existing_surfaces for form in forms):
            continue
        forms = [form for form in forms if not re.search(r"([一-龯])\1", form)]
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
    jmdict = RB.load_jmdict_metadata(jmdict_path, candidate_pairs | set(existing_pair_meanings))
    sequence_existing: dict[str, set[str]] = {}
    for pair, meanings in existing_pair_meanings.items():
        for sequence in jmdict.get(pair, {}).get("sequences", set()):
            sequence_existing.setdefault(sequence, set()).update(meanings)
    eligible = []
    for candidate in raw_candidates:
        accepted = []
        for form_index, form in enumerate(candidate["forms"]):
            metadata = jmdict.get((form, candidate["reading"]))
            if not metadata or discouraged_kanji(set(metadata["info"])):
                continue
            accepted.append((form, form_index, metadata))
        if not accepted:
            continue
        collided = {
            existing_meaning
            for _form, _index, metadata in accepted
            for sequence in metadata.get("sequences", set())
            for existing_meaning in sequence_existing.get(sequence, set())
        }
        if collided:
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


def main() -> None:
    args = parse_args()
    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    by_id = {row["id"]: row for row in words}
    naver_rows = read_csv(DATA / "naver_examples_final_qa_work.csv")
    example_rows = read_csv(DATA / "examples_final_qa_work.csv")
    captured_at = str(int(time.time() * 1000))
    successors: dict[str, str] = {}
    self_replaced: set[str] = set()
    changes: list[dict[str, Any]] = []

    def note(kind: str, row: dict[str, str], **extra: Any) -> None:
        changes.append({"kind": kind, "id": row["id"], "level": row["level"],
                        "surface": row["surface"], "reading_kana": row["reading_kana"], **extra})

    for word_id, payload in HEADWORD_FIXES.items():
        row = by_id[word_id]
        old_id = row["id"]
        row.update(payload)
        apply_self_example(row, payload["example_jp"], payload["example_ko"])
        new_id = RB.stable_word_id(row["surface"], row["reading_kana"])
        if new_id in by_id and new_id != old_id:
            raise RuntimeError(f"headword fix collides: {row['surface']} {new_id}")
        row["id"] = new_id
        row["card_type"] = RB.infer_card_type(row["surface"])
        row["frequency"] = f"{(zipf_frequency(row['surface'], 'ja') or zipf_frequency(row['reading_kana'], 'ja')):.3f}"
        add_tag(row, TAG)
        if new_id != old_id:
            successors[old_id] = new_id
            by_id.pop(old_id)
            by_id[new_id] = row
            self_replaced.add(new_id)
            note("headword", row, old_id=old_id, new_id=new_id)
        else:
            self_replaced.add(old_id)
            note("headword-inplace", row)

    for old_id, new_id in MERGE_DROPS.items():
        row = by_id[old_id]
        successors[old_id] = new_id
        note("merge-drop", row, successor=new_id)
        del by_id[old_id]
    words = [row for row in words if row["id"] in by_id]
    by_id = {row["id"]: row for row in words}

    for word_id, meaning in MEANING_FIXES.items():
        row = by_id[word_id]
        row["meaning_ko"] = meaning
        add_tag(row, TAG)
        note("meaning", row, after=meaning)

    for word_id, (jp, ko) in EXAMPLE_FIXES.items():
        row = by_id[word_id]
        apply_self_example(row, jp, ko)
        add_tag(row, TAG)
        self_replaced.add(word_id)
        note("example", row, example_jp=jp)

    report = json.loads(MISMATCH_REPORT.read_text(encoding="utf-8"))
    moves = {row["id"]: row["search_level"] for row in report["confirmed_mismatches"]}
    missing_moves = sorted(set(moves) - set(by_id))
    remapped_moves = {}
    for old_id, level in moves.items():
        word_id = successors.get(old_id, old_id)
        if word_id not in by_id:
            continue
        remapped_moves[word_id] = level
    if missing_moves and not remapped_moves:
        raise RuntimeError(f"level-move targets missing: {missing_moves[:8]}")
    for word_id, new_level in remapped_moves.items():
        row = by_id[word_id]
        before = row["level"]
        if before == new_level:
            continue
        row["level"] = new_level
        add_tag(row, "naver-level-corrected")
        add_tag(row, TAG)
        note("level", row, before=before, after=new_level)

    refresh_sort(words)
    counts = Counter(row["level"] for row in words)
    deficits = {level: max(0, MIN_COUNTS[level] - counts.get(level, 0)) for level in LEVELS}
    additions: list[dict[str, Any]] = []
    addition_examples = {
        row["word_id"]: row for row in read_csv(args.addition_examples)
    } if args.addition_examples.exists() else {}

    if not args.skip_backfill:
        selected: list[dict[str, Any]] = []
        picked_levels: Counter[str] = Counter()
        existing_pairs = {(row["surface"], row["reading_kana"]) for row in words}
        existing_ids = {row["id"] for row in words} | set(successors)
        existing_surfaces = {row["surface"] for row in words}
        pos_parts = {
            "noun": ["명사"], "verb": ["동사"], "adjective": ["형용사"],
            "adverb": ["부사"],
        }
        for level, surface, reading, meaning, pos, jp, ko in CURATED_BACKFILL:
            if picked_levels[level] >= deficits.get(level, 0):
                continue
            if (surface, reading) in existing_pairs or surface in existing_surfaces:
                continue
            word_id = RB.stable_word_id(surface, reading)
            if word_id in existing_ids:
                continue
            selected.append({
                "id": word_id,
                "level": level,
                "surface": surface,
                "reading": reading,
                "meaning": meaning,
                "frequency": zipf_frequency(surface, "ja") or zipf_frequency(reading, "ja"),
                "item": {"parts": pos_parts.get(pos, ["명사"])},
                "fallback_example": (jp, ko),
                "curated": True,
            })
            picked_levels[level] += 1
            existing_pairs.add((surface, reading))
            existing_surfaces.add(surface)
            existing_ids.add(word_id)
        remain = {level: max(0, deficits.get(level, 0) - picked_levels[level]) for level in LEVELS}
        if any(remain.values()):
            catalog_selected = choose_catalog_additions(
                words + [
                    {"id": item["id"], "surface": item["surface"],
                     "reading_kana": item["reading"], "meaning_ko": item["meaning"],
                     "alt_forms": ""}
                    for item in selected
                ],
                remain, args.catalog, args.jmdict, existing_ids,
            )
            excluded = set()
            excluded_path = DATA / "jlpt_naver_rebalance_manifest.json"
            if excluded_path.exists():
                excluded = set(json.loads(excluded_path.read_text(encoding="utf-8")).get("excluded_addition_ids", []))
            for item in catalog_selected:
                if item["id"] in excluded or item["id"] in existing_ids:
                    continue
                if picked_levels[item["level"]] >= deficits.get(item["level"], 0):
                    continue
                selected.append(item)
                picked_levels[item["level"]] += 1
                existing_ids.add(item["id"])
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
                "tags": json.dumps(["naver-level-backfill", "jmdict-exact", "ko-from-naver", TAG], ensure_ascii=False, separators=(",", ":")),
                "data_version": "3",
                "frequency": f"{candidate['frequency']:.3f}",
            })
            example = addition_examples.get(row["id"])
            if example and example.get("jp") and example.get("ko"):
                row["example_jp"] = example["jp"]
                row["example_ko"] = example["ko"]
                row["example_jp_author"] = example.get("attribution", "")
                row["example_license"] = example.get("license") or "owner-confirmed-cleared"
            elif candidate.get("fallback_example"):
                jp, ko = candidate["fallback_example"]
                row["example_jp"] = jp
                row["example_ko"] = ko
                row["example_jp_author"] = SELF_ATTRIBUTION
                row["example_license"] = "self"
                extra = "curated-naver-catalog" if candidate.get("curated") else "fallback-lexical"
                row["tags"] = json.dumps(
                    ["naver-level-backfill", "jmdict-exact", TAG, extra],
                    ensure_ascii=False, separators=(",", ":"),
                )
            if row["surface"] == "箸":
                row["disambig"] = "젓가락"
            additions.append(row)
            words.append(row)
            by_id[row["id"]] = row
            note("backfill", row)
        refresh_sort(words)

    counts = Counter(row["level"] for row in words)
    missing_examples = [row["id"] for row in additions if not row.get("example_jp") or not row.get("example_ko")]
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "word_count": len(words),
        "level_counts": dict(counts),
        "successors": successors,
        "level_moves": remapped_moves,
        "addition_ids": [row["id"] for row in additions],
        "addition_preview": [
            {"id": row["id"], "level": row["level"], "surface": row["surface"],
             "reading_kana": row["reading_kana"], "meaning_ko": row["meaning_ko"]}
            for row in additions
        ],
        "missing_addition_examples": missing_examples,
        "self_replaced_example_ids": sorted(self_replaced),
        "changes": changes,
        "deficits": deficits,
    }

    print(json.dumps({
        "word_count": len(words),
        "level_counts": dict(counts),
        "successors": successors,
        "level_moves": len(remapped_moves),
        "additions": len(additions),
        "missing_addition_examples": len(missing_examples),
        "change_kinds": dict(Counter(item["kind"] for item in changes)),
        "addition_preview": manifest["addition_preview"][:89],
    }, ensure_ascii=False, indent=2))

    if args.dry_run:
        (DATA / "jlpt_feedback_fix_manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        if additions:
            write_csv(DATA / "jlpt_feedback_backfill_additions.csv", additions, WORD_FIELDS)
        return

    if missing_examples:
        write_csv(DATA / "jlpt_feedback_backfill_additions.csv", additions, WORD_FIELDS)
        (DATA / "jlpt_feedback_fix_manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        raise RuntimeError(
            f"collect examples for {len(missing_examples)} additions into {args.addition_examples}"
        )

    id_map = dict(successors)
    naver_keep = []
    seen_naver = set()
    for row in naver_rows:
        word_id = id_map.get(row["word_id"], row["word_id"])
        if word_id not in by_id or word_id in self_replaced or word_id in seen_naver:
            continue
        row = dict(row)
        row["word_id"] = word_id
        naver_keep.append(row)
        seen_naver.add(word_id)
    self_keep = []
    seen_self = set()
    for row in example_rows:
        if row.get("source") != "self" and row.get("license") != "self":
            continue
        word_id = id_map.get(row["word_id"], row["word_id"])
        if word_id not in by_id or word_id in self_replaced or word_id in seen_self:
            continue
        row = dict(row)
        row["word_id"] = word_id
        self_keep.append(row)
        seen_self.add(word_id)
    for word_id in sorted(self_replaced):
        self_keep.append(self_example_row(by_id[word_id], captured_at, "feedback-fix example rewrite"))
        seen_self.add(word_id)
    for row in additions:
        example = addition_examples.get(row["id"])
        if example and example.get("permission_status") == "cleared":
            naver_keep.append(dict(example))
            row["example_jp"] = example["jp"]
            row["example_ko"] = example["ko"]
        else:
            if not row.get("example_jp"):
                raise RuntimeError(f"addition still missing example: {row['id']} {row['surface']}")
            self_keep.append(self_example_row(row, captured_at, "feedback-fix backfill self example"))
            row["example_license"] = "self"
            row["example_jp_author"] = SELF_ATTRIBUTION

    naver_keep.sort(key=lambda row: row["word_id"])
    self_keep.sort(key=lambda row: row["word_id"])
    final_examples = naver_keep + self_keep
    final_examples.sort(key=lambda row: row["word_id"])
    if {row["word_id"] for row in final_examples} != {row["id"] for row in words}:
        missing = {row["id"] for row in words} - {row["word_id"] for row in final_examples}
        raise RuntimeError(f"example coverage missing {sorted(missing)[:12]}")

    example_by_id = {row["word_id"]: row for row in final_examples}
    for row in words:
        example = example_by_id[row["id"]]
        row["example_jp"] = example["jp"]
        row["example_ko"] = example["ko"]
        row["example_jp_author"] = example.get("attribution", "")
        row["example_license"] = "self" if example.get("source") == "self" or example.get("license") == "self" else example.get("license", "")

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
    write_csv(DATA / "naver_examples_final_qa_work.csv", naver_keep, EXAMPLE_FIELDS)
    write_csv(DATA / "examples_final_qa_work.csv", final_examples, EXAMPLE_FIELDS)
    write_csv(DATA / "jlpt_feedback_backfill_additions.csv", additions, WORD_FIELDS)
    (DATA / "jlpt_feedback_fix_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "wrote": True,
        "word_count": len(words),
        "level_counts": dict(counts),
        "naver_examples": len(naver_keep),
        "self_examples": len(self_keep),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
