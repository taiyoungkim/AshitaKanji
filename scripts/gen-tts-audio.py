#!/usr/bin/env python3
# edge-tts(ja-JP-NanamiNeural)로 단어 읽기 + 예문 음성을 사전 생성.
# 출력: data/track-a/audio/words/<id>.mp3, data/track-a/audio/examples/<id>.mp3
# 재실행 시 이미 있는 파일은 건너뜀(resumable).
#
# 실행: /tmp/ttsenv/bin/python scripts/gen-tts-audio.py
# 의존: edge-tts (venv), sqlite3 CLI

import asyncio
import os
import subprocess
import json
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "assets", "jlpt.db")
OUT_WORDS = os.path.join(ROOT, "assets", "audio", "words")
OUT_EXAMPLES = os.path.join(ROOT, "assets", "audio", "examples")
VOICE = "ja-JP-NanamiNeural"
CONCURRENCY = 6
RATE = "+0%"

os.makedirs(OUT_WORDS, exist_ok=True)
os.makedirs(OUT_EXAMPLES, exist_ok=True)


def read_rows():
    sql = (
        "SELECT id, reading_kana, "
        "COALESCE(NULLIF(example_jp,''), '') AS ex "
        "FROM word WHERE deprecated = 0 ORDER BY level, id"
    )
    raw = subprocess.check_output(["sqlite3", "-json", DB, sql], text=True)
    return json.loads(raw or "[]")


async def synth(text, path, sem, stats):
    if not text or os.path.exists(path):
        if os.path.exists(path):
            stats["skip"] += 1
        return
    async with sem:
        for attempt in range(1, 4):
            try:
                tmp = path + ".part"
                communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
                await communicate.save(tmp)
                os.replace(tmp, path)
                stats["ok"] += 1
                return
            except Exception as e:  # noqa
                if attempt == 3:
                    stats["fail"] += 1
                    print(f"FAIL {path}: {e}", flush=True)
                else:
                    await asyncio.sleep(1.5 * attempt)


async def main():
    rows = read_rows()
    sem = asyncio.Semaphore(CONCURRENCY)
    stats = {"ok": 0, "skip": 0, "fail": 0}
    tasks = []
    for r in rows:
        wid = r["id"]
        reading = (r.get("reading_kana") or "").strip()
        ex = (r.get("ex") or "").strip()
        tasks.append(synth(reading, os.path.join(OUT_WORDS, f"{wid}.mp3"), sem, stats))
        if ex:
            tasks.append(synth(ex, os.path.join(OUT_EXAMPLES, f"{wid}.mp3"), sem, stats))

    total = len(tasks)
    done = 0
    # 진행 출력 위해 청크 단위 처리
    CHUNK = 50
    for i in range(0, total, CHUNK):
        await asyncio.gather(*tasks[i:i + CHUNK])
        done = min(i + CHUNK, total)
        print(f"progress {done}/{total} ok={stats['ok']} skip={stats['skip']} fail={stats['fail']}", flush=True)

    print(f"DONE total_tasks={total} ok={stats['ok']} skip={stats['skip']} fail={stats['fail']}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
