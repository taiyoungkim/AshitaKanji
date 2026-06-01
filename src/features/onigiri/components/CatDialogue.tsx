import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { buttons, colors, spacing, typography } from '~/design/tokens';
import { catImages } from '../catAssets';
import type { CatPose } from '../types';

interface Props {
  line: string;
  pose?: CatPose;
  speaker?: string;
  buttonLabel?: string;
  onContinue?: () => void;
  imageStyle?: StyleProp<ImageStyle>;
  style?: StyleProp<ViewStyle>;
}

export function CatDialogue({
  line,
  pose = 'calm',
  speaker = '사장',
  buttonLabel,
  onContinue,
  imageStyle,
  style,
}: Props): React.ReactNode {
  const { height } = useWindowDimensions();
  // 화면 높이 28%로 고정 → 기기 무관 일정 크기. 세로 과대/버튼 가림 방지.
  const catHeight = Math.round(height * 0.28);
  return (
    <View style={[styles.stage, style]}>
      <Image
        source={catImages[pose]}
        resizeMode="contain"
        style={[styles.cat, { height: catHeight }, imageStyle]}
      />
      <View style={styles.copy}>
        <Text style={styles.line}>{line}</Text>
        <Text style={styles.speaker}>— {speaker}</Text>
      </View>
      {buttonLabel && onContinue && (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={onContinue}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  cat: {
    // height는 인라인(화면 28%), aspectRatio(원본 482:745)가 width 산출. alignSelf 중앙.
    aspectRatio: 482 / 745,
    alignSelf: 'center',
  },
  copy: {
    alignItems: 'center',
  },
  line: {
    ...typography.body,
    color: colors.text,
    lineHeight: 30,
    textAlign: 'center',
  },
  speaker: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  button: {
    minWidth: 160,
    borderRadius: buttons.secondary.borderRadius,
    borderWidth: 1,
    borderColor: buttons.secondary.borderColor,
    paddingVertical: buttons.secondary.paddingVertical,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.text,
  },
});
