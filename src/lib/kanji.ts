const CJK_KANJI_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;

export function extractUniqueKanji(...texts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(CJK_KANJI_RE)) {
      const literal = match[0];
      if (seen.has(literal)) continue;
      seen.add(literal);
      out.push(literal);
    }
  }

  return out;
}

export function buildNaverJaDictSearchUrl(query: string): string {
  return `https://ja.dict.naver.com/#/search?query=${encodeURIComponent(query)}`;
}
