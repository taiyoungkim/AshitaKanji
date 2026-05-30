// Design Ref: §12 Done 화면 — 세션 완료 도파민 피드백 (Reanimated 진입 애니메이션).
// Plan SC: "오늘 완료" = Main + Again 미니라운드 소진. 요약 + streak 표시.
//
// 요약은 SessionStore.summary 에서 읽음. 직접 진입(요약 없음)이면 폴백 후 닫기.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSessionStore } from '~/stores/SessionStore';

export default function DoneScreen(): React.ReactNode {
  const router = useRouter();
  const summary = useSessionStore((s) => s.summary);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/study');
  };

  if (!summary) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>👍</Text>
        <Text style={styles.title}>수고했어요</Text>
        <Pressable style={styles.closeBtn} onPress={close}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>
    );
  }

  const minutes = Math.max(1, Math.round(summary.durationSec / 60));

  return (
    <View style={styles.container}>
      <Animated.Text entering={ZoomIn.springify().damping(8)} style={styles.emoji}>
        🎉
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(120)} style={styles.title}>
        오늘 끝!
      </Animated.Text>

      {summary.streakDays > 1 && (
        <Animated.Text entering={FadeInDown.delay(200)} style={styles.streak}>
          🔥 {summary.streakDays}일 연속
        </Animated.Text>
      )}

      <Animated.View entering={FadeIn.delay(300)} style={styles.statRow}>
        <Stat value={summary.newCount} label="새 단어" />
        <Stat value={summary.reviewCount} label="복습" />
        <Stat value={summary.goodEasyCount} label="잘 맞춤" />
      </Animated.View>

      <Animated.Text entering={FadeIn.delay(400)} style={styles.duration}>
        {minutes}분 집중
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(500)} style={styles.closeWrap}>
        <Pressable
          style={styles.statsBtn}
          onPress={() => router.replace('/(tabs)/stats')}
          accessibilityRole="button"
        >
          <Text style={styles.statsText}>통계 보기</Text>
        </Pressable>
        <Pressable style={styles.closeBtn} onPress={close}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }): React.ReactNode {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f7',
    padding: 24,
    gap: 14,
  },
  emoji: { fontSize: 72 },
  title: { fontSize: 32, fontWeight: '800', color: '#1a1a1a' },
  streak: { fontSize: 18, fontWeight: '700', color: '#e76f51' },
  statRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  stat: {
    backgroundColor: 'white',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 4,
    minWidth: 84,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: '#0366d6' },
  statLabel: { fontSize: 13, color: '#888' },
  duration: { fontSize: 15, color: '#666', marginTop: 4 },
  closeWrap: { marginTop: 20, alignItems: 'center', gap: 10 },
  statsBtn: {
    backgroundColor: '#eef2f6',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 48,
  },
  statsText: { color: '#0366d6', fontSize: 15, fontWeight: '700' },
  closeBtn: {
    backgroundColor: '#0366d6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  closeText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
