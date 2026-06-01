// Design Ref: ONIGIRI SHOP redesign — 05 Cat Owner Dialogue (앱 인트로).
// 매 실행마다 항상 첫 화면으로 노출. "시작하기" → 홈.

import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '~/design/tokens';
import { CatDialogue } from '~/features/onigiri/components';

export default function IntroScreen(): React.ReactNode {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <CatDialogue
        line={'왔네. 어서 와.\n천천히 둘러봐.'}
        pose="calm"
        buttonLabel="시작하기"
        onContinue={() => router.replace('/home')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
