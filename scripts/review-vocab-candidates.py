#!/usr/bin/env python3
"""Apply a conservative manual review to the evidence-backed candidates.

Only the 1st-pass candidates are decided here.  Low-confidence 2nd-pass rows
remain pending.  Decisions intentionally distinguish deleting a redundant row
from correcting a useful but malformed/old-fashioned row.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DISTINCT_SEMANTIC_IDS = {
    "w_c9624a11c7f3b950",  # 尤も / 最も
    "w_a02732cc17e7d4fd",  # 煎る / 炒る
    "w_01f119facf6e9d97",  # 伯父さん / 叔父さん
    "w_a430acefffcd0bfe",  # 小父さん / 叔父さん
    "w_c849a3f0fc65ee8e",  # 成育 / 生育
    "w_0cf78249edb1bc3d",  # 暖まる / 温まる
    "w_a40a6e3986ccc3b4",  # 暖める / 温める
    "w_f7ccae9d8e37b9be",  # 超す / 越す
    "w_f1e8d7483ee776ca",  # 貴い / 尊い
    "w_4ef2af90123264d7",  # 手数 てかず / てすう
    "w_f3c36a6b1c35c8d8",  # 代える / 替える
    "w_3e244d7a11df3ed3",  # 器械 / 機械
    "w_a1af5d3d26a5e7b2",  # 換える / 替える
    "w_654de4aa5b8a5a22",  # 生長 / 成長
    "w_e74097848962e54a",  # 捜す / 探す
    "w_f0ba0fc937416985",  # 群集 / 群衆
    "w_5be62d71deeeebf2",  # 造り / 作り
    "w_a607d0d4b4d7b1a2",  # 越える / 超える
    "w_51b95d78d41ec7ac",  # 陰 / 影
    "w_860e76f83693f071",  # 大便 / 代弁 (Korean homonym)
    "w_42b5ce2223232e9f",  # 討つ / 撃つ
    "w_6150d13214b175ad",  # 下りる / 降りる
    "w_97db66ffd893f4b5",  # 伯母 / 叔母
    "w_3f7cd0c1898ad235",  # 空く / 開く
    "w_f372d394a0a4c4e1",  # 現す / 表す
    "w_e1e5d18b1acfa419",  # 堅い / 固い
    "w_188378c15d9c641d",  # 伯父 / 叔父
    "w_08fb3f57661da121",  # 硬い / 固い
    "w_743a4812f556804d",  # 温かい / 暖かい
    "w_7cd2a64b26436658",  # 最中 さいちゅう / さなか
    "w_016ef21c6de7dbf3",  # 素 / 元
    "w_c764decd3f5b167e",  # 基 / 元
    "w_d728d1f32a31b6f6",  # 遭う / 会う
    "w_9da5d3e318f2c437",  # 股 / 腿
    "w_333895c749853e94",  # 避ける よける / さける
    "w_57c108f507b24abb",  # 納まる / 収まる
    "w_a2cf2915e143c029",  # 描く えがく / かく
    "w_e79c8ba878e30a15",  # 工場 こうば / こうじょう
    "w_fe67641683421c77",  # 頭 かしら / あたま
    "w_6cebb24556eb94e7",  # 今日 こんにち / きょう
    "w_b6692781d912a8ce",  # 初めに / 始めに
    "w_b685e7abbe1567a6",  # 昇る / 上る
    "w_2b4e1d8e18afc8e6",  # 勤め / 務め
    "w_7c846856a25ae36a",  # 獣 けもの / けだもの
}

USEFUL_READING_IDS = {
    "w_c2cc27b9a22c206e",  # 濯ぐ ゆすぐ
    "w_33687b5b97477220",  # 一昨日 いっさくじつ
    "w_b4b5fbd14fb214b4",  # 明後日 みょうごにち
    "w_49b375af96425cbe",  # 明日 あす
    "w_73e0fb95b7f90273",  # 行き いき
    "w_82adb6170ea8495c",  # 魚 うお
    "w_88d4a0016b8cd6a1",  # 重複 ちょうふく
    "w_951746f7e1a78e82",  # 世論 せろん
    "w_09e23b6f9018545a",  # 早急 さっきゅう
}

PREFERRED_CURRENT_IDS = {
    "w_de63da100ac1f50b",  # つまずく (usual kana form)
    "w_5306465650e71486",  # 手頃
    "w_d563b8ed71bad118",  # 湿気 しっけ
    "w_c3f7e5d635243522",  # 出生 しゅっしょう
    "w_00c99649445717dd",  # 間もなく
    "w_9f483af3f38eaacd",  # 面目 めんぼく
}

DUPLICATE_CORRECTIONS: dict[str, dict[str, str]] = {
    "w_1c1503ab26f6fd96": {
        "surface": "下ろす",
        "note": "降ろす와 의미가 겹친 것이 아니라 현재 표기가 잘못되었습니다. 下ろす로 교정해 유지합니다.",
    }
}

SEVERE_EXCLUDE_NOTES = {
    "w_ccdf99549e31659b": "신규 최빈출에 표준형 割り込む가 있어 기존 비표준형은 제외합니다.",
    "w_0e243c6681fb79d2": "신규 최빈출에 표준형 引き受ける가 있어 기존 비표준형은 제외합니다.",
    "w_073756c8c779b58c": "신규 최빈출에 표준형 損なう가 있어 기존 비표준형은 제외합니다.",
    "w_cffcd19e5154f169": "신규 최빈출에 표준형 思いがけない가 있어 기존 비표준형은 제외합니다.",
    "w_6d62fb914342d125": "신규 최빈출에 표준형 情けない가 있어 기존 비표준형은 제외합니다.",
    "w_45c5e33b5893a15e": "기존 DB에 표준형 きっかけ가 있어 희귀 한자형은 제외합니다.",
    "w_6309803841c85097": "기존 DB에 일반 표기 もたれる가 있어 희귀 한자형은 제외합니다.",
}

SEVERE_KEEP_IDS = {
    "w_68f04444965e780c": "藁는 정상 표기이며 단어 자체가 유효하므로 유지합니다.",
    "w_8f43b180efb6a864": "虹는 정상 표기입니다. JMdict 보조 정보가 다른 표기에 적용된 오탐이라 유지합니다.",
    "w_9db786096f7cde8d": "位(くらい)는 지위·정도 용법의 정상 표기이므로 유지합니다.",
    "w_9c2fb37ac164be4e": "バック은 일반적인 외래어 표기입니다. 부차 용법 태그로 인한 오탐이라 유지합니다.",
}

SEVERE_CORRECTIONS: dict[str, tuple[str, str]] = {
    "w_df9ada6a3bbb5a4e": ("ひっくり返す", "일반적인 가나 혼용 표기로 교정"),
    "w_8934d6c8263dfd61": ("タイヤ", "현대 표준 가나 표기로 교정"),
    "w_b68082aedaf58a82": ("ウェイトレス", "JMdict 우선 가나 표기로 교정"),
    "w_0c65051e7fb4fb1f": ("おおよそ", "일반적인 가나 표기로 교정"),
    "w_1a8c0155532e3245": ("ティッシュペーパー", "현대 표준 가나 표기로 교정"),
    "w_608682452546b0df": ("逆さま", "일반적인 혼용 표기로 교정"),
    "w_e77d2f8dd2832f93": ("あくまで", "일반적인 가나 표기로 교정"),
    "w_1dec60862e34eb14": ("そっぽ", "일반적인 가나 표기로 교정"),
    "w_3dd4951bd01e8398": ("浮かぶ", "누락된 오쿠리가나를 교정"),
    "w_259bf5ed1faa6c42": ("交わす", "누락된 오쿠리가나를 교정"),
    "w_2e701fac06c99b94": ("人差し指", "누락된 오쿠리가나를 교정"),
    "w_7220f29b7ab9d849": ("する", "희귀 한자 표기를 일반 표기로 교정하고 뜻은 '하다'로 유지"),
    "w_d36340f2e47a8460": ("口ずさむ", "일반적인 혼용 표기로 교정"),
    "w_21ffbc4bc128572e": ("見つめる", "일반적인 혼용 표기로 교정"),
    "w_a0a47c96cc66d963": ("夜更かし", "누락된 오쿠리가나를 교정"),
    "w_c6fba2d66bc68748": ("なれなれしい", "일반적으로 쓰는 가나 표기로 교정"),
    "w_5b90d006ae01b3a8": ("ずるい", "일반적으로 쓰는 가나 표기로 교정"),
    "w_7212438dde477025": ("完璧", "검색 전용 혼용 표기를 표준 한자형으로 교정"),
    "w_9832c96412b45fec": ("仕上げ", "누락된 오쿠리가나를 교정"),
    "w_1f5508db6aa19315": ("ようやく", "일반적으로 쓰는 가나 표기로 교정"),
    "w_10ff23f2d6f00e95": ("おいて", "일반적으로 쓰는 가나 표기로 교정"),
    "w_8112103205b7d884": ("切り替え", "누락된 오쿠리가나를 교정"),
    "w_17036d0d07dbde4f": ("朝ご飯", "희귀 한자형을 일반적인 혼용 표기로 교정"),
    "w_c73083f7ce0f1120": ("せい", "일반적으로 쓰는 가나 표기로 교정"),
    "w_70fd64391d08ee53": ("下がる", "읽기 さがる에 맞도록 잘못된 표기 下る를 교정"),
    "w_d7f8d04860ff93aa": ("まとめ", "일반적으로 쓰는 가나 표기로 교정"),
    "w_6707492979ff8a45": ("なめる", "일반적으로 쓰는 가나 표기로 교정"),
    "w_c3b45aa8963813d2": ("お世辞", "일반적인 혼용 표기로 교정"),
    "w_8af924917469c9f0": ("楽しむ", "누락된 오쿠리가나를 교정"),
    "w_8a81993924cacac2": ("再来年", "검색 전용 혼용 표기를 표준 한자형으로 교정"),
    "w_52884ca8975b7037": ("偽物", "혼용 표기를 일반 한자형으로 교정"),
    "w_8ed492347d7f1855": ("付き合う", "누락된 오쿠리가나를 교정"),
    "w_0d59c9eb63d42ae8": ("落ちる", "누락된 오쿠리가나를 교정"),
    "w_5cb28e413943d38b": ("たまたま", "일반적으로 쓰는 가나 표기로 교정"),
}

LOW_CONFIRMED_EXCLUDE = {
    "w_4adb990c9b6ef797": "기존 DB에 표준형 汚す가 있어 가나 중복형은 제외합니다.",
    "w_6dcadacb65506fb2": "기존 DB에 표준형 箇所가 있어 가나 중복형은 제외합니다.",
    "w_7c11f2be2fbf4db0": "기존 DB에 표준형 含める가 있어 가나 중복형은 제외합니다.",
    "w_98da7341e355c493": "신규 최빈출에 일반 표기 あっけない가 있어 한자형은 제외합니다.",
    "w_862e7dc7752c08d6": "신규 최빈출에 일반 표기 おばさん가 있어 희귀 한자형은 제외합니다.",
    "w_6fddc1e91dadbf61": "기존 DB에 표준형 燃やす가 있어 가나 중복형은 제외합니다.",
}

LOW_OPTIONAL_EXCLUDE = {
    "w_3456154ceafce41a": "一昨昨日는 정확하지만 현대 사용 빈도가 매우 낮아 교체 우선순위가 높습니다.",
    "w_a424e854ab59be73": "伜는 せがれ의 드문 한자 표기로 앱 학습 효율이 낮습니다.",
    "w_40d5e8ace8265737": "突っ突く는 보통 つっつく로 쓰이며 독립 카드 가치가 낮습니다.",
    "w_d8c894b9d0b56bd5": "局限은 제한·국한으로 대체되는 매우 낮은 빈도의 문어 어휘입니다.",
    "w_9012d41b62a0fdef": "異見은 JMdict에서 obsolete로 표시되고 일반적으로 意見을 사용합니다.",
    "w_f58698f88c6b5763": "弛み 한자형은 드물며 보통 たるみ로 씁니다.",
    "w_f991eddfc128284f": "屎尿는 제한적인 행정·위생 분야 용어라 일반 JLPT 학습 우선도가 낮습니다.",
    "w_49b1b9da6abfc4b4": "イェス는 현대 표기 イエス보다 드문 표기입니다.",
    "w_fd8de04bcf7491cf": "謝絶은 사용 영역이 좁은 격식어로 일반 학습 우선도가 낮습니다.",
    "w_86772cf44aaa74e8": "吹奏는 주로 吹奏楽 안에서 쓰여 독립 카드 우선도가 낮습니다.",
    "w_e010e97d5f09b8ea": "盛装은 사용 빈도가 낮고 일반적으로 盛装する·正装으로 나타납니다.",
    "w_a0605c89158e116f": "店屋는 현대 일반어 店보다 우선도가 낮습니다.",
    "w_fd385a3adcbade21": "清濁은 관용구·문어 맥락 중심이라 독립 카드 우선도가 낮습니다.",
    "w_311d49f34203a161": "霰는 정확한 단어지만 일상·시험 학습 우선도가 낮습니다.",
    "w_08ef9125d5971911": "洋品店은 현대에 사용이 줄어든 업종 표현입니다.",
}

LOW_CORRECTIONS: dict[str, tuple[str, str]] = {
    "w_ed0aaec22c22bcb4": ("食事", "읽기 しょくじする를 しょくじ로 교정하고 명사/する동사 정보를 품사로 처리"),
    "w_34c8047bc1fba928": ("しなびる", "일반적으로 쓰는 가나 표기로 교정"),
    "w_8bff216fb55cb6ad": ("ぶら下げる", "일반적인 혼용 표기로 교정"),
    "w_74e11be34e28cae2": ("混ざる", "일반 한자형으로 교정"),
    "w_976ded6e29683876": ("箇条書き", "누락된 오쿠리가나를 교정"),
    "w_8620630325882eef": ("ロープウェイ", "현대 표준 가나 표기로 교정"),
    "w_e740ff488d8fb2ff": ("まとまり", "일반적으로 쓰는 가나 표기로 교정"),
    "w_244b27baa8480151": ("すれ違い", "일반적인 혼용 표기로 교정"),
    "w_b5ea7422554eec0c": ("焚き火", "누락된 오쿠리가나를 교정"),
    "w_a5222bbb582e5063": ("蒸留", "현대 표준 한자 표기로 교정"),
    "w_0437d636307ba5e5": ("やむを得ない", "일반적인 혼용 표기로 교정"),
}

NORMALIZATION_CORRECTIONS: dict[str, tuple[str, str]] = {
    "w_78254f13cadebd7e": ("さする", "摩する는 표기와 활용이 맞지 않아 일반 표기 さする로 교정"),
    "w_e69fbb37694a99ab": ("煌々と", "표기는 유효합니다. 품사를 noun에서 adverb로 교정해 유지"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/pdf-vocab/replacement_candidates.json"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/pdf-vocab/replacement_candidates_reviewed.json"),
    )
    return parser.parse_args()


def apply_review(row: dict[str, Any]) -> dict[str, Any]:
    word_id = row["word_id"]
    reviewed = dict(row)
    reviewed.update(
        {
            "manual_review_status": "검수 완료",
            "manual_decision": "",
            "manual_note": "",
            "suggested_surface": "",
            "suggested_reading": "",
            "suggested_meaning_ko": "",
            "suggested_part_of_speech": "",
        }
    )

    if row["candidate_stage"] == "2차 보류":
        reviewed["manual_review_status"] = "2차 미검수"
        reviewed["manual_decision"] = "보류"
        reviewed["manual_note"] = "이번 검수 범위는 1차 후보 245개입니다."
        return reviewed

    action = row["recommended_action"]
    if action == "중복 변형 제거 검토":
        if word_id in DUPLICATE_CORRECTIONS:
            correction = DUPLICATE_CORRECTIONS[word_id]
            reviewed["manual_decision"] = "수정 후 유지"
            reviewed["manual_note"] = correction["note"]
            reviewed["suggested_surface"] = correction["surface"]
        elif word_id in DISTINCT_SEMANTIC_IDS:
            reviewed["manual_decision"] = "수정 후 유지"
            reviewed["manual_note"] = (
                "비교 대상과 표기·읽기는 연관되지만 의미 또는 사용 맥락이 다릅니다. "
                "삭제하지 않고 한국어 뜻을 구분해 유지합니다."
            )
        elif word_id in USEFUL_READING_IDS:
            reviewed["manual_decision"] = "유지"
            reviewed["manual_note"] = (
                "실제로 쓰이는 별도 읽기입니다. 현재 스키마가 복수 읽기 카드를 "
                "지원하지 않으므로 독립 카드로 유지합니다."
            )
        elif word_id in PREFERRED_CURRENT_IDS:
            reviewed["manual_decision"] = "유지"
            reviewed["manual_note"] = (
                "현재 행이 비교 대상으로 잡힌 대표 행보다 일반적이거나 JMdict 우선도가 "
                "높습니다. 현재 행을 유지하고 상대 행을 추후 제외 후보로 전환합니다."
            )
        else:
            reviewed["manual_decision"] = "제외 확정"
            reviewed["manual_note"] = (
                f"대표 카드 {row.get('canonical_surface') or row.get('canonical_word_id')}가 "
                "이미 있어 학습 내용이 중복됩니다. 대표 카드에 필요한 보조 표기만 남기고 제외합니다."
            )
        return reviewed

    if action == "표기 교정·교체 검토":
        if word_id in SEVERE_EXCLUDE_NOTES:
            reviewed["manual_decision"] = "제외 확정"
            reviewed["manual_note"] = SEVERE_EXCLUDE_NOTES[word_id]
        elif word_id in SEVERE_KEEP_IDS:
            reviewed["manual_decision"] = "유지"
            reviewed["manual_note"] = SEVERE_KEEP_IDS[word_id]
        elif word_id in SEVERE_CORRECTIONS:
            surface, note = SEVERE_CORRECTIONS[word_id]
            reviewed["manual_decision"] = "수정 후 유지"
            reviewed["manual_note"] = note
            reviewed["suggested_surface"] = surface
            reviewed["suggested_reading"] = surface if not any("一" <= ch <= "龯" for ch in surface) else row["reading_kana"]
            if word_id == "w_7220f29b7ab9d849":
                reviewed["suggested_meaning_ko"] = "하다"
        else:
            raise RuntimeError(f"unreviewed severe candidate: {word_id}")
        return reviewed

    if action == "저활용 제외 검토":
        if word_id in LOW_CONFIRMED_EXCLUDE:
            reviewed["manual_decision"] = "제외 확정"
            reviewed["manual_note"] = LOW_CONFIRMED_EXCLUDE[word_id]
        elif word_id in LOW_OPTIONAL_EXCLUDE:
            reviewed["manual_decision"] = "제외 가능"
            reviewed["manual_note"] = LOW_OPTIONAL_EXCLUDE[word_id]
        elif word_id in LOW_CORRECTIONS:
            surface, note = LOW_CORRECTIONS[word_id]
            reviewed["manual_decision"] = "수정 후 유지"
            reviewed["manual_note"] = note
            reviewed["suggested_surface"] = surface
            reviewed["suggested_reading"] = surface if not any("一" <= ch <= "龯" for ch in surface) else row["reading_kana"].replace("する", "") if word_id == "w_ed0aaec22c22bcb4" else row["reading_kana"]
        else:
            reviewed["manual_decision"] = "유지"
            reviewed["manual_note"] = (
                "빈도 수치만 낮을 뿐 실제 사용되는 유효 어휘입니다. 빈도만으로 삭제하지 않습니다."
            )
        return reviewed

    if action == "데이터 정규화 검토":
        if word_id not in NORMALIZATION_CORRECTIONS:
            raise RuntimeError(f"unreviewed normalization candidate: {word_id}")
        surface, note = NORMALIZATION_CORRECTIONS[word_id]
        reviewed["manual_decision"] = "수정 후 유지"
        reviewed["manual_note"] = note
        reviewed["suggested_surface"] = surface
        reviewed["suggested_reading"] = "さする" if word_id == "w_78254f13cadebd7e" else row["reading_kana"]
        if word_id == "w_e69fbb37694a99ab":
            reviewed["suggested_part_of_speech"] = "adverb"
        return reviewed

    raise RuntimeError(f"unexpected first-pass action: {action} ({word_id})")


def main() -> None:
    args = parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    candidates = [apply_review(row) for row in data["candidates"]]

    first_pass = [
        row for row in candidates if row["manual_review_status"] == "검수 완료"
    ]
    if len(first_pass) != 245:
        raise RuntimeError(f"expected 245 first-pass reviews, got {len(first_pass)}")
    if any(not row["manual_decision"] for row in first_pass):
        raise RuntimeError("blank first-pass decision")

    decisions = Counter(row["manual_decision"] for row in first_pass)
    actions = Counter(row["recommended_action"] for row in first_pass)
    reviewed_ids = {row["word_id"] for row in first_pass}
    if len(reviewed_ids) != len(first_pass):
        raise RuntimeError("duplicate reviewed word IDs")

    data["review"] = {
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "scope": "1차 제외 추천 + 1차 검토 후보",
        "reviewed_count": len(first_pass),
        "pending_second_pass": sum(
            row["manual_review_status"] == "2차 미검수" for row in candidates
        ),
        "decision_counts": dict(decisions),
        "reviewed_action_counts": dict(actions),
        "policy": [
            "최빈출 핵심 단어는 계속 보호",
            "JMdict 동일 엔트리라도 의미·용법이 다르면 유지",
            "정상 어휘의 낮은 Zipf 빈도만으로는 삭제하지 않음",
            "표기 오류·구표기는 가능한 경우 표준형으로 교정",
            "대표형이 기존 DB 또는 신규 최빈출에 있을 때만 중복 제외를 확정",
        ],
    }
    data["candidates"] = candidates
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(data["review"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
