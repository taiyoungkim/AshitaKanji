#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MISSING_PATH = resolve(ROOT, 'data/pdf-vocab/naver_examples_final_misses.json');
const WORDS_PATH = resolve(ROOT, 'data/pdf-vocab/jlpt_final_wordlist.json');
const OUTPUT_PATH = resolve(ROOT, 'data/pdf-vocab/example_reference_audit.json');

const QUERY_VARIANTS = {
  かたかな: ['カタカナ'],
  塵紙: ['ちり紙', 'ちりがみ'],
  組合せ: ['組み合わせ'],
  打合せ: ['打ち合わせ'],
  引算: ['引き算'],
  銘々: ['めいめい'],
  目覚し: ['目覚まし', '目覚まし時計'],
  裏づけ: ['裏付け'],
  じゃまする: ['邪魔する'],
  ないしょにする: ['内緒にする'],
  手足まとい: ['足手まとい', '足手纏い'],
  木よう日: ['木曜日'],
  後の別の日にやる: ['別の日に'],
  多すぎて残る: ['多すぎる'],
  横断禁止です: ['横断禁止'],
  ダイヤグラム: ['ダイアグラム'],
  怒ったような顔をする: ['怒った顔'],
  一度に大勢来る: ['大勢来る', '殺到する'],
  便利で役に立つ: ['役に立つ'],
  意外につまらない: ['つまらない'],
  細かく丁寧に: ['丁寧に'],
  熱心に取り組む: ['取り組む'],
  曇っていて暗い: ['曇っている'],
  非常に素晴らしいとほめる: ['絶賛する', 'ほめる'],
};

const missing = JSON.parse(readFileSync(MISSING_PATH, 'utf8')).items;
const wordsDocument = JSON.parse(readFileSync(WORDS_PATH, 'utf8'));
const words = Array.isArray(wordsDocument) ? wordsDocument : wordsDocument.vocabulary;
const byId = new Map(words.map((word) => [word.id, word]));

const tasks = missing.map((item) => {
  const word = byId.get(item.word_id);
  if (!word) throw new Error(`Missing final word metadata for ${item.word_id}`);
  return {
    word_id: item.word_id,
    level: word.level,
    surface: word.surface,
    reading_kana: word.reading_kana,
    meaning_ko: word.meaning_ko,
    queries: [...new Set([word.surface, ...(QUERY_VARIANTS[word.surface] ?? [])])],
  };
});

async function searchTatoeba(query) {
  const url = new URL('https://api.tatoeba.org/v1/sentences');
  url.searchParams.set('lang', 'jpn');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('is_orphan', 'no');
  url.searchParams.set('is_unapproved', 'no');
  url.searchParams.set('limit', '5');

  const response = await fetch(url, {
    headers: { 'user-agent': 'AshitaKanji-example-reference-audit/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Tatoeba ${response.status} for ${query}: ${await response.text()}`);
  }
  const payload = await response.json();
  return {
    query,
    search_url: `https://tatoeba.org/en/sentences/search?from=jpn&query=${encodeURIComponent(query)}`,
    api_url: url.toString(),
    total: payload.paging?.total ?? 0,
    candidates: (payload.data ?? []).map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      owner: sentence.owner,
      license: sentence.license,
      sentence_url: `https://tatoeba.org/en/sentences/show/${sentence.id}`,
    })),
  };
}

async function worker(queue, results) {
  while (queue.length > 0) {
    const index = queue.shift();
    const target = tasks[index];
    const searches = [];
    for (const query of target.queries) {
      try {
        searches.push(await searchTatoeba(query));
      } catch (error) {
        searches.push({
          query,
          search_url: `https://tatoeba.org/en/sentences/search?from=jpn&query=${encodeURIComponent(query)}`,
          total: null,
          candidates: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    results[index] = { ...target, searches };
  }
}

const queue = tasks.map((_, index) => index);
const results = Array(tasks.length);
// The public API throttles bursty clients. Keep this audit intentionally serial
// so every target receives a real result instead of a timeout artifact.
await worker(queue, results);

const exactHits = results.filter((item) => item.searches[0].total > 0).length;
const anyHits = results.filter((item) => item.searches.some((search) => search.total > 0)).length;
const output = {
  generated_at: new Date().toISOString(),
  purpose: 'Usage-reference audit only; final app examples are original editorial sentences.',
  sources: [
    {
      name: 'Tatoeba',
      url: 'https://tatoeba.org/en/terms_of_use',
      license_note: 'Text sentences default to CC BY 2.0 FR and require attribution when reused.',
    },
    {
      name: 'WWWJDIC / EDRDG',
      url: 'https://www.edrdg.org/wwwjdic/wwwjdicinf.html',
      license_note: 'Used as a supplementary dictionary and corpus reference.',
    },
  ],
  target_count: tasks.length,
  exact_hit_count: exactHits,
  any_variant_hit_count: anyHits,
  items: results,
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  output: OUTPUT_PATH,
  target_count: tasks.length,
  exact_hit_count: exactHits,
  any_variant_hit_count: anyHits,
}, null, 2));
