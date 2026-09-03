#!/usr/bin/env python3
"""Rewrite the high-severity example-review-queue items.

- 66 cards whose example does not contain the current surface
- 103 Flitto / proverb / web-collected examples
- leftover 自動的な → 自動的
- a few low-score wrong-word examples
"""

from __future__ import annotations

import argparse
import csv
import json
import time
import unicodedata
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any
from urllib.parse import quote

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
EXAMPLE_FIELDS = (
    "word_id", "jp", "ko", "source", "source_url", "license",
    "permission_status", "attribution", "captured_at", "qa_status",
    "sort_order", "naver_example_id", "naver_source_cid", "naver_source_name",
    "query", "qa_note",
)
SELF_ATTRIBUTION = "AshitaKanji 편집 예문"
NOTE = "example-review-queue 2026-08-20; 표제어 원형 포함; 자체 작성"


def stable_word_id(surface: str, reading: str) -> str:
    basis = (
        f"{unicodedata.normalize('NFKC', surface)}"
        f"\u0001{unicodedata.normalize('NFKC', reading)}"
    )
    return f"w_{sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def infer_card_type(surface: str) -> str:
    if all("ぁ" <= ch <= "ゟ" or ch == "ー" for ch in surface):
        return "C"
    if all("゠" <= ch <= "ヿ" or ch == "ー" for ch in surface):
        return "D"
    has_kanji = any("一" <= ch <= "龯" or ch in "々〆ヶ" for ch in surface)
    has_hira = any("ぁ" <= ch <= "ゟ" for ch in surface)
    if has_kanji and has_hira:
        return "B"
    return "A" if has_kanji else "E"


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


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({field: row.get(field, "") for field in fields} for row in rows)


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


# surface -> (jp, ko). Used when the word_id is unique for that surface in this pass.
SURFACE_EXAMPLES: dict[str, tuple[str, str]] = {
    "にだい": ("自転車がにだい並んでいる。", "자전거가 두 대 늘어서 있다."),
    "おじさん": ("隣のおじさんが親切です。", "옆집 아저씨가 친절합니다."),
    "大勢": ("駅に大勢の人が集まっている。", "역에 많은 사람이 모여 있다."),
    "だんだん": ("天気がだんだん暖かくなってきた。", "날씨가 점점 따뜻해졌다."),
    "さす": ("雨が降ってきたので傘をさす。", "비가 와서 우산을 쓴다."),
    "しまう": ("おもちゃを箱にしまう。", "장난감을 상자에 넣는다."),
    "確か": ("その情報は確かだ。", "그 정보는 확실하다."),
    "だめ": ("この計画はだめだ。", "이 계획은 안 된다."),
    "落ちる": ("木の葉が静かに落ちる。", "나뭇잎이 조용히 떨어진다."),
    "おや": ("おや、もうこんな時間だ。", "어라, 벌써 이런 시간이다."),
    "運ぶ": ("荷物を部屋まで運ぶ。", "짐을 방까지 옮긴다."),
    "祝う": ("家族で誕生日を祝う。", "가족과 생일을 축하한다."),
    "冷える": ("夜になって空気が冷える。", "밤이 되니 공기가 차가워진다."),
    "叱る": ("先生が生徒を叱る。", "선생님이 학생을 꾸짖는다."),
    "せい": ("失敗は自分のせいだ。", "실패는 내 탓이다."),
    "支払う": ("料金を現金で支払う。", "요금을 현금으로 지불한다."),
    "いい加減": ("いい加減な返事はやめてほしい。", "대충 하는 대답은 그만해 줬으면 한다."),
    "うがい": ("うがいをしてから寝る。", "가글을 하고 잔다."),
    "握る": ("ハンドルをしっかり握る。", "핸들을 꽉 쥔다."),
    "掴む": ("チャンスを掴む。", "기회를 움켜쥔다."),
    "ぶつける": ("車を電柱にぶつける。", "차를 전신주에 부딪친다."),
    "かゆい": ("虫に刺されてかゆい。", "벌레에 물려서 가렵다."),
    "汚す": ("白い服を汚す。", "흰옷을 더럽힌다."),
    "税込み": ("税込みで三千円です。", "세금 포함해서 삼천 엔입니다."),
    "いらいら": ("待ち時間が長くていらいらする。", "기다리는 시간이 길어서 초조하다."),
    "明ける": ("夜が明ける。", "날이 샌다."),
    "こぼす": ("コーヒーをテーブルにこぼす。", "커피를 테이블에 쏟는다."),
    "剥く": ("りんごの皮を剥く。", "사과 껍질을 벗긴다."),
    "もうしわけない": ("遅くなってもうしわけない。", "늦어서 미안하다."),
    "いっきに": ("宿題をいっきに終わらせた。", "숙제를 단숨에 끝냈다."),
    "どうじに": ("二人がどうじに話し始めた。", "두 사람이 동시에 말하기 시작했다."),
    "ふやす": ("少しずつ貯金をふやす。", "조금씩 저축을 늘린다."),
    "代る": ("母に代って電話に出た。", "어머니 대신 전화를 받았다."),
    "くたびれる": ("一日歩いてくたびれる。", "하루 걸어서 지친다."),
    "いっぱんに": ("いっぱんに日本人は魚が好きだ。", "일반적으로 일본인은 생선을 좋아한다."),
    "あくまで": ("これはあくまで予想です。", "이것은 어디까지나 예상입니다."),
    "ずるい": ("順番を抜かすのはずるい。", "순서를 새치기하는 것은 치사하다."),
    "しゃべる": ("隣の人としゃべる。", "옆 사람과 이야기한다."),
    "おおよそ": ("おおよそ一時間かかります。", "대략 한 시간 걸립니다."),
    "雇う": ("店が新しい店員を雇う。", "가게가 새 점원을 고용한다."),
    "踏切": ("踏切で電車を待った。", "건널목에서 전철을 기다렸다."),
    "逆らう": ("親の意見に逆らう。", "부모의 의견에 거스른다."),
    "実る": ("秋になって稲が実る。", "가을이 되어 벼가 익는다."),
    "しゃっくり": ("食事のあとしゃっくりが出た。", "식사 후에 딸꾹질이 났다."),
    "躓く": ("暗い道で石に躓く。", "어두운 길에서 돌에 발이 걸린다."),
    "くるむ": ("赤ちゃんを毛布でくるむ。", "아기를 담요로 감싼다."),
    "つねる": ("弟の腕をつねる。", "동생 팔을 꼬집는다."),
    "あぶる": ("魚を火であぶる。", "생선을 불에 굽는다."),
    "おいて": ("会議は東京において開かれた。", "회의는 도쿄에서 열렸다."),
    "まとめ": ("今日の授業のまとめをする。", "오늘 수업 정리를 한다."),
    "偽物": ("これは偽物の時計だ。", "이것은 가짜 시계다."),
    "概ね": ("結果は概ね予想どおりだった。", "결과는 대체로 예상대로였다."),
    "叶える": ("長年の夢を叶える。", "오랜 꿈을 이룬다."),
    "舐める": ("猫がミルクを舐める。", "고양이가 우유를 핥는다."),
    "だるい": ("朝から体がだるい。", "아침부터 몸이 나른하다."),
    "染める": ("髪を黒く染める。", "머리를 검게 물들인다."),
    "まとまり": ("文章にまとまりがない。", "글에 짜임새가 없다."),
    "清々しい": ("朝の空気が清々しい。", "아침 공기가 상쾌하다."),
    "ひしひしと": ("責任をひしひしと感じる。", "책임을 절실히 느낀다."),
    "そっぽ": ("彼はそっぽを向いた。", "그는 외면했다."),
    "かさばる": ("冬服はかさばる。", "겨울옷은 부피가 크다."),
    "気掛かり": ("子供の将来が気掛かりだ。", "아이 장래가 걱정이다."),
    "かぶれる": ("漆にかぶれる。", "옻에 피부가 짓무른다."),
    "へりくだる": ("目上の人にへりくだる。", "윗사람에게 겸손하게 굽힌다."),
    "似通う": ("二人の意見はよく似通う。", "두 사람의 의견은 잘 비슷하다."),
    "しなびる": ("冷蔵庫の野菜がしなびる。", "냉장고 채소가 시든다."),
    "おっしゃる": ("先生はそうおっしゃる。", "선생님은 그렇게 말씀하신다."),
    "堪える": ("痛みにじっと堪える。", "아픔을 꾹 참는다."),
    "平らげる": ("大盛りのラーメンを平らげる。", "곱빼기 라멘을 다 먹는다."),
    "くださる": ("先生が資料をくださる。", "선생님이 자료를 주신다."),
    "いじめる": ("人をいじめるのはよくない。", "사람을 괴롭히는 것은 좋지 않다."),
    "いい": ("今日は天気がいい。", "오늘은 날씨가 좋다."),
    "見送る": ("駅まで友人を見送る。", "역까지 친구를 배웅한다."),
    "裏切る": ("親友を裏切る。", "친한 친구를 배신한다."),
    "真似る": ("先生の発音を真似る。", "선생님 발음을 흉내 낸다."),
    "四角い": ("四角い箱を開ける。", "네모난 상자를 연다."),
    "真ん丸い": ("真ん丸い月が出ている。", "동그란 달이 떠 있다."),
    "湿気る": ("梅雨で部屋が湿気る。", "장마로 방이 축축해진다."),
    "プール": ("夏はプールで泳ぐ。", "여름에는 수영장에서 헤엄친다."),
    "自主": ("生徒が自主的に掃除する。", "학생이 스스로 청소한다."),
    "人格": ("人の人格を尊重する。", "사람의 인격을 존중한다."),
    "ペア": ("二人はダンスのペアだ。", "두 사람은 댄스 페어다."),
    "際": ("出発の際に連絡します。", "출발할 때 연락합니다."),
    "ピストル": ("警官がピストルを構えた。", "경찰이 권총을 겨누었다."),
    "常に": ("彼は常に時間を守る。", "그는 항상 시간을 지킨다."),
    "意思": ("本人の意思を確認する。", "본인 의사를 확인한다."),
    "ぴたり": ("予想がぴたりと当たった。", "예상이 딱 맞았다."),
    "謙虚": ("謙虚な態度で話を聞く。", "겸손한 태도로 이야기를 듣는다."),
    "向ける": ("顔を窓のほうへ向ける。", "얼굴을 창 쪽으로 향한다."),
    "愉快": ("愉快な話を聞いた。", "유쾌한 이야기를 들었다."),
    "折り返す": ("手紙の端を折り返す。", "편지 끝을 접어 되돌린다."),
    "女子": ("女子学生が増えている。", "여학생이 늘고 있다."),
    "謙遜": ("彼はいつも謙遜する。", "그는 늘 겸손히 말한다."),
    "勇敢に": ("彼女は勇敢に意見を述べた。", "그녀는 용감하게 의견을 말했다."),
    "回復": ("病気から回復した。", "병에서 회복했다."),
    "蜂蜜": ("パンに蜂蜜をかける。", "빵에 꿀을 바른다."),
    "身体": ("身体を大切にする。", "몸을 소중히 한다."),
    "改良": ("製品を改良する。", "제품을 개량한다."),
    "攻める": ("前から攻める。", "앞에서 공격한다."),
    "永遠": ("永遠の友情を誓う。", "영원한 우정을 맹세한다."),
    "アワー": ("ラッシュアワーを避ける。", "러시아워를 피한다."),
    "失敗": ("一度の失敗であきらめない。", "한 번의 실패로 포기하지 않는다."),
    "一種": ("これは一種の習慣だ。", "이것은 일종의 습관이다."),
    "元": ("元の場所に戻す。", "원래 자리에 돌려놓는다."),
    "かみ合う": ("二人の意見がかみ合う。", "두 사람의 의견이 맞물린다."),
    "源": ("川の源を訪ねる。", "강의 근원을 찾아간다."),
    "慎重": ("慎重に話を進める。", "신중하게 이야기를 진행한다."),
    "全": ("全員が集まった。", "전원이 모였다."),
    "ストップ": ("ここでストップしよう。", "여기서 멈추자."),
    "人生": ("人生は一度きりだ。", "인생은 한 번뿐이다."),
    "藁": ("藁で靴を作る。", "짚으로 신을 만든다."),
    "ネット": ("ボールがネットに当たった。", "공이 네트에 맞았다."),
    "タイマー": ("タイマーを十分にセットする。", "타이머를 10분에 맞춘다."),
    "酔っ払い": ("夜の電車に酔っ払いが乗ってきた。", "밤 전철에 술 취한 사람이 탔다."),
    "面": ("問題の面を変えて考える。", "문제의 면을 바꿔 생각한다."),
    "ミス": ("小さなミスをやり直す。", "작은 실수를 다시 한다."),
    "樹木": ("公園の樹木を守る。", "공원의 나무를 지킨다."),
    "辛抱": ("もう少し辛抱する。", "조금 더 참는다."),
    "騒々しい": ("騒々しい通りを歩く。", "시끄러운 거리를 걷는다."),
    "到達": ("山頂に到達した。", "산정에 도달했다."),
    "考える": ("よく考えてから答える。", "잘 생각하고 나서 대답한다."),
    "大腿": ("転んで大腿を打った。", "넘어져 넓적다리를 부딪쳤다."),
    "中々": ("この問題は中々難しい。", "이 문제는 꽤 어렵다."),
    "川": ("川で魚を釣る。", "강에서 물고기를 잡는다."),
    "無駄": ("時間を無駄にしない。", "시간을 낭비하지 않는다."),
    "コレクション": ("切手のコレクションを見せてくれた。", "우표 수집품을 보여 주었다."),
    "天": ("晴れた日は天が青い。", "맑은 날은 하늘이 푸르다."),
    "楽しい": ("友達と話すのは楽しい。", "친구와 이야기하는 것은 즐겁다."),
    "ポジション": ("新しいポジションに就く。", "새 자리에 오른다."),
    "多忙": ("今月は多忙だ。", "이번 달은 바쁘다."),
    "退屈": ("授業が退屈だ。", "수업이 지루하다."),
    "うまい": ("この料理はうまい。", "이 요리는 맛있다."),
    "グループ": ("四人のグループで発表する。", "네 명 그룹으로 발표한다."),
    "内": ("一週間内に返事をください。", "일주일 안에 답을 주세요."),
    "慣習": ("土地の慣習に従う。", "그 땅의 관습을 따른다."),
    "心": ("心を込めて手紙を書く。", "마음을 담아 편지를 쓴다."),
    "恐怖": ("暗闇への恐怖がある。", "어둠에 대한 공포가 있다."),
    "君主": ("昔の君主の話を読む。", "옛 군주의 이야기를 읽는다."),
    "ステージ": ("歌手はステージに上がった。", "가수는 무대에 올랐다."),
    "チェンジ": ("選手をチェンジする。", "선수를 교체한다."),
    "事実": ("事実をそのまま伝える。", "사실을 그대로 전한다."),
    "タイムリー": ("タイムリーな助言だった。", "시기적절한 조언이었다."),
    "ポイント": ("説明のポイントをメモする。", "설명의 포인트를 적는다."),
    "友人": ("大学時代の友人に会う。", "대학 시절 친구를 만난다."),
    "きっちり": ("ふたをきっちり閉める。", "뚜껑을 꼭 닫는다."),
    "煉瓦": ("煉瓦の家が並んでいる。", "벽돌집이 늘어서 있다."),
    "ハードル": ("高いハードルを越える。", "높은 허들을 넘는다."),
    "競技": ("新しい競技に挑戦する。", "새로운 경기에 도전한다."),
    "セクション": ("本のこのセクションを読む。", "책의 이 부분을 읽는다."),
    "信仰": ("自分の信仰を大切にする。", "자신의 신앙을 소중히 한다."),
    "的確": ("的確な判断をする。", "정확한 판단을 한다."),
    "トレーニング": ("毎日トレーニングを続ける。", "매일 훈련을 이어 간다."),
    "卑怯": ("陰で悪口を言うのは卑怯だ。", "뒤에서 욕하는 것은 비겁하다."),
    "明瞭": ("説明が明瞭だ。", "설명이 명료하다."),
    "特長": ("この製品の特長を説明する。", "이 제품의 장점을 설명한다."),
    "目安": ("完成の目安は来週だ。", "완성 목표는 다음 주다."),
    "ルール": ("試合のルールを確認する。", "시합 규칙을 확인한다."),
    "レイアウト": ("新聞のレイアウトを変える。", "신문 레이아웃을 바꾼다."),
    "価格": ("価格が上がっている。", "가격이 오르고 있다."),
    "ポーズ": ("写真のためにポーズをとる。", "사진을 위해 포즈를 취한다."),
    "偏り": ("意見に偏りがある。", "의견에 치우침이 있다."),
    "不断": ("不断の努力が実を結ぶ。", "끊임없는 노력이 결실을 맺는다."),
    "先頭": ("列の先頭に立つ。", "줄의 맨 앞에 선다."),
    "使用人": ("店の使用人が客を案内する。", "가게 점원이 손님을 안내한다."),
    "翼": ("鳥が翼を広げる。", "새가 날개를 펼친다."),
    "アプローチ": ("問題へのアプローチを変える。", "문제에 대한 접근을 바꾼다."),
    "魂": ("物語に魂がこもっている。", "이야기에 혼이 담겨 있다."),
    "勇敢": ("勇敢な決断だった。", "용감한 결단이었다."),
    "順々": ("順々に名前を呼ばれた。", "차례차례 이름이 불렸다."),
    "危険": ("その道は夜は危険だ。", "그 길은 밤에 위험하다."),
    "タイム": ("タイムを計る。", "시간을 잰다."),
    "率": ("合格率が上がった。", "합격률이 올랐다."),
    "ベスト": ("ベストを尽くす。", "최선을 다한다."),
    "頼もしい": ("彼の返事は頼もしい。", "그의 대답은 든든하다."),
    "現す": ("本音を現す。", "본심을 드러낸다."),
    "手前": ("駅の手前で降りる。", "역 앞에서 내린다."),
    "催す": ("来月展覧会を催す。", "다음 달 전시회를 연다."),
    "慣れ": ("新しい仕事に慣れが必要だ。", "새 일에 익숙해질 필요가 있다."),
    "切り替え": ("話題の切り替えが早い。", "화제 전환이 빠르다."),
    "腿": ("転んで腿を打った。", "넘어져 허벅지를 부딪쳤다."),
    "重々しい": ("重々しい雰囲気になった。", "엄숙한 분위기가 되었다."),
}

ID_EXAMPLES: dict[str, tuple[str, str]] = {
    "w_615da3adb56a4017": ("この問題はすぐ解ける。", "이 문제는 바로 풀린다."),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    words = read_csv(DATA / "jlpt_final_wordlist.csv")
    by_id = {row["id"]: row for row in words}
    examples = read_csv(DATA / "examples_final_qa_work.csv")
    naver = read_csv(DATA / "naver_examples_final_qa_work.csv")
    captured_at = str(int(time.time() * 1000))
    changed: list[str] = []
    successors: dict[str, str] = {}

    # leftover な-adjective
    old = by_id["w_292833139acbd808"]
    old_id = old["id"]
    old.update({
        "surface": "自動的",
        "reading_kana": "じどうてき",
        "furigana": "じどうてき",
        "meaning_ko": "자동적임",
        "part_of_speech": "adjective",
        "example_jp": "ドアが自動的に閉まる。",
        "example_ko": "문이 자동으로 닫힌다.",
        "example_jp_author": SELF_ATTRIBUTION,
        "example_license": "self",
    })
    new_id = stable_word_id(old["surface"], old["reading_kana"])
    old["id"] = new_id
    old["card_type"] = infer_card_type(old["surface"])
    old["frequency"] = f"{zipf_frequency(old['surface'], 'ja') or zipf_frequency(old['reading_kana'], 'ja'):.3f}"
    add_tag(old, "example-review-2026-08-20")
    successors[old_id] = new_id
    by_id.pop(old_id)
    by_id[new_id] = old
    changed.append(new_id)

    by_id["w_2aec0f55185205c2"]["meaning_ko"] = "인격, 성격"
    add_tag(by_id["w_2aec0f55185205c2"], "example-review-2026-08-20")

    applied_surfaces = set()
    for row in words:
        key = row["id"]
        pair = ID_EXAMPLES.get(key) or SURFACE_EXAMPLES.get(row["surface"])
        if not pair:
            continue
        jp, ko = pair
        if row["example_jp"] == jp and row["example_ko"] == ko and row.get("example_license") == "self":
            continue
        row["example_jp"] = jp
        row["example_ko"] = ko
        row["example_jp_author"] = SELF_ATTRIBUTION
        row["example_license"] = "self"
        add_tag(row, "example-review-2026-08-20")
        changed.append(row["id"])
        applied_surfaces.add(row["surface"])

    missing_surfaces = set(SURFACE_EXAMPLES) - applied_surfaces - {"自動的な"}
    missing_surfaces.discard("自動的")
    if missing_surfaces:
        still = [surface for surface in missing_surfaces if any(row["surface"] == surface for row in words)]
        unused = missing_surfaces - set(still)
        if still:
            raise SystemExit(f"rewrite surfaces present but not applied: {sorted(still)[:20]}")

    changed = sorted(set(changed))
    changed_set = set(changed)
    naver = [row for row in naver if row["word_id"] not in changed_set and row["word_id"] != old_id]
    new_examples = []
    seen = set()
    for row in examples:
        word_id = new_id if row["word_id"] == old_id else row["word_id"]
        if word_id in changed_set:
            continue
        if word_id in seen:
            continue
        row = dict(row)
        row["word_id"] = word_id
        new_examples.append(row)
        seen.add(word_id)
    for word_id in changed:
        word = by_id[word_id]
        new_examples.append(self_row(word, captured_at))
        seen.add(word_id)
    new_examples.sort(key=lambda row: row["word_id"])
    if {row["word_id"] for row in new_examples} != {row["id"] for row in words}:
        missing = {row["id"] for row in words} - {row["word_id"] for row in new_examples}
        extra = {row["word_id"] for row in new_examples} - {row["id"] for row in words}
        raise SystemExit(f"example coverage missing={sorted(missing)[:8]} extra={sorted(extra)[:8]}")

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rewritten": len(changed),
        "successors": successors,
        "ids": changed,
    }
    print(json.dumps({k: manifest[k] for k in ("rewritten", "successors")}, ensure_ascii=False, indent=2))
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
    write_csv(DATA / "examples_final_qa_work.csv", new_examples, EXAMPLE_FIELDS)
    (DATA / "jlpt_example_review_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    # merge successors into priority-fix manifest so coverage/remap stay complete
    priority_path = DATA / "jlpt_priority_fix_manifest.json"
    if priority_path.exists() and successors:
        priority = json.loads(priority_path.read_text(encoding="utf-8"))
        merged = dict(priority.get("successors") or {})
        merged.update(successors)
        priority["successors"] = merged
        priority_path.write_text(json.dumps(priority, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
