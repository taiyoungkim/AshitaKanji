#!/usr/bin/env python3
"""Recheck every shipped dictionary headword against JMdict.

Reads assets/jlpt.db `word` rows and compares (surface, reading_kana) with
JMdict_e.  Reports orthography / reading problems, one row per finding.
"""

from __future__ import annotations

import gzip
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JMDICT = ROOT / ".cache/JMdict_e.gz"
DB = ROOT / "assets/jlpt.db"
OUT = ROOT / "data/pdf-vocab/jmdict_headword_recheck.json"

KANJI_RE = re.compile(r"[一-龯々〆ヶ]")
BAD_KANJI_INF = ("rarely", "irregular", "outdated", "search-only")
BAD_KANA_INF = ("irregular", "outdated", "search-only", "old ")

KATA2HIRA = {chr(c): chr(c - 0x60) for c in range(0x30A1, 0x30F7)}


def to_hira(value: str) -> str:
    return "".join(KATA2HIRA.get(ch, ch) for ch in value)


def norm_reading(value: str) -> str:
    return to_hira(value.replace("・", "").replace(" ", "").replace("　", ""))


def load_jmdict():
    # keb -> {reb -> (keb_inf, reb_inf, ent_seq)}
    kanji_forms: dict[str, dict[str, list]] = defaultdict(dict)
    kana_only: dict[str, list] = defaultdict(list)  # reb -> [(ent_seq, has_kanji, inf)]
    all_reb: set[str] = set()
    with gzip.open(JMDICT, "rb") as stream:
        for _, entry in ET.iterparse(stream, events=("end",)):
            if entry.tag != "entry":
                continue
            seq = entry.findtext("ent_seq") or ""
            kebs = []
            for k in entry.findall("k_ele"):
                keb = k.findtext("keb") or ""
                inf = [i.text or "" for i in k.findall("ke_inf")]
                kebs.append((keb, inf))
            rebs = []
            for r in entry.findall("r_ele"):
                reb = r.findtext("reb") or ""
                inf = [i.text or "" for i in r.findall("re_inf")]
                nokanji = r.find("re_nokanji") is not None
                restr = [x.text or "" for x in r.findall("re_restr")]
                rebs.append((reb, inf, nokanji, restr))
                all_reb.add(reb)
            for keb, kinf in kebs:
                for reb, rinf, nokanji, restr in rebs:
                    if nokanji:
                        continue
                    if restr and keb not in restr:
                        continue
                    kanji_forms[keb].setdefault(reb, []).append((kinf, rinf, seq))
            for reb, rinf, _nokanji, _restr in rebs:
                kana_only[reb].append((seq, bool(kebs), rinf))
            entry.clear()
    return kanji_forms, kana_only, all_reb


SUFFIXES = [
    "する", "した", "して", "します",
    "に", "と", "な", "の", "だ", "です", "ます", "い", "く", "り", "を", "が", "は",
]


def main() -> None:
    kanji_forms, kana_only, all_reb = load_jmdict()

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "select id, level, surface, reading_kana, meaning_ko, part_of_speech,"
        " alt_forms, example_jp, source, qa_status from word where deprecated=0"
        " order by level, id"
    ).fetchall()

    findings = []
    stats = defaultdict(int)

    for row in rows:
        surface = row["surface"]
        reading = norm_reading(row["reading_kana"])
        has_kanji = bool(KANJI_RE.search(surface))
        rec = {
            "id": row["id"],
            "level": row["level"],
            "surface": surface,
            "reading_kana": row["reading_kana"],
            "meaning_ko": row["meaning_ko"],
            "pos": row["part_of_speech"],
            "example_jp": row["example_jp"],
        }

        if not has_kanji:
            # kana headword: surface should equal reading and exist as a JMdict reading
            if norm_reading(surface) != reading:
                stats["kana-surface-reading-mismatch"] += 1
                findings.append({**rec, "issue": "kana-surface-reading-mismatch",
                                 "detail": "surface != reading for kana-only headword"})
                continue
            if surface in all_reb or to_hira(surface) in all_reb:
                stats["ok-kana"] += 1
                continue
            stats["kana-not-in-jmdict"] += 1
            findings.append({**rec, "issue": "kana-not-in-jmdict",
                             "detail": "kana form absent from JMdict readings"})
            continue

        entry = kanji_forms.get(surface)
        if entry is None:
            # try stripping a trailing grammatical suffix
            base = None
            for suf in SUFFIXES:
                if surface.endswith(suf) and len(surface) > len(suf):
                    cand = surface[: -len(suf)]
                    if cand in kanji_forms:
                        base = (cand, suf)
                        break
            if base:
                cand, suf = base
                cand_readings = set(kanji_forms[cand])
                stem_ok = any(reading == norm_reading(r) + norm_reading(suf) for r in cand_readings)
                stats["derived-form" if stem_ok else "derived-form-reading-mismatch"] += 1
                findings.append({**rec,
                                 "issue": "derived-form" if stem_ok else "derived-form-reading-mismatch",
                                 "detail": f"base={cand} suffix={suf} base_readings={sorted(cand_readings)[:6]}"})
            else:
                stats["surface-not-in-jmdict"] += 1
                findings.append({**rec, "issue": "surface-not-in-jmdict",
                                 "detail": "no JMdict kanji form matches this surface"})
            continue

        raw_reading = row["reading_kana"]
        readings: dict[str, list] = defaultdict(list)
        for r, variants in entry.items():
            for v in variants:
                readings[norm_reading(r)].append((r, v))
        if reading in readings:
            # exact (unnormalised) match wins; otherwise keep every variant
            cands = [c for c in readings[reading] if c[0] == raw_reading] or readings[reading]
            scored = []
            for raw, (kinf, rinf, seq) in cands:
                bad_k = [i for i in kinf if any(m in i for m in BAD_KANJI_INF)]
                bad_r = [i for i in rinf if any(m in i for m in BAD_KANA_INF)]
                scored.append((len(bad_k) + len(bad_r), bad_k, bad_r, seq))
            scored.sort(key=lambda x: x[0])
            _, bad_k, bad_r, seq = scored[0]
            if bad_k or bad_r:
                stats["flagged-form"] += 1
                findings.append({**rec, "issue": "flagged-form",
                                 "detail": f"ke_inf={bad_k} re_inf={bad_r} seq={seq}"})
            else:
                stats["ok"] += 1
            continue

        stats["reading-mismatch"] += 1
        findings.append({**rec, "issue": "reading-mismatch",
                         "detail": "jmdict readings=" + ",".join(sorted(readings)[:8])})

    OUT.write_text(json.dumps({"stats": dict(stats), "findings": findings},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(dict(stats), ensure_ascii=False, indent=1))
    print("total rows", len(rows), "findings", len(findings))


if __name__ == "__main__":
    main()
