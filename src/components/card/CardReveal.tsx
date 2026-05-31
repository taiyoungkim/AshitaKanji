// Design Ref: §5.2 Card UX — reveal 후 (kana/뜻/예문/attribution/TTS)
// presentational: 데이터 표시만. TTS 실행은 onSpeak 콜백 (module-10 useTTS 주입).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Word } from '~/types/Card';
import { renderKanjiFace } from '~/lib/cardType';

interface Props {
  word: Word;
  onSpeak?: () => void;
  onSpeakExample?: () => void;
  onOpenDetail?: () => void;
}

function attributionLine(word: Word): string | null {
  // Plan SC: Tatoeba 예문은 문장별 출처 표기 (CC BY 2.0 FR)
  if (!word.example_jp) return null;
  const author = word.example_jp_author;
  const lic = word.example_license;
  if (!author && !lic) return null;
  const parts: string[] = [];
  if (author) parts.push(author.startsWith('NAVER') ? author : `© ${author}`);
  if (lic) parts.push(lic === 'self' ? '자체 제작' : lic === 'owner-confirmed-cleared' ? '사용 허가 확인' : lic);
  return parts.join(' · ');
}

export function CardReveal({ word, onSpeak, onSpeakExample, onOpenDetail }: Props): React.ReactNode {
  const attribution = attributionLine(word);
  return (
    <View style={styles.container}>
      {/* 표기·읽기 탭 → 발음 재생 (🔊 버튼과 동일 동작) */}
      <Pressable
        style={styles.speakable}
        onPress={onSpeak}
        accessibilityRole="button"
        accessibilityLabel="발음 듣기"
      >
        <Text style={styles.surface}>{renderKanjiFace(word)}</Text>
        <Text style={styles.reading}>{word.reading_kana}</Text>
      </Pressable>
      <Text style={styles.meaning}>{word.meaning_ko}</Text>

      {word.example_jp && (
        <View style={styles.exampleBox}>
          <Text
            style={styles.exampleJp}
            onPress={onSpeakExample}
            accessibilityRole="button"
            accessibilityLabel="예문 발음 듣기"
          >
            {word.example_jp}
          </Text>
          {word.example_ko && <Text style={styles.exampleKo}>{word.example_ko}</Text>}
          {attribution && <Text style={styles.attribution}>{attribution}</Text>}
        </View>
      )}

      <Pressable style={styles.ttsButton} onPress={onSpeak} accessibilityLabel="발음 듣기">
        <Text style={styles.ttsIcon}>🔊</Text>
      </Pressable>
      {onOpenDetail && (
        <Pressable
          style={styles.detailButton}
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel="단어 상세 보기"
        >
          <Text style={styles.detailButtonText}>단어 상세</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  speakable: { alignItems: 'center' },
  surface: { fontSize: 48, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  reading: { fontSize: 22, color: '#2a9d8f', marginTop: 8 },
  meaning: { fontSize: 20, color: '#1a1a1a', marginTop: 12, fontWeight: '600' },
  exampleBox: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    alignItems: 'center',
  },
  exampleJp: { fontSize: 16, color: '#333', textAlign: 'center' },
  exampleKo: { fontSize: 14, color: '#666', marginTop: 4, textAlign: 'center' },
  attribution: { fontSize: 11, color: '#aaa', marginTop: 8 },
  ttsButton: { marginTop: 20, padding: 8 },
  ttsIcon: { fontSize: 28 },
  detailButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#eef2f6',
  },
  detailButtonText: { fontSize: 14, color: '#0366d6', fontWeight: '700' },
});
