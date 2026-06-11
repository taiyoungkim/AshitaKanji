// Design Ref: ONIGIRI SHOP redesign — 05 Cat Owner Dialogue (앱 인트로).
// 매 실행마다 항상 첫 화면으로 노출. "시작하기" → 홈.
// 첫 실행(튜토리얼 미완료)이면 가게 소개 대사 + Continue → /tutorial.

import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '~/design/tokens';
import { useSettingsStore } from '~/stores/SettingsStore';
import { CatDialogue } from '~/features/onigiri/components';

export default function IntroScreen(): React.ReactNode {
  const router = useRouter();
  const hydrated = useSettingsStore((s) => s._hydrated);
  const tutorialCompleted = useSettingsStore((s) => s.tutorialCompleted);

  // persist 복원 전엔 분기 보류 — 기존 사용자에게 튜토리얼 오노출 방지.
  const showTutorial = hydrated && !tutorialCompleted;

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
        <CatDialogue
          line={'왔네. 어서 와.\n천천히 둘러봐.'}
          pose="calm"
          buttonLabel="시작하기"
          onContinue={() => router.replace('/home')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
