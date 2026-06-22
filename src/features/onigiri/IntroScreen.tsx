// Design Ref: ONIGIRI SHOP redesign — 05 Cat Owner Dialogue (앱 인트로).
// 매 실행마다 항상 첫 화면으로 노출. 재방문 유저는 스플래시처럼 클릭 없이
// 잠시 후 자동으로 홈 이동 (탭하면 즉시 스킵). 첫 실행(튜토리얼 미완료)만 Continue 버튼.

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '~/design/tokens';
import { useSettingsStore } from '~/stores/SettingsStore';
import { CatDialogue } from '~/features/onigiri/components';

// 자동 전환 대기 — 인사 한 줄 읽을 정도만.
const AUTO_ADVANCE_MS = 1800;

export default function IntroScreen(): React.ReactNode {
  const router = useRouter();
  const hydrated = useSettingsStore((s) => s._hydrated);
  const tutorialCompleted = useSettingsStore((s) => s.tutorialCompleted);
  const navigated = useRef(false);

  // persist 복원 전엔 분기 보류 — 기존 사용자에게 튜토리얼 오노출 방지.
  const showTutorial = hydrated && !tutorialCompleted;

  const goHome = () => {
    // 타이머/탭 중복 전환 방지.
    if (navigated.current) return;
    navigated.current = true;
    router.replace('/home');
  };

  // 재방문 유저: 타이머로 자동 전환 (persist 복원 완료 후부터 카운트).
  useEffect(() => {
    if (!hydrated || showTutorial) return;
    const t = setTimeout(goHome, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, showTutorial]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {showTutorial ? (
        <CatDialogue
          line={'왔네.\n여긴 오니기리 가게야. 단어를 외우면 재료가 쌓여.'}
          pose="calm"
          buttonLabel="Continue"
          onContinue={() => router.push('/tutorial')}
        />
      ) : (
        <Pressable
          style={styles.fill}
          onPress={goHome}
          accessibilityRole="button"
          accessibilityLabel="홈으로 이동"
        >
          <CatDialogue line={'왔네. 어서 와.\n천천히 둘러봐.'} pose="calm" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
});
