// Design Ref: §11.3 module-2 — 미니 스토리북 (dev 전용 카드 프리뷰)
// A~E 5종 샘플 + reveal 토글. 실제 세션 로직 없음. /( _dev/cards ) 경로로 확인.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Word } from '~/types/Card';
import { Card } from '~/components/card/Card';

function sample(partial: Pick<Word, 'id' | 'surface' | 'reading_kana' | 'meaning_ko' | 'card_type'>): Word {
  return {
    level: 'N5',
    furigana: null,
    part_of_speech: null,
    example_jp: '毎日勉強する。',
    example_ko: '매일 공부한다.',
    example_jp_id: 123,
    example_jp_author: 'contrib123',
    example_ko_id: null,
    example_ko_author: null,
    example_license: 'CC-BY-2.0-FR',
    alt_forms: null,
    disambig: null,
    source: 'dev:sample',
    qa_status: 'verified',
    deprecated: 0,
    tags: null,
    data_version: 0,
    ...partial,
  };
}

const SAMPLES: Word[] = [
  sample({ id: 'a', surface: '勉強', reading_kana: 'べんきょう', meaning_ko: '공부', card_type: 'A' }),
  sample({ id: 'b', surface: '食べる', reading_kana: 'たべる', meaning_ko: '먹다', card_type: 'B' }),
  sample({ id: 'c', surface: 'ありがとう', reading_kana: 'ありがとう', meaning_ko: '고마워', card_type: 'C' }),
  sample({ id: 'd', surface: 'テレビ', reading_kana: 'テレビ', meaning_ko: '텔레비전', card_type: 'D' }),
  sample({ id: 'e', surface: 'お土産', reading_kana: 'おみやげ', meaning_ko: '기념품', card_type: 'E' }),
];

export default function CardsStorybook(): React.ReactNode {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setRevealed((p) => ({ ...p, [id]: !p[id] }));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Card Storybook (A~E)</Text>
      {SAMPLES.map((w) => (
        <View key={w.id} style={styles.slot}>
          <Card
            word={w}
            revealed={!!revealed[w.id]}
            onReveal={() => toggle(w.id)}
            onSpeak={() => undefined}
          />
          <Pressable style={styles.resetBtn} onPress={() => toggle(w.id)}>
            <Text style={styles.resetText}>{revealed[w.id] ? '앞면으로' : 'reveal'}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 8 },
  heading: { fontSize: 18, fontWeight: '700', padding: 12 },
  slot: { height: 360, marginBottom: 12 },
  resetBtn: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
  resetText: { color: '#0366d6', fontSize: 13 },
});
