#!/usr/bin/env python3
"""Pre-generate Japanese word/example MP3s with edge-tts.

Default behavior remains compatible with the original script: read active rows from
assets/jlpt.db and generate both word and example audio.  A JSON/CSV word list can
be supplied for prospective data that has not been imported into the app DB yet.
Run ``npm run audio:prepare`` afterward to create Android Ogg/Opus assets and maps.
"""

import argparse
import asyncio
import csv
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

import edge_tts


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.join(ROOT, "assets", "jlpt.db")
OUT_WORDS = os.path.join(ROOT, "assets", "audio", "words")
OUT_EXAMPLES = os.path.join(ROOT, "assets", "audio", "examples")
DEFAULT_VOICE = "ja-JP-NanamiNeural"
DEFAULT_CONCURRENCY = 6
DEFAULT_RATE = "+0%"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DEFAULT_DB, help="SQLite source when --words is omitted")
    parser.add_argument("--words", help="Prospective word list (.json or .csv)")
    parser.add_argument(
        "--new-vs-db",
        metavar="PATH",
        help="Only rows whose id is absent from the active word rows in this DB",
    )
    parser.add_argument("--kind", choices=("words", "examples", "both"), default="both")
    parser.add_argument("--ids", help="Comma-separated word IDs to synthesize")
    parser.add_argument("--force", action="store_true", help="Replace existing audio for selected jobs")
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--rate", default=DEFAULT_RATE)
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--report", help="Write a JSON execution report")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.concurrency < 1:
        parser.error("--concurrency must be at least 1")
    if args.retries < 1:
        parser.error("--retries must be at least 1")
    return args


def active_db_ids(path):
    with sqlite3.connect(path) as conn:
        return {row[0] for row in conn.execute("SELECT id FROM word WHERE deprecated = 0")}


def read_db_rows(path):
    with sqlite3.connect(path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, reading_kana,
                   COALESCE(NULLIF(example_jp, ''), '') AS example_jp
            FROM word
            WHERE deprecated = 0
            ORDER BY level, id
            """
        ).fetchall()
    return [dict(row) for row in rows]


def read_word_rows(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".json":
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = data.get("vocabulary") or data.get("words") or data.get("items")
        else:
            rows = None
        if not isinstance(rows, list):
            raise ValueError("JSON must be an array or contain vocabulary/words/items array")
        return rows
    if ext == ".csv":
        with open(path, encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))
    raise ValueError("--words must point to a .json or .csv file")


def clean_rows(rows):
    cleaned = []
    seen = set()
    for index, row in enumerate(rows, start=1):
        word_id = str(row.get("id") or "").strip()
        if not word_id:
            raise ValueError(f"row {index} has no id")
        if word_id in seen:
            raise ValueError(f"duplicate word id: {word_id}")
        seen.add(word_id)
        cleaned.append(
            {
                "id": word_id,
                "reading_kana": str(row.get("reading_kana") or "").strip(),
                "example_jp": str(row.get("example_jp") or "").strip(),
            }
        )
    return cleaned


def build_jobs(rows, kind):
    jobs = []
    if kind in ("words", "both"):
        jobs.extend(
            (row["reading_kana"], os.path.join(OUT_WORDS, f'{row["id"]}.mp3'), "word", row["id"])
            for row in rows
            if row["reading_kana"]
        )
    if kind in ("examples", "both"):
        jobs.extend(
            (row["example_jp"], os.path.join(OUT_EXAMPLES, f'{row["id"]}.mp3'), "example", row["id"])
            for row in rows
            if row["example_jp"]
        )
    return jobs


async def synth(text, path, audio_kind, word_id, sem, stats, args):
    if not args.force and os.path.exists(path) and os.path.getsize(path) > 0:
        stats["skip"] += 1
        return
    async with sem:
        tmp = path + ".part"
        for attempt in range(1, args.retries + 1):
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
                communicate = edge_tts.Communicate(text, args.voice, rate=args.rate)
                await communicate.save(tmp)
                if not os.path.exists(tmp) or os.path.getsize(tmp) == 0:
                    raise RuntimeError("edge-tts returned an empty file")
                os.replace(tmp, path)
                stats["ok"] += 1
                stats["created_items"].append(
                    {
                        "id": word_id,
                        "kind": audio_kind,
                        "text": text,
                        "file": os.path.relpath(path, ROOT),
                    }
                )
                return
            except Exception as exc:  # noqa: BLE001
                if os.path.exists(tmp):
                    os.remove(tmp)
                if attempt == args.retries:
                    stats["fail"] += 1
                    stats["failures"].append(
                        {"id": word_id, "kind": audio_kind, "text": text, "error": str(exc)}
                    )
                    print(f"FAIL {path}: {exc}", flush=True)
                else:
                    await asyncio.sleep(1.5 * attempt)


async def main():
    args = parse_args()
    os.makedirs(OUT_WORDS, exist_ok=True)
    os.makedirs(OUT_EXAMPLES, exist_ok=True)

    source = os.path.abspath(args.words) if args.words else os.path.abspath(args.db)
    rows = clean_rows(read_word_rows(args.words) if args.words else read_db_rows(args.db))
    source_rows = len(rows)
    if args.ids:
        requested_ids = {value.strip() for value in args.ids.split(",") if value.strip()}
        available_ids = {row["id"] for row in rows}
        missing_ids = sorted(requested_ids - available_ids)
        if missing_ids:
            raise ValueError(f"--ids contains unknown word IDs: {', '.join(missing_ids)}")
        rows = [row for row in rows if row["id"] in requested_ids]
    if args.new_vs_db:
        existing_ids = active_db_ids(args.new_vs_db)
        rows = [row for row in rows if row["id"] not in existing_ids]

    jobs = build_jobs(rows, args.kind)
    preexisting = 0 if args.force else sum(
        os.path.exists(path) and os.path.getsize(path) > 0 for _, path, _, _ in jobs
    )
    planned = len(jobs) - preexisting
    print(
        f"source_rows={source_rows} selected_rows={len(rows)} jobs={len(jobs)} "
        f"preexisting={preexisting} planned={planned} kind={args.kind}",
        flush=True,
    )

    stats = {"ok": 0, "skip": 0, "fail": 0, "failures": [], "created_items": []}
    started = datetime.now(timezone.utc)
    if not args.dry_run:
        sem = asyncio.Semaphore(args.concurrency)
        chunk_size = 50
        for index in range(0, len(jobs), chunk_size):
            chunk = jobs[index : index + chunk_size]
            await asyncio.gather(
                *(
                    synth(text, path, audio_kind, word_id, sem, stats, args)
                    for text, path, audio_kind, word_id in chunk
                )
            )
            done = min(index + chunk_size, len(jobs))
            print(
                f"progress {done}/{len(jobs)} ok={stats['ok']} "
                f"skip={stats['skip']} fail={stats['fail']}",
                flush=True,
            )

    ended = datetime.now(timezone.utc)
    report = {
        "generated_at": ended.isoformat(),
        "source": source,
        "new_vs_db": os.path.abspath(args.new_vs_db) if args.new_vs_db else None,
        "kind": args.kind,
        "voice": args.voice,
        "rate": args.rate,
        "source_rows": source_rows,
        "selected_rows": len(rows),
        "jobs": len(jobs),
        "preexisting": preexisting,
        "planned": planned,
        "created": stats["ok"],
        "skipped": stats["skip"],
        "failed": stats["fail"],
        "failures": stats["failures"],
        "created_items": stats["created_items"],
        "elapsed_seconds": round((ended - started).total_seconds(), 3),
        "dry_run": args.dry_run,
    }
    if args.report:
        os.makedirs(os.path.dirname(os.path.abspath(args.report)), exist_ok=True)
        with open(args.report, "w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    print(
        f"DONE jobs={len(jobs)} ok={stats['ok']} skip={stats['skip']} fail={stats['fail']}",
        flush=True,
    )
    return 1 if stats["fail"] else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
