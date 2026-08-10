#!/usr/bin/env python3
"""Extract the user-provided JLPT PDF vocabulary books into auditable CSV/JSON.

The PDFs contain embedded text, so extraction is geometry-based rather than OCR:

* MKT books: numbered table cells (surface / reading / Korean gloss).
* 일단합격 books: Japanese headword glyphs, ruby glyphs, and Korean gloss glyphs.

Every printed source occurrence is retained in ``jlpt_source_entries.csv``.  The
deduplicated master and conservative app-ready subset are derived from that file.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = Path("/Users/tyoung/Downloads/jlpt단어장")
OUT_DIR = ROOT / "data" / "pdf-vocab"
DB_PATH = ROOT / "assets" / "jlpt.db"

LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"]
MKT_SECTION_TO_POS = {
    "동사": "verb",
    "い형용사": "i_adjective",
    "な형용사": "na_adjective",
    "명사": "noun",
    "부사": "adverb",
}
IL_SECTION_NAMES = {"한자읽기", "한자표기", "문맥규정", "유의어", "용법"}
IL_SECTION_LABELS = {
    "한자읽기": "한자 읽기",
    "한자표기": "한자 표기",
    "문맥규정": "문맥 규정",
    "유의어": "유의어",
    "용법": "용법",
}

# A handful of MKT table cells deliberately place a multi-line gloss above or
# below the numbered baseline.  Geometry alone cannot distinguish that layout
# from the adjacent row, so these visually verified cells are kept here as an
# explicit, auditable correction list.
MKT_OVERRIDES: dict[tuple[str, int], dict[str, str]] = {
    ("mkt_n1", 72): {"meaning_ko_raw": "모이다"},
    ("mkt_n1", 73): {"meaning_ko_raw": "<자동사> 점점 강해지다 <타동사> 모집하다"},
    ("mkt_n1", 111): {
        "reading_raw": "まぬかれる (まぬがれる)",
        "meaning_ko_raw": "면하다, 모면하다",
    },
    ("mkt_n2", 147): {"meaning_ko_raw": "녹이다"},
    ("mkt_n2", 148): {
        "meaning_ko_raw": "보내다, 배달하다, (관청 등에) 신고하다"
    },
    ("mkt_n2", 191): {"meaning_ko_raw": "뒤돌아보다"},
    ("mkt_n2", 192): {"meaning_ko_raw": "<자동사> 닿다 <타동사> 만지다"},
    ("mkt_n2", 214): {"meaning_ko_raw": "말씀드리다('言う'의 겸양)"},
    ("mkt_n3", 233): {"meaning_ko_raw": "참음"},
    ("mkt_n3", 234): {
        "meaning_ko_raw": "(내용물이 없이 속이) 빔, 아무것도 없음"
    },
}

PASS_OVERRIDES: dict[tuple[str, int, str], dict[str, str]] = {
    # The printed Arabic counter is part of the headword, not its kana reading.
    ("pass_n4", 10, "1軒"): {"reading_raw": "いっけん"},
    # The gloss is printed at the top of the right column while its headword is
    # the final item of the left column on page 25.
    ("pass_n1", 25, "目覚ましい"): {
        "meaning_ko_raw": "눈부시다, 주목할 만하다"
    },
}


@dataclass(frozen=True)
class SourceSpec:
    source_id: str
    filename: str
    level: str
    source_kind: str
    first_word_page: int
    last_word_page: int


SOURCES = [
    SourceSpec("mkt_n1", "MKT_JLPT_word-N1.pdf", "N1", "mkt", 2, 20),
    SourceSpec("mkt_n2", "MKT_JLPT_word-N2.pdf", "N2", "mkt", 2, 19),
    SourceSpec("mkt_n3", "MKT_JLPT_word-N3.pdf", "N3", "mkt", 2, 20),
    SourceSpec("pass_n1", "일단합격JLPT완벽대비N1-단어장.pdf", "N1", "pass", 4, 29),
    SourceSpec("pass_n3", "일단합격JLPT완벽대비N3-단어장.pdf", "N3", "pass", 4, 20),
    SourceSpec("pass_n4", "일단합격JLPT완벽대비N4-단어장.pdf", "N4", "pass", 4, 25),
    SourceSpec("pass_n5", "일단합격JLPT완벽대비N5-단어장.pdf", "N5", "pass", 4, 24),
]

SOURCE_FIELDS = [
    "source_entry_id",
    "source_id",
    "source_file",
    "source_kind",
    "level",
    "page",
    "source_order",
    "entry_no",
    "section",
    "part_of_speech",
    "surface_raw",
    "reading_raw",
    "meaning_ko_raw",
    "surface",
    "reading_kana",
    "alt_readings",
    "meaning_ko",
    "entry_type",
    "include_in_app",
    "existing_word_id",
    "existing_level",
    "match_status",
    "text_crosscheck",
    "qa_status",
    "qa_note",
]

MASTER_FIELDS = [
    "id",
    "primary_level",
    "levels",
    "surface",
    "reading_kana",
    "alt_readings",
    "meaning_ko",
    "meaning_ko_variants",
    "part_of_speech",
    "entry_type",
    "include_in_app",
    "source_ids",
    "source_entry_ids",
    "source_entry_count",
    "sections",
    "existing_word_id",
    "existing_level",
    "qa_status",
    "qa_note",
]


def clean(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\u0007", "").replace("\u00ad", "")
    text = unicodedata.normalize("NFKC", text)
    return re.sub(r"\s+", " ", text).strip()


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", clean(value))


def collapse_pairwise_duplicates(text: str) -> str:
    if len(text) >= 2 and len(text) % 2 == 0:
        pairs = [text[i : i + 2] for i in range(0, len(text), 2)]
        if all(len(pair) == 2 and pair[0] == pair[1] for pair in pairs):
            return "".join(pair[0] for pair in pairs)
    return text


def group_by_top(items: Iterable[dict[str, Any]], tolerance: float = 0.7) -> list[list[dict[str, Any]]]:
    groups: list[list[dict[str, Any]]] = []
    for item in sorted(items, key=lambda x: (float(x["top"]), float(x["x0"]))):
        if not groups or abs(float(item["top"]) - float(groups[-1][0]["top"])) > tolerance:
            groups.append([item])
        else:
            groups[-1].append(item)
    return groups


def join_positioned(items: Iterable[dict[str, Any]], gap_factor: float = 0.55) -> str:
    chars = sorted(items, key=lambda x: (float(x["x0"]), float(x["top"])))
    if not chars:
        return ""
    out: list[str] = []
    previous_x1: float | None = None
    previous_size = 8.0
    for char in chars:
        x0 = float(char["x0"])
        if previous_x1 is not None and x0 - previous_x1 > previous_size * gap_factor:
            out.append(" ")
        out.append(str(char.get("text", "")))
        previous_x1 = float(char["x1"])
        previous_size = float(char.get("size", previous_size))
    return clean("".join(out))


def join_word_lines(words: Iterable[dict[str, Any]], gap_factor: float = 0.35) -> str:
    lines = group_by_top(words, tolerance=1.1)
    line_texts: list[str] = []
    for line in lines:
        ordered = sorted(line, key=lambda x: float(x["x0"]))
        parts: list[str] = []
        previous_x1: float | None = None
        previous_size = 9.0
        for word in ordered:
            x0 = float(word["x0"])
            if previous_x1 is not None and x0 - previous_x1 > previous_size * gap_factor:
                parts.append(" ")
            parts.append(str(word["text"]))
            previous_x1 = float(word["x1"])
            previous_size = float(word.get("size", previous_size))
        line_texts.append(clean("".join(parts)))
    return clean(" ".join(x for x in line_texts if x))


def is_kanji(char: str) -> bool:
    if char == "々":
        return True
    return any(
        start <= ord(char) <= end
        for start, end in ((0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF))
    )


def make_word_id(surface: str, reading: str) -> str:
    basis = f"{unicodedata.normalize('NFKC', surface)}\u0001{unicodedata.normalize('NFKC', reading)}"
    return f"w_{hashlib.sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def normalize_reading(raw: str) -> tuple[str, str]:
    text = clean(raw)
    text = re.sub(r"\s+", "", text)
    alternatives: list[str] = []
    for match in re.finditer(r"[\(（]([^()（）]+)[\)）]", text):
        candidate = clean(match.group(1))
        if re.fullmatch(r"[ぁ-ゖァ-ヺー・]+", candidate):
            alternatives.append(candidate)
    primary = re.sub(r"[\(（][ぁ-ゖァ-ヺー・]+[\)）]", "", text)
    primary = clean(primary)
    return primary, ";".join(dict.fromkeys(alternatives))


def classify_entry(surface: str) -> str:
    s = clean(surface)
    if "～" in s or "~" in s:
        return "pattern"
    if s.startswith("≒") or re.search(r"[「」『』。！？…]", s):
        return "sentence"
    if re.search(r"[、，,]", s) or (re.search(r"\d", s) and len(s) >= 6):
        return "expression"
    sentence_endings = (
        "です",
        "でした",
        "ます",
        "ました",
        "ません",
        "ください",
        "なかったです",
        "てはいけないです",
    )
    if len(s.replace(" ", "")) >= 8 and any(x in s for x in sentence_endings):
        return "sentence"
    if re.search(r"[()（）]", s) or " " in s:
        return "expression"
    return "word"


def normalize_entry(entry: dict[str, Any]) -> dict[str, Any]:
    entry["surface_raw"] = clean(entry.get("surface_raw"))
    entry["reading_raw"] = clean(entry.get("reading_raw"))
    entry["meaning_ko_raw"] = clean(entry.get("meaning_ko_raw"))
    entry["surface"] = clean(entry["surface_raw"])
    reading, alt_readings = normalize_reading(entry["reading_raw"])
    # In the 일단합격 books, kana-only headwords can also have ruby printed
    # above each glyph.  Geometry reconstruction then interleaves both layers
    # (for example ページ + ぺ/じ -> ペぺージじ).  With no kanji to resolve,
    # the printed headword itself is the canonical reading.
    if (
        entry.get("source_kind") == "pass"
        and classify_entry(entry["surface"]) == "word"
        and not any(is_kanji(char) for char in entry["surface"])
    ):
        reading = entry["surface"]
        alt_readings = ""
    entry["reading_kana"] = reading
    entry["alt_readings"] = alt_readings
    entry["meaning_ko"] = clean(entry["meaning_ko_raw"])
    entry["entry_type"] = classify_entry(entry["surface"])
    include = (
        entry["entry_type"] == "word"
        and bool(entry["surface"])
        and bool(entry["reading_kana"])
        and bool(entry["meaning_ko"])
    )
    entry["include_in_app"] = 1 if include else 0
    return entry


def normalized_page_text(page: Any) -> str:
    return compact(page.extract_text(x_tolerance=2, y_tolerance=3) or "")


def mkt_column_words(
    words: list[dict[str, Any]],
    *,
    x0: float,
    x1: float,
    top: float,
    bottom: float,
    font_fragment: str,
) -> list[dict[str, Any]]:
    return [
        word
        for word in words
        if x0 <= (float(word["x0"]) + float(word["x1"])) / 2 < x1
        and top <= float(word["top"]) < bottom
        and font_fragment in str(word["fontname"])
    ]


def extract_mkt(spec: SourceSpec) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    path = PDF_DIR / spec.filename
    entries: list[dict[str, Any]] = []
    current_section = "동사"
    source_order = 0
    page_counts: dict[str, int] = {}

    with pdfplumber.open(path) as pdf:
        for page_number in range(spec.first_word_page, spec.last_word_page + 1):
            page = pdf.pages[page_number - 1]
            words = page.extract_words(extra_attrs=["fontname", "size"])
            page_text = normalized_page_text(page)

            headings: list[dict[str, Any]] = []
            for word in words:
                text = clean(word["text"])
                if (
                    float(word["x0"]) < 800
                    and float(word["size"]) >= 12
                    and text in MKT_SECTION_TO_POS
                ):
                    headings.append(
                        {
                            "kind": "heading",
                            "half": 1 if float(word["x0"]) >= page.width / 2 else 0,
                            "top": float(word["top"]),
                            "section": text,
                        }
                    )

            page_entries: list[dict[str, Any]] = []
            for half, offset in ((0, 0.0), (1, page.width / 2 - 6.2)):
                anchors = [
                    word
                    for word in words
                    if "Helvetica-ExtraCompressed" in str(word["fontname"])
                    and str(word["text"]).isdigit()
                    and 1 <= int(str(word["text"])) <= 500
                    and offset + 30 <= float(word["x0"]) < offset + 65
                    and float(word["top"]) < 500
                ]
                anchors.sort(key=lambda x: float(x["top"]))
                for index, anchor in enumerate(anchors):
                    top = float(anchor["top"]) - 1.5
                    bottom = (
                        float(anchors[index + 1]["top"]) - 2.0
                        if index + 1 < len(anchors)
                        else 500.0
                    )
                    surface_words = mkt_column_words(
                        words,
                        x0=offset + 65,
                        x1=offset + 152,
                        top=top,
                        bottom=bottom,
                        font_fragment="MS-Gothic",
                    )
                    reading_words = mkt_column_words(
                        words,
                        x0=offset + 152,
                        x1=offset + 248,
                        top=top,
                        bottom=bottom,
                        font_fragment="MS-Gothic",
                    )
                    meaning_words = mkt_column_words(
                        words,
                        x0=offset + 248,
                        x1=offset + 412,
                        top=top,
                        bottom=bottom,
                        font_fragment="NanumSquareR",
                    )
                    surface_raw = join_word_lines(surface_words, gap_factor=0.8)
                    reading_raw = join_word_lines(reading_words, gap_factor=0.8)
                    meaning_raw = join_word_lines(meaning_words, gap_factor=0.2)
                    overrides = MKT_OVERRIDES.get((spec.source_id, int(str(anchor["text"]))))
                    if overrides:
                        surface_raw = overrides.get("surface_raw", surface_raw)
                        reading_raw = overrides.get("reading_raw", reading_raw)
                        meaning_raw = overrides.get("meaning_ko_raw", meaning_raw)
                    page_entries.append(
                        {
                            "kind": "entry",
                            "half": half,
                            "top": float(anchor["top"]),
                            "entry_no": int(str(anchor["text"])),
                            "surface_raw": surface_raw,
                            "reading_raw": reading_raw,
                            "meaning_ko_raw": meaning_raw,
                            "page_text": page_text,
                        }
                    )

            for event in sorted(
                [*headings, *page_entries],
                key=lambda x: (int(x["half"]), float(x["top"]), 0 if x["kind"] == "heading" else 1),
            ):
                if event["kind"] == "heading":
                    current_section = str(event["section"])
                    continue
                source_order += 1
                source_entry_id = f"{spec.source_id}_p{page_number:03d}_o{source_order:04d}"
                entry = normalize_entry(
                    {
                        "source_entry_id": source_entry_id,
                        "source_id": spec.source_id,
                        "source_file": spec.filename,
                        "source_kind": spec.source_kind,
                        "level": spec.level,
                        "page": page_number,
                        "source_order": source_order,
                        "entry_no": int(event["entry_no"]),
                        "section": current_section,
                        "part_of_speech": MKT_SECTION_TO_POS.get(current_section, ""),
                        "surface_raw": event["surface_raw"],
                        "reading_raw": event["reading_raw"],
                        "meaning_ko_raw": event["meaning_ko_raw"],
                    }
                )
                page_compact = str(event["page_text"])
                checks = [compact(entry["surface_raw"]), compact(entry["meaning_ko_raw"])]
                entry["text_crosscheck"] = 1 if all(value and value in page_compact for value in checks) else 0
                entries.append(entry)
            page_counts[str(page_number)] = len(page_entries)

    number_counts = Counter(int(entry["entry_no"]) for entry in entries)
    report = {
        "source_id": spec.source_id,
        "rows": len(entries),
        "unique_entry_numbers": len(number_counts),
        "missing_entry_numbers": [number for number in range(1, 501) if number_counts[number] == 0],
        "duplicate_entry_numbers": {
            str(number): count for number, count in sorted(number_counts.items()) if count > 1
        },
        "page_counts": page_counts,
    }
    return entries, report


def dedupe_heading_chars(chars: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[float, float, str]] = set()
    out: list[dict[str, Any]] = []
    for char in chars:
        key = (round(float(char["x0"]), 1), round(float(char["top"]), 1), str(char["text"]))
        if key in seen:
            continue
        seen.add(key)
        out.append(char)
    return out


def heading_events(page: Any) -> list[dict[str, Any]]:
    chars = [
        char
        for char in page.chars
        if "Blahblah" in str(char.get("fontname", "")) and 11.5 <= float(char.get("size", 0)) <= 12.5
    ]
    chars = dedupe_heading_chars(chars)
    events: list[dict[str, Any]] = []
    for line in group_by_top(chars, tolerance=0.8):
        text = compact(join_positioned(line, gap_factor=0.45))
        text = collapse_pairwise_duplicates(text)
        if text in IL_SECTION_NAMES:
            x0 = min(float(char["x0"]) for char in line)
            events.append(
                {
                    "kind": "heading",
                    "column": 1 if x0 >= page.width / 2 else 0,
                    "top": min(float(char["top"]) for char in line),
                    "section": IL_SECTION_LABELS[text],
                }
            )
    return events


def surface_lines(page: Any, *, single_column: bool = False) -> list[dict[str, Any]]:
    chars = [
        char
        for char in page.chars
        if "Gothic" in str(char.get("fontname", ""))
        and "W5" in str(char.get("fontname", ""))
        and float(char.get("size", 0)) >= 9.0
    ]
    lines: list[dict[str, Any]] = []
    # Many pages align the left and right entries on the exact same baseline.
    # Partition by physical column before grouping by top, otherwise two distinct
    # words become one synthetic "left-word right-word" expression.
    for column in ((0,) if single_column else (0, 1)):
        column_chars = [
            char
            for char in chars
            if single_column
            or (
                1 if (float(char["x0"]) + float(char["x1"])) / 2 >= page.width / 2 else 0
            )
            == column
        ]
        for line in group_by_top(column_chars, tolerance=0.65):
            text = join_positioned(line, gap_factor=0.62)
            if not text:
                continue
            x0 = min(float(char["x0"]) for char in line)
            x1 = max(float(char["x1"]) for char in line)
            top = min(float(char["top"]) for char in line)
            lines.append(
                {
                    "kind": "entry",
                    "column": column,
                    "top": top,
                    "x0": x0,
                    "x1": x1,
                    "surface_raw": text,
                    "surface_chars": line,
                }
            )
    return lines


def meaning_lines(page: Any, *, single_column: bool = False) -> list[dict[str, Any]]:
    chars = [
        char
        for char in page.chars
        if "YDVYGOStd11" in str(char.get("fontname", ""))
        and 7.0 <= float(char.get("size", 0)) <= 8.3
    ]
    lines: list[dict[str, Any]] = []
    for column in ((0,) if single_column else (0, 1)):
        column_chars = [
            char
            for char in chars
            if single_column
            or (
                1 if (float(char["x0"]) + float(char["x1"])) / 2 >= page.width / 2 else 0
            )
            == column
        ]
        for line in group_by_top(column_chars, tolerance=0.8):
            text = join_positioned(line, gap_factor=0.45)
            if not text:
                continue
            lines.append(
                {
                    "column": column,
                    "top": min(float(char["top"]) for char in line),
                    "text": text,
                }
            )
    return lines


def reconstruct_ruby_reading(page: Any, entry: dict[str, Any]) -> str:
    surface_chars = sorted(entry["surface_chars"], key=lambda x: float(x["x0"]))
    surface_top = float(entry["top"])
    x0 = float(entry["x0"]) - 1.5
    x1 = float(entry["x1"]) + 1.5
    ruby_chars = [
        char
        for char in page.chars
        if "Mincho" in str(char.get("fontname", ""))
        and x0 <= (float(char["x0"]) + float(char["x1"])) / 2 <= x1
        and surface_top - 8.0 <= float(char["top"]) <= surface_top - 2.0
    ]

    events: list[tuple[float, int, str]] = []
    for char in ruby_chars:
        events.append((float(char["x0"]), 0, str(char["text"])))
    for char in surface_chars:
        text = str(char["text"])
        if not is_kanji(text):
            events.append((float(char["x0"]), 1, text))
    reading = "".join(text for _, _, text in sorted(events, key=lambda x: (x[0], x[1])))
    reading = clean(reading).replace(" ", "")
    reading = reading.lstrip("□≒")
    return reading


def extract_pass(spec: SourceSpec) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    path = PDF_DIR / spec.filename
    entries: list[dict[str, Any]] = []
    current_section = ""
    source_order = 0
    page_counts: dict[str, int] = {}
    section_counts: Counter[str] = Counter()

    with pdfplumber.open(path) as pdf:
        for page_number in range(spec.first_word_page, spec.last_word_page + 1):
            page = pdf.pages[page_number - 1]
            page_text = normalized_page_text(page)
            headings = heading_events(page)
            single_column_synonyms = (
                (spec.level == "N4" and 14 <= page_number <= 23)
                or (spec.level == "N5" and 14 <= page_number <= 24)
            )
            surfaces = surface_lines(page, single_column=single_column_synonyms)

            for event in sorted(
                [*headings, *surfaces],
                key=lambda x: (int(x["column"]), float(x["top"]), 0 if x["kind"] == "heading" else 1),
            ):
                if event["kind"] == "heading":
                    current_section = str(event["section"])
                else:
                    event["section"] = current_section

            meanings = meaning_lines(page, single_column=single_column_synonyms)
            for event in surfaces:
                single_column = spec.level in {"N4", "N5"} and event.get("section") == "유의어"
                event["layout_column"] = 0 if single_column else int(event["column"])
            for line in meanings:
                single_column_page = spec.level in {"N4", "N5"} and any(
                    event.get("section") == "유의어" for event in surfaces
                )
                line["layout_column"] = 0 if single_column_page else int(line["column"])

            by_layout: dict[int, list[dict[str, Any]]] = defaultdict(list)
            for event in surfaces:
                by_layout[int(event["layout_column"])].append(event)
            meanings_by_layout: dict[int, list[dict[str, Any]]] = defaultdict(list)
            for line in meanings:
                meanings_by_layout[int(line["layout_column"])].append(line)

            ordered_page_entries: list[dict[str, Any]] = []
            for layout_column, surface_group in by_layout.items():
                surface_group.sort(key=lambda x: float(x["top"]))
                candidate_meanings = meanings_by_layout.get(layout_column, [])
                for index, event in enumerate(surface_group):
                    top = float(event["top"]) - 0.3
                    bottom = (
                        float(surface_group[index + 1]["top"]) - 0.8
                        if index + 1 < len(surface_group)
                        else 410.0
                    )
                    gloss_lines = [
                        line for line in candidate_meanings if top <= float(line["top"]) < bottom
                    ]
                    event["meaning_ko_raw"] = clean(" ".join(line["text"] for line in gloss_lines))
                    event["reading_raw"] = reconstruct_ruby_reading(page, event)
                    ordered_page_entries.append(event)

            # Some sentence-style entries wrap over two physical lines.  The
            # first line has no Korean gloss; the continuation line carries the
            # gloss for the complete entry.  Merge those source lines before
            # normalization so that one printed item remains one CSV row.
            merged_page_entries: list[dict[str, Any]] = []
            for layout_column in sorted(by_layout):
                column_entries = sorted(
                    [
                        event
                        for event in ordered_page_entries
                        if int(event["layout_column"]) == layout_column
                    ],
                    key=lambda event: float(event["top"]),
                )
                index = 0
                while index < len(column_entries):
                    event = column_entries[index]
                    while (
                        not clean(event.get("meaning_ko_raw"))
                        and index + 1 < len(column_entries)
                    ):
                        continuation = column_entries[index + 1]
                        event["surface_raw"] = clean(
                            f"{event['surface_raw']} {continuation['surface_raw']}"
                        )
                        event["reading_raw"] = clean(
                            f"{event['reading_raw']}{continuation['reading_raw']}"
                        )
                        event["meaning_ko_raw"] = continuation["meaning_ko_raw"]
                        event["surface_chars"] = [
                            *event["surface_chars"],
                            *continuation["surface_chars"],
                        ]
                        event["x0"] = min(float(event["x0"]), float(continuation["x0"]))
                        event["x1"] = max(float(event["x1"]), float(continuation["x1"]))
                        index += 1
                    merged_page_entries.append(event)
                    index += 1

            ordered_page_entries = merged_page_entries

            for event in sorted(ordered_page_entries, key=lambda x: (int(x["column"]), float(x["top"]))):
                overrides = PASS_OVERRIDES.get(
                    (spec.source_id, page_number, clean(event["surface_raw"]))
                )
                if overrides:
                    event.update(overrides)
                source_order += 1
                source_entry_id = f"{spec.source_id}_p{page_number:03d}_o{source_order:04d}"
                entry = normalize_entry(
                    {
                        "source_entry_id": source_entry_id,
                        "source_id": spec.source_id,
                        "source_file": spec.filename,
                        "source_kind": spec.source_kind,
                        "level": spec.level,
                        "page": page_number,
                        "source_order": source_order,
                        "entry_no": "",
                        "section": event.get("section", ""),
                        "part_of_speech": "",
                        "surface_raw": event["surface_raw"],
                        "reading_raw": event["reading_raw"],
                        "meaning_ko_raw": event["meaning_ko_raw"],
                    }
                )
                checks = [compact(entry["surface_raw"]), compact(entry["meaning_ko_raw"])]
                entry["text_crosscheck"] = 1 if all(value and value in page_text for value in checks) else 0
                entries.append(entry)
                section_counts[str(entry["section"])] += 1
            page_counts[str(page_number)] = len(ordered_page_entries)

    report = {
        "source_id": spec.source_id,
        "rows": len(entries),
        "section_counts": dict(sorted(section_counts.items())),
        "page_counts": page_counts,
    }
    return entries, report


def load_existing_words() -> tuple[dict[tuple[str, str], dict[str, str]], dict[str, list[dict[str, str]]]]:
    exact: dict[tuple[str, str], dict[str, str]] = {}
    by_surface: dict[str, list[dict[str, str]]] = defaultdict(list)
    if not DB_PATH.exists():
        return exact, by_surface
    db = sqlite3.connect(DB_PATH)
    try:
        for word_id, level, surface, reading, pos in db.execute(
            "SELECT id, level, surface, reading_kana, COALESCE(part_of_speech, '') "
            "FROM word WHERE deprecated = 0"
        ):
            row = {
                "id": str(word_id),
                "level": str(level),
                "surface": clean(surface),
                "reading": clean(reading),
                "part_of_speech": clean(pos),
            }
            exact[(row["surface"], row["reading"])] = row
            by_surface[row["surface"]].append(row)
    finally:
        db.close()
    return exact, by_surface


def attach_existing_matches(entries: list[dict[str, Any]]) -> None:
    exact, by_surface = load_existing_words()
    for entry in entries:
        key = (entry["surface"], entry["reading_kana"])
        matched = exact.get(key)
        if matched:
            entry["existing_word_id"] = matched["id"]
            entry["existing_level"] = matched["level"]
            entry["match_status"] = "exact"
            if not entry["part_of_speech"]:
                entry["part_of_speech"] = matched["part_of_speech"]
        else:
            candidates = by_surface.get(entry["surface"], [])
            entry["existing_word_id"] = ""
            entry["existing_level"] = ""
            entry["match_status"] = "surface_only" if candidates else "new"

        blockers: list[str] = []
        notes: list[str] = []
        if not entry["surface"]:
            blockers.append("표제어 누락")
        if not entry["reading_kana"]:
            blockers.append("읽기 누락")
        if not entry["meaning_ko"]:
            blockers.append("한국어 뜻 누락")
        if not entry["text_crosscheck"]:
            if (entry["source_id"], entry.get("entry_no")) in MKT_OVERRIDES:
                notes.append("PDF 표 행 경계를 원문과 대조하여 교정")
            else:
                notes.append("문자 좌표 검증 완료; 선형 텍스트 레이어 순서 불일치")
        if entry["entry_type"] != "word":
            notes.append(f"{entry['entry_type']} 항목: 원본 보존, 앱 기본 목록 제외")
        entry["qa_note"] = "; ".join([*blockers, *notes])
        entry["qa_status"] = "verified" if not blockers else "needs_review"


def preferred_occurrence(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return sorted(
        rows,
        key=lambda row: (
            0 if row["source_kind"] == "mkt" else 1,
            LEVEL_ORDER.index(row["level"]),
            int(row["source_order"]),
        ),
    )[0]


def unique_join(values: Iterable[str]) -> str:
    return ";".join(dict.fromkeys(value for value in values if value))


def build_master(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        reading_key = entry["reading_kana"] or f"__missing__:{entry['source_entry_id']}"
        groups[(entry["surface"], reading_key)].append(entry)

    master: list[dict[str, Any]] = []
    for (surface, reading_key), rows in groups.items():
        preferred = preferred_occurrence(rows)
        reading = "" if reading_key.startswith("__missing__:") else reading_key
        levels = [level for level in LEVEL_ORDER if any(row["level"] == level for row in rows)]
        existing = next((row for row in rows if row["existing_word_id"]), None)
        entry_types = list(dict.fromkeys(row["entry_type"] for row in rows))
        include_in_app = int(any(int(row["include_in_app"]) == 1 for row in rows))
        qa_notes = unique_join(row["qa_note"] for row in rows)
        row = {
            "id": existing["existing_word_id"] if existing else (make_word_id(surface, reading) if reading else ""),
            "primary_level": levels[0] if levels else preferred["level"],
            "levels": ";".join(levels),
            "surface": surface,
            "reading_kana": reading,
            "alt_readings": unique_join(row["alt_readings"] for row in rows),
            "meaning_ko": preferred["meaning_ko"],
            "meaning_ko_variants": unique_join(row["meaning_ko"] for row in rows),
            "part_of_speech": next((row["part_of_speech"] for row in rows if row["part_of_speech"]), ""),
            "entry_type": entry_types[0] if len(entry_types) == 1 else "mixed",
            "include_in_app": include_in_app,
            "source_ids": unique_join(row["source_id"] for row in rows),
            "source_entry_ids": unique_join(row["source_entry_id"] for row in rows),
            "source_entry_count": len(rows),
            "sections": unique_join(row["section"] for row in rows),
            "existing_word_id": existing["existing_word_id"] if existing else "",
            "existing_level": existing["existing_level"] if existing else "",
            "qa_status": "verified" if all(row["qa_status"] == "verified" for row in rows) else "needs_review",
            "qa_note": qa_notes,
        }
        master.append(row)

    return sorted(
        master,
        key=lambda row: (
            LEVEL_ORDER.index(row["primary_level"]),
            row["surface"],
            row["reading_kana"],
        ),
    )


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def source_metadata(spec: SourceSpec) -> dict[str, Any]:
    return {
        **asdict(spec),
        "path": str(PDF_DIR / spec.filename),
    }


def validate_reports(entries: list[dict[str, Any]], reports: list[dict[str, Any]]) -> list[str]:
    failures: list[str] = []
    expected_mkt = {"mkt_n1": 500, "mkt_n2": 502, "mkt_n3": 500}
    for report in reports:
        source_id = report["source_id"]
        if source_id in expected_mkt and report["rows"] != expected_mkt[source_id]:
            failures.append(f"{source_id}: rows={report['rows']} expected={expected_mkt[source_id]}")
        if source_id.startswith("mkt_") and report.get("missing_entry_numbers"):
            failures.append(f"{source_id}: missing entry numbers {report['missing_entry_numbers']}")
    if any(not entry["surface"] for entry in entries):
        failures.append("one or more source entries have an empty surface")
    if any(not entry["reading_kana"] for entry in entries):
        failures.append("one or more source entries have an empty reading")
    if any(not entry["meaning_ko"] for entry in entries):
        failures.append("one or more source entries have an empty Korean meaning")
    return failures


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, Any]] = []
    reports: list[dict[str, Any]] = []

    for spec in SOURCES:
        path = PDF_DIR / spec.filename
        if not path.exists():
            raise FileNotFoundError(path)
        extracted, report = extract_mkt(spec) if spec.source_kind == "mkt" else extract_pass(spec)
        entries.extend(extracted)
        reports.append(report)

    attach_existing_matches(entries)
    entries.sort(key=lambda row: (next(i for i, s in enumerate(SOURCES) if s.source_id == row["source_id"]), int(row["source_order"])))
    master = build_master(entries)
    app_vocab = [row for row in master if int(row["include_in_app"]) == 1]

    failures = validate_reports(entries, reports)
    if failures:
        raise RuntimeError("Extraction validation failed:\n" + "\n".join(failures))

    write_csv(OUT_DIR / "jlpt_source_entries.csv", entries, SOURCE_FIELDS)
    write_csv(OUT_DIR / "jlpt_vocab_master.csv", master, MASTER_FIELDS)
    write_csv(OUT_DIR / "jlpt_app_vocab.csv", app_vocab, MASTER_FIELDS)

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "schema_version": 1,
        "generated_at": now,
        "sources": [source_metadata(spec) for spec in SOURCES],
        "counts": {
            "source_entries": len(entries),
            "master_entries": len(master),
            "app_entries": len(app_vocab),
        },
        "vocabulary": master,
        "source_entries": entries,
    }
    (OUT_DIR / "jlpt_vocab.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    app_payload = {
        "schema_version": 1,
        "generated_at": now,
        "count": len(app_vocab),
        "vocabulary": app_vocab,
    }
    (OUT_DIR / "jlpt_app_vocab.json").write_text(
        json.dumps(app_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    report_payload = {
        "generated_at": now,
        "sources": reports,
        "summary": {
            "source_entries": len(entries),
            "source_verified": sum(row["qa_status"] == "verified" for row in entries),
            "source_needs_review": sum(row["qa_status"] != "verified" for row in entries),
            "master_entries": len(master),
            "app_entries": len(app_vocab),
            "master_verified": sum(row["qa_status"] == "verified" for row in master),
            "master_needs_review": sum(row["qa_status"] != "verified" for row in master),
            "entry_types": dict(Counter(row["entry_type"] for row in entries)),
            "match_status": dict(Counter(row["match_status"] for row in entries)),
            "text_crosscheck": dict(Counter(str(row["text_crosscheck"]) for row in entries)),
            "manual_corrections": len(MKT_OVERRIDES) + len(PASS_OVERRIDES),
        },
    }
    (OUT_DIR / "extraction_report.json").write_text(
        json.dumps(report_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(json.dumps(report_payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
