#!/usr/bin/env python3
"""Audit app JLPT levels against NAVER Japanese Dictionary, one headword at a time.

NAVER exposes the displayed JLPT badge in the Japanese dictionary search JSON as
``frequencyAdd: "JLPT 5"``.  Search results are matched by both written form and
reading so homographs do not inherit one another's level.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import subprocess
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORDS = ROOT / "data/pdf-vocab/jlpt_final_wordlist.csv"
DEFAULT_OUT = ROOT / "data/pdf-vocab/naver_jlpt_level_audit_2026-08-19.csv"
DEFAULT_REPORT = ROOT / "data/pdf-vocab/naver_jlpt_level_audit_2026-08-19.json"
DEFAULT_CACHE = ROOT / ".cache/naver-jlpt-levels.json"
DEFAULT_CATALOG_CACHE = ROOT / ".cache/naver-jlpt-catalog.json"
DEFAULT_CATALOG_BATCH_DIR = ROOT / ".cache/naver-jlpt-catalog-batches"
API = "https://ja.dict.naver.com/api3/jako/search"
CATALOG_API = "https://ja.dict.naver.com/api/jako/getJLPTList"
CATALOG_PAGE_COUNTS = {1: 325, 2: 265, 3: 155, 4: 104, 5: 75}
SEARCH_URL = "https://ja.dict.naver.com/#/search?query="
TAG_RE = re.compile(r"(?:^|\s)JLPT\s+([1-5])(?:\s|$)")
HTML_RE = re.compile(r"<[^>]+>")
FORM_SPLIT_RE = re.compile(r"[·・･,，、/／|｜;；\s]+")
OUTPUT_FIELDS = [
    "id",
    "app_level",
    "naver_level",
    "status",
    "surface",
    "reading_kana",
    "naver_entry",
    "naver_reading",
    "naver_frequency_add",
    "naver_entry_id",
    "match_basis",
    "candidate_levels",
    "source_url",
    "checked_at",
    "note",
]
APP_POS_TO_NAVER = {
    "noun": {"명사"},
    "verb": {"동사"},
    "adjective": {"형용사", "형용동사"},
    "adverb": {"부사"},
    "pronoun": {"대명사"},
    "conjunction": {"접속사"},
    "interjection": {"감동사"},
    "suffix": {"접사"},
    "prefix": {"접사"},
    "numeral": {"수사"},
    "counter": {"명사", "접사"},
}
KO_TOKEN_RE = re.compile(r"[가-힣]{2,}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--words", type=Path, default=DEFAULT_WORDS)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--catalog-cache", type=Path, default=DEFAULT_CATALOG_CACHE)
    parser.add_argument("--catalog-batch-dir", type=Path, default=DEFAULT_CATALOG_BATCH_DIR)
    parser.add_argument("--catalog-batch-index", type=int)
    parser.add_argument("--catalog-batch-size", type=int, default=25)
    parser.add_argument(
        "--catalog-cache-bust",
        default="",
        help="Optional query value used to bypass stale/blocked NAVER CDN responses.",
    )
    parser.add_argument("--source-mode", choices=("catalog", "search"), default="catalog")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--delay-ms", type=int, default=180)
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--refresh", action="store_true")
    return parser.parse_args()


def clean_markup(value: Any) -> str:
    return html.unescape(HTML_RE.sub("", str(value or ""))).strip()


def normalized(value: Any) -> str:
    return clean_markup(value).replace(" ", "").replace("　", "")


def forms(value: Any) -> set[str]:
    plain = normalized(value)
    if not plain:
        return set()
    return {part for part in FORM_SPLIT_RE.split(plain) if part}


def extract_level(value: Any) -> str:
    match = TAG_RE.search(str(value or ""))
    return f"N{match.group(1)}" if match else ""


def read_words(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [
            row
            for row in csv.DictReader(handle)
            if str(row.get("deprecated", "0")).strip() != "1"
        ]
    for row in rows:
        if not row.get("level") and row.get("app_level"):
            row["level"] = row["app_level"]
    return rows


def load_cache(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    return value if isinstance(value, dict) else {}


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def fetch_query(query: str, timeout: float, retries: int) -> dict[str, Any]:
    params = urllib.parse.urlencode({"query": query, "m": "pc", "range": "all"})
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
        level = extract_level(item.get("frequencyAdd"))
        if not level:
            continue
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
                "frequency_add": str(item.get("frequencyAdd", "")),
                "level": level,
            }
        )
    return {"ok": True, "items": reduced}


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
    raise RuntimeError(f"NAVER catalog request failed: {url}: {last_error}")


def catalog_url(level: int, page: int, cache_bust: str = "") -> str:
    values = {"level": level, "part": "allClass", "page": page}
    if cache_bust:
        values["_audit"] = cache_bust
    params = urllib.parse.urlencode(values)
    return f"{CATALOG_API}?{params}"


def catalog_jobs() -> list[tuple[int, int]]:
    return [
        (level, page)
        for level, page_count in CATALOG_PAGE_COUNTS.items()
        for page in range(1, page_count + 1)
    ]


def fetch_catalog_batch(args: argparse.Namespace) -> None:
    batch_size = max(1, args.catalog_batch_size)
    batch_index = int(args.catalog_batch_index)
    jobs = catalog_jobs()[batch_index * batch_size : (batch_index + 1) * batch_size]
    if not jobs:
        raise RuntimeError(f"catalog batch {batch_index} is outside the job range")
    documents = []
    for level, page in jobs:
        documents.append(
            {
                "level": level,
                "page": page,
                "document": fetch_json(
                    catalog_url(level, page, args.catalog_cache_bust),
                    args.timeout,
                    args.retries,
                ),
            }
        )
    output = args.catalog_batch_dir / f"batch-{batch_index:03d}.json"
    atomic_json(output, {"batch_index": batch_index, "documents": documents})
    print(f"catalog batch={batch_index} pages={len(documents)} output={output}", flush=True)


def fetch_catalog(args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.catalog_cache.exists() and not args.refresh:
        with args.catalog_cache.open(encoding="utf-8") as handle:
            cached = json.load(handle)
        if isinstance(cached, dict) and isinstance(cached.get("items"), list):
            print(f"catalog cached items={len(cached['items'])}", flush=True)
            return cached["items"]

    expected_jobs = set(catalog_jobs())
    batch_documents: dict[tuple[int, int], dict[str, Any]] = {}
    for path in sorted(args.catalog_batch_dir.glob("batch-*.json")):
        with path.open(encoding="utf-8") as handle:
            batch = json.load(handle)
        for row in batch.get("documents", []):
            batch_documents[(int(row["level"]), int(row["page"]))] = row["document"]
    if set(batch_documents) == expected_jobs:
        documents = batch_documents
        page_jobs: list[tuple[int, int]] = []
        first_pages: dict[int, dict[str, Any]] = {}
        print(f"catalog batch cache pages={len(documents)}", flush=True)
    else:
        documents = {}

    if not documents:
        first_pages = {}
        for level in range(1, 6):
            first_pages[level] = fetch_json(
                catalog_url(level, 1, args.catalog_cache_bust),
                args.timeout,
                args.retries,
            )
        page_jobs = [
            (level, page)
            for level, document in first_pages.items()
            for page in range(2, int(document.get("m_totalPage", 1)) + 1)
        ]
        documents = {(level, 1): document for level, document in first_pages.items()}
    completed = 0
    started = time.monotonic()

    def worker(job: tuple[int, int]) -> tuple[tuple[int, int], dict[str, Any]]:
        level, page = job
        result = fetch_json(
            catalog_url(level, page, args.catalog_cache_bust),
            args.timeout,
            args.retries,
        )
        time.sleep(max(0, args.delay_ms) / 1000)
        return job, result

    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        futures = [pool.submit(worker, job) for job in page_jobs]
        for future in as_completed(futures):
            job, document = future.result()
            documents[job] = document
            completed += 1
            if completed % 100 == 0 or completed == len(page_jobs):
                elapsed = max(0.001, time.monotonic() - started)
                print(
                    f"catalog pages {completed}/{len(page_jobs)} "
                    f"({completed/elapsed:.1f} pages/s)",
                    flush=True,
                )

    items: list[dict[str, Any]] = []
    for (level, _page), document in sorted(documents.items()):
        for item in document.get("m_items", []) or []:
            items.append(
                {
                    "level": f"N{level}",
                    "entry_id": str(item.get("entry_id", "")),
                    "entry": clean_markup(item.get("entry")),
                    "show_entry": clean_markup(item.get("show_entry")),
                    "pron": clean_markup(item.get("pron")),
                    "parts": item.get("parts") or [],
                    "means": item.get("means") or [],
                }
            )
    atomic_json(
        args.catalog_cache,
        {
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "source": CATALOG_API,
            "items": items,
        },
    )
    print(f"catalog fetched items={len(items)}", flush=True)
    return items


def catalog_as_query_cache(
    words: list[dict[str, str]], catalog: list[dict[str, Any]]
) -> dict[str, Any]:
    by_form: dict[str, list[dict[str, Any]]] = {}
    for rank, item in enumerate(catalog, start=1):
        candidate = {
            "rank": str(rank),
            "entry_id": item["entry_id"],
            "match_type": "exact:catalog",
            "entry": normalized(item["entry"]).replace("-", ""),
            "handle_entry": normalized(item["entry"]).replace("-", ""),
            "kanji": item["pron"],
            "audio_read": "",
            "meaning_read": "",
            "frequency_add": item["level"].replace("N", "JLPT "),
            "level": item["level"],
            "parts": item.get("parts") or [],
            "means": item.get("means") or [],
        }
        candidate_forms = written_forms(candidate) | reading_forms(candidate)
        candidate_forms.add(normalized(item.get("show_entry", "")).replace("-", ""))
        for form in candidate_forms:
            by_form.setdefault(form, []).append(candidate)

    result: dict[str, Any] = {}
    for query in dict.fromkeys(row["surface"].strip() for row in words):
        result[query] = {"ok": True, "items": by_form.get(normalized(query), [])}
    return result


def reading_forms(item: dict[str, Any]) -> set[str]:
    result = set()
    for key in ("handle_entry", "entry", "audio_read", "meaning_read"):
        result.update(forms(item.get(key)))
    return result


def written_forms(item: dict[str, Any]) -> set[str]:
    result = set()
    for key in ("kanji", "entry", "handle_entry"):
        result.update(forms(item.get(key)))
    return result


def korean_tokens(value: Any) -> set[str]:
    return set(KO_TOKEN_RE.findall(str(value or "")))


def semantic_match(word: dict[str, str], item: dict[str, Any]) -> tuple[bool, str]:
    app_pos = str(word.get("part_of_speech", "")).strip()
    allowed_parts = APP_POS_TO_NAVER.get(app_pos)
    naver_parts = {str(value) for value in item.get("parts") or []}
    if not allowed_parts or not naver_parts or not (allowed_parts & naver_parts):
        return False, f"part of speech not confirmed: app={app_pos or '-'} NAVER={','.join(sorted(naver_parts)) or '-'}"

    app_meaning = str(word.get("meaning_ko", "")).strip()
    naver_meaning = ";".join(str(value) for value in item.get("means") or [])
    app_compact = re.sub(r"[^가-힣]", "", app_meaning)
    naver_compact = re.sub(r"[^가-힣]", "", naver_meaning)
    overlap = korean_tokens(app_meaning) & korean_tokens(naver_meaning)
    if not overlap and not (
        app_compact
        and naver_compact
        and (app_compact in naver_compact or naver_compact in app_compact)
    ):
        return False, "Korean meaning not confidently aligned"
    return True, ""


def choose_match(
    word: dict[str, str], cached: dict[str, Any]
) -> tuple[dict[str, Any] | None, str, str, str]:
    surface = normalized(word.get("surface"))
    reading = normalized(word.get("reading_kana"))
    items = list(cached.get("items", []))
    candidates: list[tuple[int, int, dict[str, Any], str]] = []
    for item in items:
        item_written = written_forms(item)
        item_readings = reading_forms(item)
        surface_match = surface in item_written
        reading_match = reading in item_readings
        if surface_match and reading_match:
            score, basis = 300, "surface+reading"
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
        levels = sorted({str(item.get("level", "")) for item in items if item.get("level")})
        return None, "", "|".join(levels), ""
    candidates.sort(key=lambda row: (row[0], row[1]), reverse=True)
    best_score = candidates[0][0]
    best = [row for row in candidates if row[0] == best_score]
    best_by_entry = {
        (
            str(row[2].get("entry_id") or f"anonymous-{index}"),
            str(row[2].get("level") or ""),
        ): row
        for index, row in enumerate(best)
    }
    best = list(best_by_entry.values())
    best_levels = sorted({row[2]["level"] for row in best})
    if len(best) != 1:
        return None, "", "|".join(best_levels), "multiple NAVER entries match surface+reading"
    chosen = best[0]
    semantic_ok, semantic_note = semantic_match(word, chosen[2])
    if not semantic_ok:
        return None, chosen[3], "|".join(best_levels), semantic_note
    return chosen[2], chosen[3], "|".join(best_levels), ""


def audit_word(word: dict[str, str], cached: dict[str, Any], checked_at: str) -> dict[str, str]:
    query = word.get("surface", "").strip()
    url = SEARCH_URL + urllib.parse.quote(query, safe="")
    base = {
        "id": word.get("id", ""),
        "app_level": word.get("level", ""),
        "surface": query,
        "reading_kana": word.get("reading_kana", ""),
        "source_url": url,
        "checked_at": checked_at,
    }
    if not cached.get("ok"):
        return {
            **base,
            "naver_level": "",
            "status": "fetch_error",
            "naver_entry": "",
            "naver_reading": "",
            "naver_frequency_add": "",
            "naver_entry_id": "",
            "match_basis": "",
            "candidate_levels": "",
            "note": str(cached.get("error", "request failed")),
        }
    matched, basis, candidate_levels, match_note = choose_match(word, cached)
    if matched is None:
        has_jlpt_candidates = bool(cached.get("items"))
        return {
            **base,
            "naver_level": "",
            "status": "manual_review" if has_jlpt_candidates else "naver_level_missing",
            "naver_entry": "",
            "naver_reading": "",
            "naver_frequency_add": "",
            "naver_entry_id": "",
            "match_basis": basis,
            "candidate_levels": candidate_levels,
            "note": match_note or (
                "JLPT-tagged search results exist, but none matched both form and reading"
                if has_jlpt_candidates
                else "No JLPT-tagged NAVER entry found"
            ),
        }
    naver_level = str(matched.get("level", ""))
    status = "exact_match" if naver_level == word.get("level", "") else "confirmed_mismatch"
    return {
        **base,
        "naver_level": naver_level,
        "status": status,
        "naver_entry": str(matched.get("kanji") or matched.get("entry") or ""),
        "naver_reading": str(matched.get("handle_entry") or matched.get("entry") or ""),
        "naver_frequency_add": str(matched.get("frequency_add", "")),
        "naver_entry_id": str(matched.get("entry_id", "")),
        "match_basis": basis,
        "candidate_levels": candidate_levels,
        "note": "",
    }


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def main() -> None:
    args = parse_args()
    if args.catalog_batch_index is not None:
        fetch_catalog_batch(args)
        return
    words = read_words(args.words)
    words = words[args.offset : args.offset + args.limit if args.limit else None]
    queries = list(dict.fromkeys(row["surface"].strip() for row in words))
    if args.source_mode == "catalog":
        catalog = fetch_catalog(args)
        cache = catalog_as_query_cache(words, catalog)
        pending: list[str] = []
    else:
        cache = {} if args.refresh else load_cache(args.cache)
        pending = [query for query in queries if query not in cache]
    lock = threading.Lock()
    completed = 0
    started = time.monotonic()
    print(
        f"words={len(words)} unique_queries={len(queries)} cached={len(queries)-len(pending)} "
        f"pending={len(pending)}",
        flush=True,
    )

    def worker(query: str) -> tuple[str, dict[str, Any]]:
        result = fetch_query(query, args.timeout, args.retries)
        time.sleep(max(0, args.delay_ms) / 1000)
        return query, result

    if pending:
        with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
            futures = [pool.submit(worker, query) for query in pending]
            for future in as_completed(futures):
                query, result = future.result()
                with lock:
                    cache[query] = result
                    completed += 1
                    if completed % 25 == 0 or completed == len(pending):
                        atomic_json(args.cache, cache)
                    if completed % 100 == 0 or completed == len(pending):
                        elapsed = max(0.001, time.monotonic() - started)
                        print(
                            f"fetched {completed}/{len(pending)} "
                            f"({completed/elapsed:.1f} queries/s)",
                            flush=True,
                        )

    checked_at = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    rows = [audit_word(word, cache[word["surface"].strip()], checked_at) for word in words]
    rows.sort(key=lambda row: (row["status"], row["app_level"], row["surface"], row["reading_kana"]))
    write_csv(args.out, rows)
    mismatch_out = args.out.with_name(args.out.stem + "_mismatches.csv")
    review_out = args.out.with_name(args.out.stem + "_review.csv")
    write_csv(mismatch_out, [row for row in rows if row["status"] == "confirmed_mismatch"])
    write_csv(
        review_out,
        [row for row in rows if row["status"] in {"manual_review", "naver_level_missing", "fetch_error"}],
    )
    counts: dict[str, int] = {}
    transitions: dict[str, int] = {}
    for row in rows:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
        if row["status"] == "confirmed_mismatch":
            key = f'{row["app_level"]}->{row["naver_level"]}'
            transitions[key] = transitions.get(key, 0) + 1
    report = {
        "generated_at": checked_at,
        "source": str(args.words),
        "source_sha256": hashlib.sha256(args.words.read_bytes()).hexdigest(),
        "naver_api": CATALOG_API if args.source_mode == "catalog" else API,
        "source_mode": args.source_mode,
        "word_count": len(words),
        "unique_queries": len(queries),
        "status_counts": dict(sorted(counts.items())),
        "mismatch_transitions": dict(sorted(transitions.items())),
        "naver_catalog_level_counts": (
            dict(sorted({level: sum(item["level"] == level for item in catalog) for level in {item["level"] for item in catalog}}.items()))
            if args.source_mode == "catalog"
            else None
        ),
        "method": (
            "Load every entry displayed in NAVER Japanese Dictionary's JLPT N1-N5 catalog; "
            "select one entry only when written form, reading, part of speech, and Korean meaning "
            "align; compare NAVER's displayed level with the app level. Multiple-entry, ambiguous, "
            "and unmatched cases are not auto-classified. This is the app's reference catalog, "
            "not an official JLPT vocabulary list."
            if args.source_mode == "catalog"
            else
            "Search each unique surface in NAVER Japanese Dictionary; select a JLPT-tagged "
            "entry matching both written form and reading; compare NAVER's level with the "
            "app level. Ambiguous and unmatched entries are not auto-classified."
        ),
        "output": str(args.out),
        "mismatch_output": str(mismatch_out),
        "review_output": str(review_out),
    }
    atomic_json(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
