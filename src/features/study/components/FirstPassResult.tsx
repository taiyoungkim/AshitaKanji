// 1차 학습 종료 → 중간 결과 (learning-flow-home-ux STEP 1-B).
//
// 최종 완료 화면(/done)과 구분된다 — 재료·영수증·광고 없이 고양이 사장님, 숫자 두 개, CTA 하나만.
// 닫기는 남겨 둔다. 1차 결과는 이미 저장됐으므로 나가도 학습 기록·보상은 유지된다.
// 디자인: Figma 오니기리-칸지 node 610-7404.

import { Image, StyleSheet, Text, View } from 'react-native';
import { font, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Surface';
import { StudyProgressHeader } from './StudyProgressHeader';

const CAT_IMAGE = require('../../../../assets/onigiri/cat-thanks.png');

interface Props {
  learnedCount: number;
  againCount: number;
  onContinue: () => void;
  onClose: () => void;
  disabled?: boolean;
}

export function FirstPassResult({
  learnedCount,
  againCount,
  onContinue,
  onClose,
  disabled,
}: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const total = learnedCount + againCount;
  return (
    <View style={styles.root}>
      <StudyProgressHeader done={total} total={total} onClose={onClose} closeLabel="학습 나가기" />
      <View style={styles.body}>
        <Image
          source={CAT_IMAGE}
          style={styles.cat}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <Text style={styles.title} accessibilityRole="header">
          오늘의 단어를 한 번 살펴봤어요!
        </Text>
        <Card variant="elevated" style={styles.stats}>
          <StatRow label="한 번 익힌 단어" value={learnedCount} />
          <View style={styles.divider} />
          <StatRow label="다시 볼 단어" value={againCount} />
        </Card>
        <Text style={styles.lead}>어떤 단어가 기억나는지 확인해 볼까요?</Text>
      </View>
      <View style={styles.cta}>
        <Button label="기억 확인하기" onPress={onContinue} disabled={disabled} />
      </View>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: number }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label} ${value}개`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}개</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: layout.gutter,
    },
    cat: { width: 184, height: 184, alignSelf: 'center' },
    title: {
      ...typography.listTitle,
      fontFamily: font.bold,
      color: c.ink,
      textAlign: 'center',
      marginTop: spacing.huge,
    },
    stats: { paddingHorizontal: 22, paddingVertical: spacing.sm, marginTop: spacing.xl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    rowLabel: { ...typography.body, color: c.body },
    rowValue: { ...typography.cardTitle, color: c.ink, fontVariant: ['tabular-nums'] },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.pressed },
    lead: { ...typography.body, color: c.body, textAlign: 'center', marginTop: spacing.lg },
    cta: {
      paddingHorizontal: layout.gutter,
      paddingTop: layout.gutter,
      paddingBottom: spacing.xxl,
    },
  });
