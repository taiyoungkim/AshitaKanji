#!/usr/bin/env python3
"""One-by-one verification of the current JLPT word list.

Uses NAVER Japanese Dictionary's displayed JLPT catalog for every row, then live-searches NAVER
for unmatched, ambiguous, or mismatched rows. JMdict, examples, and TTS are
checked in the same pass.

Release failure is only:
  confirmed level mismatch, missing/broken example, missing TTS, DB mismatch.

Catalog-absent する-forms, counters, homographs, unconfirmed catalog
mismatches, and JMdict derived-form flags go to a review queue and do not fail.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import html
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
API = "https://ja.dict.naver.com/api3/jako/search"
SEARCH_URL = "https://ja.dict.naver.com/#/search?query="
KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
HTML_RE = re.compile(r"<[^>]+>")
FORM_SPLIT_RE = re.compile(r"[·・･,，、/／|｜;；\s]+")
KO_SPLIT_RE = re.compile(r"[,，、/;；·・\s]+")
RUBY_RE = re.compile(r"\[([^\[\]]+)\]")
ID_RE = re.compile(r"w_[0-9a-f]{16}")
KATA2HIRA = {chr(c): chr(c - 0x60) for c in range(0x30A1, 0x30F7)}
BAD_KANJI_INF = ("rarely", "irregular", "outdated", "search-only")
BAD_KANA_INF = ("irregular", "outdated", "search-only", "old ")
FAIL_ISSUES = frozenset({
    "level-mismatch-confirmed",
    "example-missing",
    "example-headword-missing",
    "example-source-missing",
    "tts-word-missing",
    "tts-example-missing",
    "tts-word-map-missing",
    "tts-example-map-missing",
    "db-mismatch",
})
COUNTER_RE = re.compile(
    r"(?:[一二三四五六七八九十百千万0-9０-９]+|[何数])"
    r"(?:円|匹|冊|台|個|本|枚|人|歳|才|回|階|軒|キロ|メートル|グラム|リットル)"
)
ACCEPTED_QUEUE_BUCKETS = frozenset({
    "catalog-absent-search-match",
    "no-jlpt-badge",
    "suru-compound",
    "counter",
    "catalog-mismatch-unconfirmed",
    "homograph",
    "catalog-absent",
    "spelling",
    "search-unmatched",
})
SUFFIXES = [
    "する",
    "した",
    "して",
    "します",
    "に",
    "と",
    "な",
    "の",
    "だ",
    "です",
    "ます",
    "い",
    "く",
    "り",
    "を",
    "が",
    "は",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--words", type=Path, default=ROOT / "data/pdf-vocab/jlpt_final_wordlist.csv")
    parser.add_argument("--naver-examples", type=Path, default=ROOT / "data/pdf-vocab/naver_examples_final_qa_work.csv")
    parser.add_argument("--self-examples", type=Path, default=ROOT / "data/pdf-vocab/self_authored_examples_qa_work.csv")
    parser.add_argument("--catalog", type=Path, default=ROOT / ".cache/naver-jlpt-catalog.json")
    parser.add_argument("--jmdict", type=Path, default=ROOT / ".cache/JMdict_e.gz")
    parser.add_argument("--db", type=Path, default=ROOT / "assets/jlpt.db")
    parser.add_argument("--search-cache", type=Path, default=ROOT / ".cache/naver-full-search.json")
    parser.add_argument("--report", type=Path, default=ROOT / "data/pdf-vocab/naver_full_verification.json")
    parser.add_argument("--issues", type=Path, default=ROOT / "data/pdf-vocab/naver_full_verification_flags.csv")
    parser.add_argument("--failures", type=Path, default=ROOT / "data/pdf-vocab/naver_full_verification_failures.csv")
    parser.add_argument("--queue", type=Path, default=ROOT / "data/pdf-vocab/naver_full_verification_queue.csv")
    parser.add_argument("--accepted", type=Path, default=ROOT / "data/pdf-vocab/naver_audit_accepted_queue.json")
    parser.add_argument("--accepted-out", type=Path, default=ROOT / "data/pdf-vocab/naver_full_verification_accepted.csv")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--delay-ms", type=int, default=180)
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--live-limit", type=int, default=0, help="0 = search every pending query")
    parser.add_argument("--skip-live", action="store_true")
    return parser.parse_args()


def clean_markup(value: Any) -> str:
    return html.unescape(HTML_RE.sub("", str(value or ""))).strip()


def normalized(value: Any) -> str:
    return clean_markup(value).replace(" ", "").replace("　", "").replace("-", "").replace("ー", "ー")


def to_hira(value: str) -> str:
    return "".join(KATA2HIRA.get(ch, ch) for ch in value)


def norm_reading(value: Any) -> str:
    return to_hira(normalized(value).replace("・", ""))


def forms(value: Any) -> set[str]:
    plain = normalized(value)
    if not plain:
        return set()
    parts = {part for part in FORM_SPLIT_RE.split(plain) if part}
    parts.add(plain)
    return parts


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_json(path: Path) -> Any:
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def map_ids(path: Path, kind: str) -> set[str]:
    text = path.read_text(encoding="utf-8")
    pattern = rf"{kind.upper()}_AUDIO: Record<string, number> = \{{(.*?)\n\}};"
    match = re.search(pattern, text, re.S)
    if not match:
        return set()
    return set(ID_RE.findall(match.group(1)))


def fetch_json(url: str, timeout: float, retries: int) -> dict[str, Any]:
    last_error = ""
    for attempt in range(retries):
        try:
            process = subprocess.run(
                [
                    "curl",
                    "-sS",
                    "--compressed",
                    "--fail",
                    "--max-time",
                    str(timeout),
                    "-H",
                    "User-Agent: Mozilla/5.0",
                    "-H",
                    "Referer: https://ja.dict.naver.com/",
                    url,
                ],
                check=True,
                capture_output=True,
            )
            return json.loads(process.stdout)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            time.sleep(min(4.0, 0.5 * (2**attempt)))
    raise RuntimeError(f"NAVER request failed: {url}: {last_error}")


def fetch_query(query: str, timeout: float, retries: int) -> dict[str, Any]:
    params = urllib.parse.urlencode({"query": query, "m": "pc", "range": "word"})
    try:
        document = fetch_json(f"{API}?{params}", timeout, retries)
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc), "items": []}
    items = (
        document.get("searchResultMap", {})
        .get("searchResultListMap", {})
        .get("WORD", {})
        .get("items", [])
    )
    reduced = []
    for item in items or []:
        reduced.append(
            {
                "rank": str(item.get("rank", "")),
                "entry_id": str(item.get("entryId", "")),
                "match_type": str(item.get("matchType", "")),
                "entry": clean_markup(item.get("expEntry")),
                "handle_entry": clean_markup(item.get("handleEntry")),
                "kanji": clean_markup(item.get("expKanji")),
                "audio_read": clean_markup(item.get("expAudioRead")),
                "meaning_read": clean_markup(item.get("expMeaningRead")),
                "frequency_add": str(item.get("frequencyAdd") or ""),
                "means": [
                    clean_markup(mean.get("value") if isinstance(mean, dict) else mean)
                    for mean in (item.get("meansCollector") or [])
                ],
            }
        )
    return {"ok": True, "items": reduced}


def catalog_forms(item: dict[str, Any]) -> tuple[set[str], set[str]]:
    written = set()
    readings = set()
    for raw in (item.get("pron"), item.get("entry"), item.get("show_entry")):
        written.update(forms(raw))
    for raw in (item.get("entry"), item.get("show_entry")):
        readings.update(forms(raw))
        readings.add(norm_reading(raw))
    written = {part for part in written if part}
    readings = {part for part in readings if part}
    return written, readings


def load_catalog(path: Path) -> list[dict[str, Any]]:
    payload = load_json(path)
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        raise SystemExit(f"NAVER catalog cache missing: {path}")
    items = []
    for item in payload["items"]:
        written, readings = catalog_forms(item)
        items.append({**item, "_written": written, "_readings": readings})
    return items


def index_catalog(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        keys = set(item["_written"]) | set(item["_readings"])
        for key in keys:
            index[key].append(item)
            index[norm_reading(key)].append(item)
    return index


def choose_catalog(word: dict[str, str], index: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    surface = normalized(word["surface"])
    reading = norm_reading(word["reading_kana"])
    seen: set[str] = set()
    candidates = []
    for key in {surface, reading, to_hira(surface)}:
        for item in index.get(key, []):
            entry_id = item.get("entry_id") or id(item)
            if entry_id in seen:
                continue
            seen.add(entry_id)
            written = item["_written"]
            readings = {norm_reading(value) for value in item["_readings"]}
            surface_match = surface in written or surface in item["_readings"]
            reading_match = reading in readings or reading in written
            if surface_match and reading_match:
                score = 300
                basis = "surface+reading"
            elif surface_match:
                score = 180
                basis = "surface-only"
            elif reading_match and not KANJI_RE.search(surface):
                score = 160
                basis = "kana-reading"
            else:
                continue
            candidates.append((score, item, basis))
    if not candidates:
        return {"status": "naver_level_missing", "item": None, "basis": "", "levels": []}
    candidates.sort(key=lambda row: row[0], reverse=True)
    best_score = candidates[0][0]
    best = [row for row in candidates if row[0] == best_score]
    levels = sorted({row[1]["level"] for row in best})
    item = best[0][1]
    if len(levels) > 1:
        status = "manual_review"
    elif item["level"] == word["level"]:
        status = "match"
    else:
        status = "mismatch"
    return {"status": status, "item": item, "basis": best[0][2], "levels": levels, "score": best_score}


def load_jmdict(path: Path):
    kanji_forms: dict[str, dict[str, list]] = defaultdict(dict)
    all_reb: set[str] = set()
    with gzip.open(path, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            seq = entry.findtext("ent_seq") or ""
            kebs = []
            for node in entry.findall("k_ele"):
                kebs.append((node.findtext("keb") or "", [i.text or "" for i in node.findall("ke_inf")]))
            rebs = []
            for node in entry.findall("r_ele"):
                reb = node.findtext("reb") or ""
                rebs.append(
                    (
                        reb,
                        [i.text or "" for i in node.findall("re_inf")],
                        node.find("re_nokanji") is not None,
                        [x.text or "" for x in node.findall("re_restr")],
                    )
                )
                all_reb.add(reb)
                all_reb.add(norm_reading(reb))
            for keb, kinf in kebs:
                for reb, rinf, nokanji, restr in rebs:
                    if nokanji:
                        continue
                    if restr and keb not in restr:
                        continue
                    kanji_forms[keb].setdefault(reb, []).append((kinf, rinf, seq))
            entry.clear()
    return kanji_forms, all_reb


def jmdict_issue(word: dict[str, str], kanji_forms, all_reb) -> dict[str, str] | None:
    surface = word["surface"]
    reading = norm_reading(word["reading_kana"])
    if not KANJI_RE.search(surface):
        if norm_reading(surface) != reading:
            return {"issue": "kana-surface-reading-mismatch", "detail": "kana surface != reading"}
        if surface in all_reb or to_hira(surface) in all_reb:
            return None
        return {"issue": "kana-not-in-jmdict", "detail": "kana form absent from JMdict readings"}
    entry = kanji_forms.get(surface)
    if entry is None:
        for suf in SUFFIXES:
            if surface.endswith(suf) and len(surface) > len(suf):
                cand = surface[: -len(suf)]
                if cand in kanji_forms:
                    cand_readings = set(kanji_forms[cand])
                    stem_ok = any(reading == norm_reading(raw) + norm_reading(suf) for raw in cand_readings)
                    return {
                        "issue": "derived-form" if stem_ok else "derived-form-reading-mismatch",
                        "detail": f"base={cand} suffix={suf}",
                    }
        return {"issue": "surface-not-in-jmdict", "detail": "no JMdict kanji form matches this surface"}
    readings: dict[str, list] = defaultdict(list)
    for raw, variants in entry.items():
        readings[norm_reading(raw)].extend((raw, variant) for variant in variants)
    if reading not in readings:
        return {"issue": "reading-mismatch", "detail": "jmdict readings=" + ",".join(sorted(readings)[:8])}
    cands = [row for row in readings[reading] if row[0] == word["reading_kana"]] or readings[reading]
    scored = []
    for raw, (kinf, rinf, seq) in cands:
        bad_k = [i for i in kinf if any(mark in i for mark in BAD_KANJI_INF)]
        bad_r = [i for i in rinf if any(mark in i for mark in BAD_KANA_INF)]
        scored.append((len(bad_k) + len(bad_r), bad_k, bad_r, seq))
    scored.sort(key=lambda row: row[0])
    _, bad_k, bad_r, seq = scored[0]
    if bad_k or bad_r:
        return {"issue": "flagged-form", "detail": f"ke_inf={bad_k} re_inf={bad_r} seq={seq}"}
    return None


def example_contains(word: dict[str, str], jp: str) -> tuple[bool, str]:
    text = RUBY_RE.sub(r"\1", jp or "")
    compact = normalized(text)
    surface = normalized(word["surface"])
    reading = norm_reading(word["reading_kana"])
    if surface and surface in compact:
        return True, "surface"
    if reading and reading in compact:
        return True, "reading"
    for raw in json.loads(word["alt_forms"]) if word.get("alt_forms", "").startswith("[") else []:
        if normalized(raw) and normalized(raw) in compact:
            return True, "alt_form"
    stem = surface
    for suf in ("する", "な", "だ", "い", "る"):
        if stem.endswith(suf) and len(stem) > len(suf):
            stem = stem[: -len(suf)]
            break
    if len(stem) >= 2 and stem in compact:
        return True, "stem"
    return False, "missing"


def ko_tokens(value: str) -> set[str]:
    return {part for part in KO_SPLIT_RE.split(value or "") if len(part) >= 2}


def meaning_overlap(app_meaning: str, naver_means: list[str]) -> bool:
    left = ko_tokens(app_meaning)
    right = set()
    for mean in naver_means:
        right.update(ko_tokens(mean))
    return bool(left and right and left & right)


def audio_present(word_id: str) -> dict[str, bool]:
    words = ROOT / "assets/audio/words"
    examples = ROOT / "assets/audio/examples"
    return {
        "word_mp3": (words / f"{word_id}.mp3").is_file() and (words / f"{word_id}.mp3").stat().st_size > 0,
        "word_ogg": (words / f"{word_id}.ogg").is_file() and (words / f"{word_id}.ogg").stat().st_size > 0,
        "example_mp3": (examples / f"{word_id}.mp3").is_file() and (examples / f"{word_id}.mp3").stat().st_size > 0,
        "example_ogg": (examples / f"{word_id}.ogg").is_file() and (examples / f"{word_id}.ogg").stat().st_size > 0,
    }


def classify_severity(issues: list[str]) -> str:
    if any(flag in FAIL_ISSUES for flag in issues):
        return "fail"
    if issues:
        return "queue"
    return "ok"


def load_accepted_ids(path: Path) -> dict[str, dict[str, str]]:
    payload = load_json(path)
    if not isinstance(payload, dict):
        return {}
    accepted: dict[str, dict[str, str]] = {}
    for item in payload.get("accepted") or []:
        word_id = str(item.get("id") or "")
        if word_id:
            accepted[word_id] = {
                "queue": str(item.get("queue") or ""),
                "reason": str(item.get("reason") or ""),
            }
    return accepted


def queue_bucket(row: dict[str, Any]) -> str:
    issues = set(row.get("issues") or [])
    surface = str(row.get("surface") or "")
    if any(flag in FAIL_ISSUES for flag in issues):
        return ""
    if "level-ambiguous" in issues:
        return "homograph"
    if "level-mismatch" in issues:
        return "catalog-mismatch-unconfirmed"
    suru = surface.endswith("する")
    counter = bool(COUNTER_RE.search(surface))
    if "naver-search-unmatched" in issues or "naver-level-missing" in issues:
        if suru:
            return "suru-compound"
        if counter:
            return "counter"
        if row.get("search_status") == "match":
            return "catalog-absent-search-match"
        if row.get("search_status") == "search_no_jlpt":
            return "no-jlpt-badge"
        if "naver-search-unmatched" in issues:
            return "search-unmatched"
        return "catalog-absent"
    if any(flag.startswith("spelling-") for flag in issues):
        return "spelling"
    if "catalog-mismatch-search-match" in issues:
        return "catalog-stale"
    return "other"


def choose_search(word: dict[str, str], cached: dict[str, Any]) -> dict[str, Any]:
    if not cached.get("ok"):
        return {"status": "fetch_error", "item": None, "basis": "", "levels": [], "note": cached.get("error", "")}
    surface = normalized(word["surface"])
    reading = norm_reading(word["reading_kana"])
    candidates = []
    for item in cached.get("items") or []:
        written = forms(item.get("kanji")) | forms(item.get("entry")) | forms(item.get("handle_entry"))
        readings = {
            norm_reading(item.get("handle_entry")),
            norm_reading(item.get("entry")),
            norm_reading(item.get("audio_read")),
            norm_reading(item.get("meaning_read")),
        }
        surface_match = surface in written
        reading_match = reading in readings or reading in written
        exact = str(item.get("match_type", "")).startswith("exact:")
        if surface_match and reading_match:
            score, basis = 300, "surface+reading"
        elif exact and reading_match:
            score, basis = 250, "exact-search+reading"
        elif surface == reading and surface_match:
            score, basis = 220, "kana-surface"
        else:
            continue
        try:
            rank = int(item.get("rank") or 9999)
        except ValueError:
            rank = 9999
        candidates.append((score, -rank, item, basis))
    if not candidates:
        return {
            "status": "search_unmatched",
            "item": None,
            "basis": "",
            "levels": [],
            "note": "search returned no form+reading match",
        }
    candidates.sort(reverse=True)
    best_score = candidates[0][0]
    best = [row for row in candidates if row[0] == best_score]
    item = best[0][2]
    tag = re.search(r"JLPT\s+([1-5])", str(item.get("frequency_add") or ""))
    level = f"N{tag.group(1)}" if tag else ""
    levels = sorted({
        f"N{match.group(1)}"
        for row in best
        for match in [re.search(r"JLPT\s+([1-5])", str(row[2].get("frequency_add") or ""))]
        if match
    })
    if not level:
        status = "search_no_jlpt"
    elif len(levels) > 1:
        status = "manual_review"
    elif level == word["level"]:
        status = "match"
    else:
        status = "mismatch"
    return {"status": status, "item": item, "basis": best[0][3], "levels": levels, "naver_level": level}


def main() -> None:
    args = parse_args()
    words = [row for row in read_csv(args.words) if str(row.get("deprecated", "0")).strip() != "1"]
    naver_examples = {row["word_id"]: row for row in read_csv(args.naver_examples)}
    self_examples = {row["word_id"]: row for row in read_csv(args.self_examples)}
    catalog_items = load_catalog(args.catalog)
    catalog_index = index_catalog(catalog_items)
    print(f"words={len(words)} catalog={len(catalog_items)}", flush=True)
    print("loading JMdict…", flush=True)
    kanji_forms, all_reb = load_jmdict(args.jmdict)

    db_rows = {}
    if args.db.exists():
        with sqlite3.connect(args.db) as conn:
            conn.row_factory = sqlite3.Row
            for row in conn.execute(
                "SELECT id, level, surface, reading_kana, meaning_ko, example_jp, example_ko FROM word WHERE deprecated=0"
            ):
                db_rows[row["id"]] = dict(row)

    ios_map = map_ids(ROOT / "src/lib/audio/audioMap.gen.ts", "word") | map_ids(
        ROOT / "src/lib/audio/audioMap.gen.ts", "example"
    )
    # split maps properly
    ios_word = map_ids(ROOT / "src/lib/audio/audioMap.gen.ts", "word")
    ios_example = set(ID_RE.findall(
        re.search(r"EXAMPLE_AUDIO: Record<string, number> = \{(.*?)\n\};",
                  (ROOT / "src/lib/audio/audioMap.gen.ts").read_text(encoding="utf-8"), re.S).group(1)
    ))
    and_word = set(ID_RE.findall(
        re.search(r"WORD_AUDIO: Record<string, number> = \{(.*?)\n\};",
                  (ROOT / "src/lib/audio/audioMap.gen.android.ts").read_text(encoding="utf-8"), re.S).group(1)
    ))
    and_example = set(ID_RE.findall(
        re.search(r"EXAMPLE_AUDIO: Record<string, number> = \{(.*?)\n\};",
                  (ROOT / "src/lib/audio/audioMap.gen.android.ts").read_text(encoding="utf-8"), re.S).group(1)
    ))

    rows = []
    live_needed = []
    for word in words:
        catalog = choose_catalog(word, catalog_index)
        jm = jmdict_issue(word, kanji_forms, all_reb)
        example_row = naver_examples.get(word["id"]) or self_examples.get(word["id"])
        example_source = "naver" if word["id"] in naver_examples else "self" if word["id"] in self_examples else "missing"
        jp = word.get("example_jp") or (example_row or {}).get("jp", "")
        ko = word.get("example_ko") or (example_row or {}).get("ko", "")
        contains, contain_basis = example_contains(word, jp)
        audio = audio_present(word["id"])
        db = db_rows.get(word["id"])
        db_mismatch = []
        if db:
            for field in ("level", "surface", "reading_kana", "meaning_ko", "example_jp", "example_ko"):
                if (db.get(field) or "") != (word.get(field) or ""):
                    db_mismatch.append(field)
        elif db_rows:
            db_mismatch.append("missing-from-db")

        naver_item = catalog.get("item") or {}
        naver_means = list(naver_item.get("means") or [])
        meaning_ok = meaning_overlap(word.get("meaning_ko", ""), naver_means) if naver_means else None
        spelling_ok = True
        spelling_note = ""
        if naver_item:
            written = naver_item.get("_written", set())
            if normalized(word["surface"]) not in written and norm_reading(word["surface"]) not in {
                norm_reading(value) for value in written
            }:
                spelling_ok = False
                spelling_note = "app surface not in NAVER catalog written forms"
        issues = []
        if catalog["status"] == "mismatch":
            issues.append("level-mismatch")
        elif catalog["status"] == "manual_review":
            issues.append("level-ambiguous")
        elif catalog["status"] == "naver_level_missing":
            issues.append("naver-level-missing")
        if not spelling_ok:
            issues.append("spelling-vs-naver")
        if jm and jm["issue"] in {
            "reading-mismatch",
            "surface-not-in-jmdict",
            "kana-surface-reading-mismatch",
            "derived-form-reading-mismatch",
            "flagged-form",
        }:
            issues.append(f"spelling-{jm['issue']}")
        elif jm and jm["issue"] == "kana-not-in-jmdict":
            issues.append("spelling-kana-not-in-jmdict")
        if not jp or not ko:
            issues.append("example-missing")
        elif not contains:
            issues.append("example-headword-missing")
        if example_source == "missing":
            issues.append("example-source-missing")
        if example_source == "naver" and example_row and example_row.get("permission_status") != "cleared":
            issues.append("example-not-cleared")
        if db_mismatch:
            issues.append("db-mismatch")
        if not audio["word_mp3"] or not audio["word_ogg"]:
            issues.append("tts-word-missing")
        if not audio["example_mp3"] or not audio["example_ogg"]:
            issues.append("tts-example-missing")
        if word["id"] not in ios_word or word["id"] not in and_word:
            issues.append("tts-word-map-missing")
        if word["id"] not in ios_example or word["id"] not in and_example:
            issues.append("tts-example-map-missing")

        record = {
            "id": word["id"],
            "level": word["level"],
            "surface": word["surface"],
            "reading_kana": word["reading_kana"],
            "meaning_ko": word["meaning_ko"],
            "example_jp": jp,
            "example_ko": ko,
            "example_source": example_source,
            "catalog_status": catalog["status"],
            "catalog_level": (naver_item or {}).get("level", ""),
            "catalog_entry": (naver_item or {}).get("entry", ""),
            "catalog_pron": (naver_item or {}).get("pron", ""),
            "catalog_basis": catalog.get("basis", ""),
            "catalog_levels": "|".join(catalog.get("levels") or []),
            "spelling_ok": spelling_ok,
            "spelling_note": spelling_note,
            "jmdict_issue": (jm or {}).get("issue", ""),
            "jmdict_detail": (jm or {}).get("detail", ""),
            "example_contains": contains,
            "example_contain_basis": contain_basis,
            "meaning_overlap": meaning_ok,
            "naver_means": ";".join(naver_means[:4]),
            "db_mismatch": ",".join(db_mismatch),
            "issues": issues,
            "source_url": SEARCH_URL + urllib.parse.quote(word["surface"], safe=""),
        }
        rows.append(record)
        if catalog["status"] in {"mismatch", "manual_review", "naver_level_missing"} or not spelling_ok:
            live_needed.append(record)

    print(
        "catalog "
        + json.dumps(Counter(row["catalog_status"] for row in rows), ensure_ascii=False),
        flush=True,
    )

    search_cache = load_json(args.search_cache) if args.search_cache.exists() else {}
    if not isinstance(search_cache, dict):
        search_cache = {}
    pending = []
    if not args.skip_live:
        for record in live_needed:
            query = record["surface"]
            if query not in search_cache:
                pending.append(query)
        pending = list(dict.fromkeys(pending))
        if args.live_limit:
            pending = pending[: args.live_limit]
        print(f"live search pending={len(pending)} cached={len(search_cache)} targets={len(live_needed)}", flush=True)
        started = time.monotonic()

        def worker(query: str) -> tuple[str, dict[str, Any]]:
            result = fetch_query(query, args.timeout, args.retries)
            time.sleep(max(0, args.delay_ms) / 1000)
            return query, result

        completed = 0
        if pending:
            with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
                futures = [pool.submit(worker, query) for query in pending]
                for future in as_completed(futures):
                    query, result = future.result()
                    search_cache[query] = result
                    completed += 1
                    if completed % 25 == 0 or completed == len(pending):
                        atomic_json(args.search_cache, search_cache)
                    if completed % 50 == 0 or completed == len(pending):
                        elapsed = max(0.001, time.monotonic() - started)
                        print(f"live {completed}/{len(pending)} ({completed/elapsed:.1f}/s)", flush=True)

    live_counts: Counter[str] = Counter()
    confirmed_mismatch = []
    for record in rows:
        cached = search_cache.get(record["surface"])
        if not cached:
            record["search_status"] = ""
            record["search_level"] = ""
            record["search_entry"] = ""
            continue
        word = next(row for row in words if row["id"] == record["id"])
        chosen = choose_search(word, cached)
        item = chosen.get("item") or {}
        record["search_status"] = chosen["status"]
        record["search_level"] = chosen.get("naver_level", "")
        record["search_entry"] = item.get("kanji") or item.get("entry") or ""
        record["search_reading"] = item.get("handle_entry") or item.get("entry") or ""
        record["search_basis"] = chosen.get("basis", "")
        live_counts[chosen["status"]] += 1
        if chosen["status"] == "mismatch":
            confirmed_mismatch.append(record)
            if "level-mismatch-confirmed" not in record["issues"]:
                record["issues"].append("level-mismatch-confirmed")
        elif chosen["status"] == "match" and "level-mismatch" in record["issues"]:
            record["issues"].append("catalog-mismatch-search-match")
        elif chosen["status"] == "search_unmatched":
            record["issues"].append("naver-search-unmatched")

    accepted_by_id = load_accepted_ids(args.accepted)
    for record in rows:
        record["severity"] = classify_severity(record["issues"])
        record["queue"] = queue_bucket(record)
        record["accepted_reason"] = ""
        accepted = accepted_by_id.get(record["id"])
        if (
            record["severity"] == "queue"
            and accepted
            and record["queue"] in ACCEPTED_QUEUE_BUCKETS
        ):
            record["severity"] = "accepted"
            record["accepted_reason"] = accepted.get("reason") or accepted.get("queue") or "accepted"

    fail_rows = [row for row in rows if row["severity"] == "fail"]
    queue_rows = [row for row in rows if row["severity"] == "queue"]
    accepted_rows = [row for row in rows if row["severity"] == "accepted"]
    flag_rows = fail_rows + queue_rows
    summary = {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "word_count": len(words),
        "source": str(args.words),
        "source_sha256": hashlib.sha256(args.words.read_bytes()).hexdigest(),
        "catalog_fetched_at": (load_json(args.catalog) or {}).get("fetched_at"),
        "passed": len(fail_rows) == 0,
        "failure_count": len(fail_rows),
        "queue_count": len(queue_rows),
        "accepted_count": len(accepted_rows),
        "accepted_manifest": str(args.accepted) if args.accepted.exists() else "",
        "catalog_status": dict(Counter(row["catalog_status"] for row in rows)),
        "search_status": dict(live_counts),
        "jmdict_issues": dict(Counter(row["jmdict_issue"] for row in rows if row["jmdict_issue"])),
        "example_sources": dict(Counter(row["example_source"] for row in rows)),
        "example_containment": dict(Counter(row["example_contain_basis"] for row in rows)),
        "issue_counts": dict(Counter(issue for row in rows for issue in row["issues"])),
        "failure_issue_counts": dict(Counter(
            issue for row in fail_rows for issue in row["issues"] if issue in FAIL_ISSUES
        )),
        "queue_counts": dict(Counter(row["queue"] for row in queue_rows)),
        "accepted_counts": dict(Counter(row["queue"] for row in accepted_rows)),
        "rows_with_issues": len(flag_rows),
        "rows_accepted": len(accepted_rows),
        "audio_map": {
            "ios_word": len(ios_word),
            "ios_example": len(ios_example),
            "android_word": len(and_word),
            "android_example": len(and_example),
        },
        "method": (
            "Every active word is compared to NAVER Japanese Dictionary's displayed JLPT catalog "
            "by written form + reading. NAVER is the app's reference data; this is not represented "
            "as an official JLPT vocabulary list. "
            "Unmatched/ambiguous/mismatched rows are live-searched in NAVER Japanese Dictionary. "
            "Fail only on confirmed level mismatch, missing/broken example, missing TTS, or DB mismatch. "
            "Catalog-absent する-forms, counters, homographs, unconfirmed catalog mismatches, "
            "and JMdict derived-form flags are a review queue, not a release failure. "
            "Accepted queue IDs in naver_audit_accepted_queue.json stay out of the open queue "
            "unless they become a release failure or move into a human-review bucket."
        ),
    }
    atomic_json(
        args.report,
        {
            **summary,
            "confirmed_mismatches": [
                {
                    "id": row["id"],
                    "surface": row["surface"],
                    "reading_kana": row["reading_kana"],
                    "app_level": row["level"],
                    "catalog_level": row["catalog_level"],
                    "search_level": row.get("search_level", ""),
                    "source_url": row["source_url"],
                }
                for row in confirmed_mismatch
            ],
            "failure_preview": [
                {
                    "id": row["id"],
                    "surface": row["surface"],
                    "reading_kana": row["reading_kana"],
                    "level": row["level"],
                    "issues": row["issues"],
                    "source_url": row["source_url"],
                }
                for row in fail_rows[:200]
            ],
            "queue_preview": [
                {
                    "id": row["id"],
                    "surface": row["surface"],
                    "reading_kana": row["reading_kana"],
                    "level": row["level"],
                    "queue": row["queue"],
                    "issues": row["issues"],
                    "catalog_status": row["catalog_status"],
                    "search_status": row.get("search_status", ""),
                    "source_url": row["source_url"],
                }
                for row in queue_rows[:200]
            ],
        },
    )
    fieldnames = [
        "id",
        "level",
        "surface",
        "reading_kana",
        "meaning_ko",
        "severity",
        "queue",
        "accepted_reason",
        "issues",
        "catalog_status",
        "catalog_level",
        "catalog_pron",
        "catalog_entry",
        "search_status",
        "search_level",
        "search_entry",
        "jmdict_issue",
        "jmdict_detail",
        "example_source",
        "example_contain_basis",
        "example_jp",
        "spelling_note",
        "naver_means",
        "source_url",
    ]

    def write_flag_csv(path: Path, records: list[dict[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for row in records:
                writer.writerow({**row, "issues": ";".join(row["issues"])})

    write_flag_csv(args.issues, flag_rows + accepted_rows)
    write_flag_csv(args.failures, fail_rows)
    write_flag_csv(args.queue, queue_rows)
    write_flag_csv(args.accepted_out, accepted_rows)
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    if fail_rows:
        sys.exit(1)


if __name__ == "__main__":
    main()
