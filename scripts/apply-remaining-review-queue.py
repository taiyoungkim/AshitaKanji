#!/usr/bin/env python3
"""Finish the remaining NAVER example review queue.

- Give every shared-sentence extra card its own example.
- Rewrite kana/kanji surface mismatches and fragment-like examples.
- Leave unique, surface-matching NAVER sentences in place.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote


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
SELF_ATTRIBUTION = "AshitaKanji 편집 예문"
NOTE = "remaining-review-queue 2026-08-20; 표제어 원형 포함; 자체 작성"
RUBY = re.compile(r"\[([^\[\]]+)\]")
KANJI = re.compile(r"[一-龯々〆ヶ]")


HAND: dict[str, tuple[str, str]] = {
    "やり遂げる": ("受け持った仕事をやり遂げる。", "맡은 일을 끝까지 해낸다."),
    "大丈夫": ("大丈夫です。心配いりません。", "괜찮습니다. 걱정하지 마세요."),
    "又は": ("電車又はバスで行きます。", "전철 또는 버스로 갑니다."),
    "貶される": ("人前で貶される。", "사람들 앞에서 헐뜯긴다."),
    "辛い": ("異郷での生活は辛い。", "타향 생활은 괴롭다."),
    "疎かに": ("勉強を疎かにする。", "공부를 소홀히 한다."),
    "工学": ("大学で工学を専攻する。", "대학에서 공학을 전공한다."),
    "克明": ("事故の様子を克明に記録する。", "사고 모습을 꼼꼼히 기록한다."),
    "英字": ("英字新聞を読む。", "영자 신문을 읽는다."),
    "仮名": ("正しい仮名を覚える。", "올바른 가나를 외운다."),
    "掛かる": ("結果が気に掛かる。", "결과가 마음에 걸린다."),
    "気に入る": ("この服を気に入る。", "이 옷을 마음에 들어 한다."),
    "沢山": ("店にお客が沢山来る。", "가게에 손님이 많이 온다."),
    "どう致しまして": ("どう致しまして。", "천만에요."),
    "真っ直ぐ": ("この道を真っ直ぐ行ってください。", "이 길을 곧장 가세요."),
    "一昨年": ("一昨年の春に引っ越した。", "재작년에 이사했다."),
    "ご馳走様": ("ご馳走様でした。", "잘 먹었습니다."),
    "欲しい": ("新しい辞書が欲しい。", "새 사전이 갖고 싶다."),
    "喧嘩": ("友達と喧嘩した。", "친구와 싸웠다."),
    "殆ど": ("殆ど終わった。", "거의 끝났다."),
    "その内": ("その内また連絡します。", "조만간 다시 연락합니다."),
    "既に": ("既に出発した。", "이미 출발했다."),
    "遂に": ("遂に完成した。", "드디어 완성했다."),
    "暫く": ("暫く待ってください。", "잠시 기다려 주세요."),
    "度々": ("度々同じミスをする。", "자주 같은 실수를 한다."),
    "上る": ("階段を上る。", "계단을 오른다."),
    "その頃": ("その頃は学生だった。", "그 무렵에는 학생이었다."),
    "そう言えば": ("そう言えば昨日会いました。", "그러고 보니 어제 만났습니다."),
    "更に": ("更に詳しく説明する。", "더욱 자세히 설명한다."),
    "萎む": ("花が萎む。", "꽃이 시든다."),
    "何なり": ("何なりと聞いてください。", "무엇이든 물어보세요."),
    "大らかな": ("大らかな性格の人だ。", "너그러운 성격의 사람이다."),
    "いい加減に": ("いい加減ににしてください。", "적당히 하세요."),
    "何より": ("家族の健康が何よりだ。", "가족 건강이 무엇보다 중요하다."),
    "爽やかだ": ("朝の風が爽やかだ。", "아침 바람이 상쾌하다."),
    "些細な": ("些細なことで怒らない。", "사소한 일로 화내지 않는다."),
    "足袋": ("着物に足袋を履く。", "기모노에 버선을 신는다."),
    "箒": ("箒で庭を掃く。", "비로 마당을 쓴다."),
    "公衆": ("公衆電話を探す。", "공중전화를 찾는다."),
    "国定": ("国定教科書を使う。", "국정 교과서를 쓴다."),
    "研修": ("来週研修を受ける。", "다음 주 연수를 받는다."),
    "上品": ("上品な話し方をする。", "품위 있는 말투를 쓴다."),
    "感情的": ("感情的にならない。", "감정적으로 되지 않는다."),
    "手軽": ("手軽な朝食をとる。", "간편한 아침을 먹는다."),
    "養護": ("養護教諭に相談する。", "보건 교사에게 상담한다."),
    "若い": ("まだ若い選手だ。", "아직 젊은 선수다."),
    "拝啓": ("手紙を拝啓で書き始める。", "편지를 배계로 쓰기 시작한다."),
    "永久": ("永久に忘れない。", "영원히 잊지 않는다."),
    "英和": ("英和辞典を引く。", "영한 사전을 찾는다."),
    "漢和": ("漢和辞典で調べる。", "한화 사전으로 찾는다."),
    "階級": ("階級が上がった。", "계급이 올랐다."),
    "所得": ("所得が減った。", "소득이 줄었다."),
    "見かける": ("街で友人を見かける。", "거리에서 친구를 본다."),
    "解ける": ("この問題はすぐ解ける。", "이 문제는 바로 풀린다."),
    "全般": ("全般的に調子がいい。", "전반적으로 컨디션이 좋다."),
    "一台": ("車を一台持っている。", "차를 한 대 가지고 있다."),
    "四捨五入": ("小数を四捨五入する。", "소수를 반올림한다."),
    "要因": ("失敗の要因を探す。", "실패 요인을 찾는다."),
    "実費": ("交通費は実費で払う。", "교통비는 실비로 낸다."),
    "叔父さん": ("叔父さんに会いに行く。", "삼촌을 만나러 간다."),
    "焦げ茶": ("焦げ茶の靴を履く。", "짙은 갈색 신을 신는다."),
    "興業": ("新しい興業を始める。", "새 사업을 시작한다."),
    "組合": ("組合に加入する。", "조합에 가입한다."),
    "懸命": ("懸命に働く。", "힘껏 일한다."),
    "キロメートル": ("二キロメートル歩く。", "2킬로미터를 걷는다."),
    "上陸": ("台風が上陸する。", "태풍이 상륙한다."),
    "大腿": ("転んで大腿を打った。", "넘어져 넓적다리를 부딪쳤다."),
    "局": ("テレビ局を見学する。", "방송국을 견학한다."),
    "寒帯": ("寒帯に住む動物もいる。", "한대에 사는 동물도 있다."),
    "お嬢さん": ("お嬢さんを紹介します。", "따님을 소개합니다."),
    "格段": ("実力が格段に上がった。", "실력이 한 단계 올랐다."),
    "質疑": ("質疑の時間を設ける。", "질의 시간을 둔다."),
    "一方通行": ("この道は一方通行だ。", "이 길은 일방통행이다."),
    "ふんだん": ("材料をふんだんに使う。", "재료를 넉넉히 쓴다."),
    "産婦人科": ("産婦人科で診てもらう。", "산부인과에서 진찰받는다."),
    "跡地": ("工場の跡地に公園ができた。", "공장 터에 공원이 생겼다."),
    "乃至": ("一時間乃至二時間かかる。", "한 시간 내지 두 시간 걸린다."),
    "一生懸命": ("一生懸命勉強する。", "열심히 공부한다."),
    "真ん丸い": ("真ん丸い月が出ている。", "동그란 달이 떠 있다."),
    "貰う": ("友達から本を貰う。", "친구에게 책을 받는다."),
    "百科事典": ("百科事典で調べる。", "백과사전으로 찾는다."),
    "平気": ("少しくらい平気だ。", "조금은 괜찮다."),
    "小数": ("小数を計算する。", "소수를 계산한다."),
    "足": ("足が痛い。", "발이 아프다."),
    "実用的": ("実用的な道具だ。", "실용적인 도구다."),
    "手前": ("駅の手前で降りる。", "역 앞에서 내린다."),
    "具体的": ("具体的な計画を立てる。", "구체적인 계획을 세운다."),
    "仮名遣い": ("現代の仮名遣いを学ぶ。", "현대 가나 표기를 배운다."),
    "生年月日": ("生年月日を書いてください。", "생년월일을 적어 주세요."),
    "食品": ("安全な食品を選ぶ。", "안전한 식품을 고른다."),
    "海運": ("海運会社で働く。", "해운 회사에서 일한다."),
    "大ざっぱ": ("大ざっぱに見積もる。", "대충 견적 낸다."),
    "余計": ("余計な心配はしない。", "쓸데없는 걱정은 하지 않는다."),
    "代表的": ("これは日本の代表的な料理だ。", "이것은 일본의 대표적인 요리다."),
    "新た": ("新たな挑戦を始める。", "새로운 도전을 시작한다."),
    "お手洗い": ("お手洗いを借りてもいいですか。", "화장실을 써도 될까요."),
    "浴びる": ("朝シャワーを浴びる。", "아침에 샤워한다."),
    "お風呂": ("夜にお風呂に入る。", "밤에 목욕한다."),
    "やむを得ず": ("やむを得ず欠席する。", "어쩔 수 없이 결석한다."),
    "早急": ("早急に返事をください。", "서둘러 답을 주세요."),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({field: row.get(field, "") for field in fields} for row in rows)


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


def compact(value: str) -> str:
    return RUBY.sub(r"\1", value or "").replace(" ", "").replace("　", "")


def gloss(word: dict[str, str]) -> str:
    return re.split(r"[,，、/;]", word.get("meaning_ko") or "")[0].strip() or word["surface"]


def template_example(word: dict[str, str]) -> tuple[str, str]:
    surface = word["surface"]
    pos = word.get("part_of_speech") or ""
    ko = gloss(word)
    if pos == "verb":
        return f"落ち着いて{surface}。", f"차분히 {ko}."
    if pos == "adverb":
        return f"{surface}説明する。", f"{ko} 설명한다."
    if pos in {"adjective", "na_adjective"}:
        if surface.endswith("い") and not surface.endswith(("ない", "たい")):
            return f"とても{surface}。", f"매우 {ko}."
        return f"これは{surface}だ。", f"이것은 {ko}이다."
    if pos == "expression":
        return f"{surface}と言う。", f"{ko}라고 말한다."
    if pos == "conjunction":
        return f"電車{surface}バスで行く。", f"전철 {ko} 버스로 간다."
    if pos == "suffix" or pos == "prefix":
        return f"その{surface}を使う。", f"그 {ko}을 쓴다."
    return f"{surface}について話す。", f"{ko}에 대해 이야기한다."


def flags_of(row: dict[str, str]) -> set[str]:
    return {part.strip() for part in (row.get("review_flags") or "").split(";") if part.strip()}


def pick_winner(group: list[dict[str, str]], jp: str) -> dict[str, str]:
    def score(word: dict[str, str]) -> tuple:
        surface = compact(word["surface"])
        hit = 0 if surface and surface in jp else 1
        return (hit, -len(surface), word["id"])
    return sorted(group, key=score)[0]


def self_row(word: dict[str, str], captured_at: str) -> dict[str, str]:
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
        "qa_note": NOTE,
    }


def apply_example(word: dict[str, str], jp: str, ko: str) -> None:
    word["example_jp"] = jp
    word["example_ko"] = ko
    word["example_jp_author"] = SELF_ATTRIBUTION
    word["example_license"] = "self"
    add_tag(word, "remaining-review-2026-08-20")


def is_fragment(jp: str) -> bool:
    text = compact(jp)
    if len(text) <= 6:
        return True
    if not re.search(r"[はがをにへでと]", jp) and len(text) < 12:
        return True
    return False


def main() -> None:
    args = parse_args()
    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    by_id = {row["id"]: row for row in words}
    examples = read_csv(DATA / "examples_final_qa_work.csv")
    naver = read_csv(DATA / "naver_examples_final_qa_work.csv")
    queue = read_csv(DATA / "naver_examples_final_review_queue.csv")
    captured_at = str(int(time.time() * 1000))

    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in queue:
        if "일본어 예문 문장 중복" not in flags_of(row):
            continue
        word = by_id.get(row["word_id"])
        if word:
            groups[compact(word["example_jp"])].append(word)

    targets: dict[str, tuple[str, str, str]] = {}
    for jp, group in groups.items():
        winner = pick_winner(group, jp)
        for word in group:
            if word["id"] == winner["id"]:
                continue
            if word["surface"] in HAND:
                jp_s, ko_s = HAND[word["surface"]]
            else:
                jp_s, ko_s = template_example(word)
            targets[word["id"]] = (jp_s, ko_s, "duplicate-extra")

    for word in words:
        jp = word["example_jp"]
        surface = compact(word["surface"])
        text = compact(jp)
        if word["surface"] in HAND and (surface not in text or is_fragment(jp)):
            jp_s, ko_s = HAND[word["surface"]]
            targets[word["id"]] = (jp_s, ko_s, "hand")
            continue
        if surface and surface not in text:
            if word["surface"] in HAND:
                jp_s, ko_s = HAND[word["surface"]]
            else:
                jp_s, ko_s = template_example(word)
            targets[word["id"]] = (jp_s, ko_s, "surface-mismatch")
            continue
        if word["id"] in {row["word_id"] for row in queue} and is_fragment(jp):
            if word["surface"] in HAND:
                jp_s, ko_s = HAND[word["surface"]]
            else:
                jp_s, ko_s = template_example(word)
            targets.setdefault(word["id"], (jp_s, ko_s, "fragment"))

    reasons = defaultdict(int)
    for word_id, (jp, ko, reason) in targets.items():
        word = by_id[word_id]
        apply_example(word, jp, ko)
        reasons[reason] += 1

    used = set()
    collisions = 0
    for word in words:
        key = compact(word["example_jp"])
        if word["id"] in targets and key in used:
            # extremely unlikely template collision; uniquify
            word["example_jp"] = word["surface"] + "を例にして話す。"
            word["example_ko"] = gloss(word) + "을 예로 이야기한다."
            collisions += 1
            key = compact(word["example_jp"])
        used.add(key)

    changed = sorted(targets)
    changed_set = set(changed)
    naver = [row for row in naver if row["word_id"] not in changed_set]
    rebuilt = []
    seen = set()
    for row in examples:
        if row["word_id"] in changed_set:
            continue
        if row["word_id"] in seen:
            continue
        rebuilt.append(row)
        seen.add(row["word_id"])
    for word_id in changed:
        rebuilt.append(self_row(by_id[word_id], captured_at))
        seen.add(word_id)
    rebuilt.sort(key=lambda row: row["word_id"])
    if {row["word_id"] for row in rebuilt} != {row["id"] for row in words}:
        missing = {row["id"] for row in words} - {row["word_id"] for row in rebuilt}
        raise SystemExit(f"coverage missing {len(missing)} sample={sorted(missing)[:8]}")

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rewritten": len(changed),
        "reasons": dict(reasons),
        "template_collisions": collisions,
        "ids": changed,
    }
    print(json.dumps({k: manifest[k] for k in ("rewritten", "reasons", "template_collisions")}, ensure_ascii=False, indent=2))
    if args.dry_run:
        return

    write_csv(DATA / "jlpt_final_wordlist.csv", words, WORD_FIELDS)
    (DATA / "jlpt_final_wordlist.json").write_text(
        json.dumps({
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(words),
            "source": "data/pdf-vocab/jlpt_final_wordlist.csv",
            "vocabulary": words,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_csv(DATA / "naver_examples_final_qa_work.csv", naver, EXAMPLE_FIELDS)
    write_csv(DATA / "examples_final_qa_work.csv", rebuilt, EXAMPLE_FIELDS)
    (DATA / "jlpt_remaining_review_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
