#!/usr/bin/env python3
"""Audit every active example TTS file against the bundled JLPT database."""

import argparse
import concurrent.futures
import json
import os
import re
import sqlite3
import subprocess
from datetime import datetime, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.join(ROOT, "assets", "jlpt.db")
DEFAULT_AUDIO_DIR = os.path.join(ROOT, "assets", "audio", "examples")
DEFAULT_AUDIO_MAP = os.path.join(ROOT, "src", "lib", "audio", "audioMap.gen.android.ts")
DEFAULT_REPORT = os.path.join(ROOT, "data", "pdf-vocab", "example_tts_validation_report.json")
ID_RE = re.compile(r"^w_[0-9a-f]{16}$")


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--audio-dir", default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--audio-map", default=DEFAULT_AUDIO_MAP)
    parser.add_argument("--extension", choices=("mp3", "ogg"), default="ogg")
    parser.add_argument("--codec", choices=("mp3", "opus"), default="opus")
    parser.add_argument("--generation-report")
    parser.add_argument("--report", default=DEFAULT_REPORT)
    parser.add_argument("--workers", type=int, default=12)
    return parser.parse_args()


def read_expected(db_path):
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT w.id, w.example_jp, w.example_ko, e.source, e.permission_status
            FROM word w
            LEFT JOIN word_example e ON e.word_id = w.id AND e.sort_order = 0
            WHERE w.deprecated = 0
            ORDER BY w.id
            """
        ).fetchall()
    return {
        row[0]: {
            "jp": (row[1] or "").strip(),
            "ko": (row[2] or "").strip(),
            "source": row[3] or "",
            "permission_status": row[4] or "",
        }
        for row in rows
    }


def read_map_ids(path, extension):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    pattern = rf"assets/audio/examples/(w_[0-9a-f]{{16}})\.{re.escape(extension)}"
    return set(re.findall(pattern, text))


def probe(path, expected_codec):
    completed = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size:stream=codec_name,codec_type,duration",
            "-of",
            "json",
            path,
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )
    if completed.returncode != 0:
        return {"ok": False, "error": completed.stderr.strip() or f"exit {completed.returncode}"}
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        return {"ok": False, "error": f"invalid ffprobe JSON: {exc}"}
    audio_streams = [
        stream for stream in payload.get("streams", []) if stream.get("codec_type") == "audio"
    ]
    duration = float(payload.get("format", {}).get("duration") or 0)
    size = int(payload.get("format", {}).get("size") or os.path.getsize(path))
    codec = audio_streams[0].get("codec_name") if audio_streams else None
    ok = bool(audio_streams) and codec == expected_codec and duration > 0 and size > 0
    return {
        "ok": ok,
        "codec": codec,
        "duration": duration,
        "size": size,
        "error": None if ok else f"missing {expected_codec} audio stream, duration, or payload",
    }


def main():
    args = parse_args()
    if args.workers < 1:
        raise SystemExit("--workers must be at least 1")

    expected = read_expected(os.path.abspath(args.db))
    expected_ids = set(expected)
    suffix = f".{args.extension}"
    physical_names = [name for name in os.listdir(args.audio_dir) if name.endswith(suffix)]
    physical_ids = {
        name[: -len(suffix)]
        for name in physical_names
        if ID_RE.match(name[: -len(suffix)])
    }
    part_files = sorted(name for name in os.listdir(args.audio_dir) if name.endswith(".part"))
    map_ids = read_map_ids(args.audio_map, args.extension)

    invalid = []
    for word_id, row in expected.items():
        if not row["jp"] or not row["ko"]:
            invalid.append({"id": word_id, "check": "example_text", "error": "missing JP/KO"})
        path = os.path.join(args.audio_dir, f"{word_id}{suffix}")
        if word_id not in physical_ids:
            invalid.append(
                {"id": word_id, "check": "file", "error": f"missing {args.extension}"}
            )
        elif os.path.getsize(path) <= 0:
            invalid.append(
                {"id": word_id, "check": "file", "error": f"zero-byte {args.extension}"}
            )
        if word_id not in map_ids:
            invalid.append({"id": word_id, "check": "audio_map", "error": "missing mapping"})

    probe_results = {}
    probe_ids = sorted(expected_ids & physical_ids)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_by_id = {
            executor.submit(
                probe,
                os.path.join(args.audio_dir, f"{word_id}{suffix}"),
                args.codec,
            ): word_id
            for word_id in probe_ids
        }
        for index, future in enumerate(concurrent.futures.as_completed(future_by_id), start=1):
            word_id = future_by_id[future]
            try:
                result = future.result()
            except Exception as exc:  # noqa: BLE001
                result = {"ok": False, "error": str(exc)}
            probe_results[word_id] = result
            if not result["ok"]:
                invalid.append({"id": word_id, "check": "ffprobe", "error": result["error"]})
            if index % 500 == 0 or index == len(probe_ids):
                print(f"ffprobe {index}/{len(probe_ids)} invalid={len(invalid)}", flush=True)

    generation = None
    generation_mismatches = []
    if args.generation_report:
        with open(args.generation_report, encoding="utf-8") as handle:
            generation = json.load(handle)
        created_items = generation.get("created_items", [])
        created_ids = set()
        for item in created_items:
            word_id = item.get("id")
            created_ids.add(word_id)
            current = expected.get(word_id)
            if not current or item.get("kind") != "example" or item.get("text") != current["jp"]:
                generation_mismatches.append(
                    {
                        "id": word_id,
                        "generated_text": item.get("text"),
                        "current_text": current.get("jp") if current else None,
                    }
                )
        if len(created_ids) != len(created_items):
            generation_mismatches.append({"check": "duplicate created IDs"})

    durations = [result["duration"] for result in probe_results.values() if result.get("ok")]
    sizes = [result["size"] for result in probe_results.values() if result.get("ok")]
    codecs = {}
    for result in probe_results.values():
        codec = result.get("codec") or "(none)"
        codecs[codec] = codecs.get(codec, 0) + 1

    source_counts = {}
    for row in expected.values():
        key = f'{row["source"]}:{row["permission_status"]}'
        source_counts[key] = source_counts.get(key, 0) + 1

    passed = (
        len(expected) == 6638
        and len(probe_results) == len(expected)
        and not invalid
        and not part_files
        and not generation_mismatches
        and (not generation or generation.get("failed") == 0)
    )
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "passed": passed,
        "voice": generation.get("voice") if generation else None,
        "rate": generation.get("rate") if generation else None,
        "audio_extension": args.extension,
        "expected_codec": args.codec,
        "active_examples": len(expected),
        "source_counts": source_counts,
        "physical_audio_files": len(physical_ids),
        "active_audio_files": len(expected_ids & physical_ids),
        "active_audio_map_entries": len(expected_ids & map_ids),
        "audio_map_entries": len(map_ids),
        "ffprobe_valid": sum(bool(result.get("ok")) for result in probe_results.values()),
        "codec_counts": codecs,
        "duration_seconds": {
            "min": round(min(durations), 3) if durations else None,
            "max": round(max(durations), 3) if durations else None,
            "average": round(sum(durations) / len(durations), 3) if durations else None,
            "total": round(sum(durations), 3),
        },
        "active_bytes": sum(sizes),
        "part_files": part_files,
        "invalid_items": invalid,
        "generation_report": {
            "path": os.path.relpath(args.generation_report, ROOT),
            "created": generation.get("created"),
            "skipped": generation.get("skipped"),
            "failed": generation.get("failed"),
            "elapsed_seconds": generation.get("elapsed_seconds"),
            "created_text_matches": len(generation.get("created_items", []))
            - len(generation_mismatches),
            "text_mismatches": generation_mismatches,
        }
        if generation
        else None,
        "orphan_audio_count": len(physical_ids - expected_ids),
        "orphan_audio_ids": sorted(physical_ids - expected_ids),
        "orphan_map_count": len(map_ids - expected_ids),
        "missing_files": sorted(expected_ids - physical_ids),
        "missing_map_entries": sorted(expected_ids - map_ids),
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.report)), exist_ok=True)
    with open(args.report, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({key: report[key] for key in [
        "passed",
        "active_examples",
        "audio_extension",
        "active_audio_files",
        "active_audio_map_entries",
        "ffprobe_valid",
        "codec_counts",
        "part_files",
        "orphan_audio_count",
    ]}, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
