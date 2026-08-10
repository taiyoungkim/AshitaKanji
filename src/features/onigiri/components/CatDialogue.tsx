// Design Ref: Onikan — 사장 인사. 손그림 선화 마스코트가 유일한 일러스트 시스템이다.

import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { Button } from '~/components/ui/Button';
import { catAspectRatio, catImages } from '../catAssets';
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
  const styles = useThemedStyles(makeStyles);
  // 화면 높이 28%로 고정 → 기기 무관 일정 크기. 세로 과대/버튼 가림 방지.
  const catHeight = Math.round(height * 0.28);

  return (
    <View style={[styles.stage, style]}>
      <View style={[styles.plate, { height: catHeight + 24 }]}>
        <Image
          source={catImages[pose]}
          resizeMode="contain"
          style={[{ height: catHeight, aspectRatio: catAspectRatio(pose) }, imageStyle]}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.line}>{line}</Text>
        <Text style={styles.speaker}>— {speaker}</Text>
      </View>
      {buttonLabel && onContinue && (
        <Button label={buttonLabel} onPress={onContinue} style={styles.button} />
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingVertical: layout.gutter,
      paddingHorizontal: layout.gutter,
    },
    // 검정 선화라 다크에서도 밝은 plate 위에 올려야 그림이 살아남는다.
    plate: {
      backgroundColor: c.plate,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    copy: { alignItems: 'center' },
    line: { ...typography.reading, color: c.ink, textAlign: 'center' },
    speaker: { ...typography.body, color: c.body, marginTop: 6, textAlign: 'center' },
    button: { alignSelf: 'stretch' },
  });
