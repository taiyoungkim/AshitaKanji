// Design Ref: Onikan — 앱 인트로 (사장 인사).
// 매 실행마다 항상 첫 화면으로 노출. 재방문 유저는 스플래시처럼 클릭 없이
// 잠시 후 자동으로 홈 이동 (탭하면 즉시 스킵). 첫 실행(튜토리얼 미완료)만 Continue 버튼.

import { useCallback, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useSettingsStore } from '~/stores/SettingsStore';
import { CatDialogue } from '~/features/onigiri/components';
import { onboardingImages } from './onboardingAssets';

// 자동 전환 대기 — 인사 한 줄 읽을 정도만.
const AUTO_ADVANCE_MS = 1800;

export default function IntroScreen(): React.ReactNode {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
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
  //
  // useEffect 로 걸면 안 된다. 인트로는 튜토리얼·학습 화면 아래에 계속 살아 있어서,
  // 튜토리얼을 마치는 순간 tutorialCompleted 가 true 로 바뀌며 showTutorial 이 false 가 되고
  // 이 화면이 보이지도 않는 상태에서 타이머를 걸어 1.8초 뒤 학습 화면을 홈으로 갈아치웠다.
  // 포커스가 실제로 이 화면에 있을 때만 센다.
  useFocusEffect(
    useCallback(() => {
      if (!hydrated || showTutorial) return;
      const t = setTimeout(goHome, AUTO_ADVANCE_MS);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrated, showTutorial]),
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {showTutorial ? (
        <CatDialogue
          line={'왔네.\n여긴 오니기리 가게야.\n단어를 외우면 재료가 쌓여.'}
          pose="calm"
          imageSource={onboardingImages.intro}
          imageAspectRatio={1}
          framed={false}
          buttonLabel="시작하기"
          onContinue={() => router.push('/tutorial')}
        />
      ) : (
        <Pressable
          style={styles.fill}
          onPress={goHome}
          accessibilityRole="button"
          accessibilityLabel="홈으로 이동"
        >
          <CatDialogue
            line={'왔네. 어서 와.\n천천히 둘러봐.'}
            pose="calm"
            imageSource={onboardingImages.intro}
            imageAspectRatio={1}
            framed={false}
          />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },
    fill: { flex: 1 },
  });
