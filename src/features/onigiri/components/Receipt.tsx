// Design Ref: Onikan handoff 화면 3 (`7a`) — 영수증 종이.
//
// 영수증은 선택지가 아니라 결과물이다. 반경 4px 는 이 컴포넌트 전용 —
// 그 하나가 "종이"라는 신호를 전담하므로 다른 어디에도 쓰지 않는다.

import { StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconCheck } from '~/design/icons';
import { ProgressCells } from '~/components/ui/Surface';

export interface ReceiptRow {
  label: string;
  value: string | number | null;
  /** 보상 행 — 라임 체크 배지를 붙인다. */
  reward?: boolean;
}

interface Props {
  dateLabel: string;
  rows: readonly ReceiptRow[];
  recipeName: string;
  ingredientCount: number;
  ingredientTotal: number;
  footerNote: string;
  streakLabel: string | null;
}

export function Receipt({
  dateLabel,
  rows,
  recipeName,
  ingredientCount,
  ingredientTotal,
  footerNote,
  streakLabel,
}: Props): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const visible = rows.filter((r) => r.value !== null && r.value !== '');

  return (
    <View style={styles.paper}>
      <Text style={styles.wordmark}>ONIGIRI SHOP</Text>
      <Text style={styles.date}>{dateLabel}</Text>

      <View style={styles.sectionBreak} />

      <View>
        {visible.map((row, i) => (
          <View key={row.label} style={[styles.row, i > 0 && styles.rowDivided]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <View style={styles.rowValueWrap}>
              <Text style={styles.rowValue}>{row.value}</Text>
              {row.reward && (
                <View style={styles.rewardBadge}>
                  <IconCheck size={14} color={colors.onSecondary} />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.sectionBreak} />

      <View style={styles.recipeBlock}>
        <View style={styles.recipeHead}>
          <Text style={styles.recipeName}>{recipeName}</Text>
          <Text style={styles.recipeCount}>
            {ingredientCount} / {ingredientTotal}
          </Text>
        </View>
        <ProgressCells
          total={ingredientTotal}
          filled={ingredientCount}
          height={6}
          gap={6}
          fill="ink"
        />
      </View>

      <Text style={styles.footerNote}>{footerNote}</Text>
      {streakLabel && <Text style={styles.thanks}>THANK YOU · {streakLabel}</Text>}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    paper: {
      backgroundColor: c.canvas,
      borderRadius: radius.receipt,
      paddingTop: 30,
      paddingHorizontal: 24,
      paddingBottom: 26,
    },
    wordmark: {
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: 3,
      color: c.ink,
      textAlign: 'center',
    },
    date: { ...typography.receipt, color: c.body, textAlign: 'center', marginTop: spacing.xs },

    // 섹션 경계만 점선, 행 사이는 실선 — 종이의 결을 두 단계로 나눈다.
    sectionBreak: {
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderTopColor: c.pressed,
      marginVertical: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: 10,
    },
    rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.soft },
    rowLabel: { ...typography.receipt, color: c.body, flexShrink: 1 },
    rowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowValue: { fontFamily: font.semibold, fontSize: 13, lineHeight: 20, color: c.ink },
    rewardBadge: {
      width: 20,
      height: 20,
      borderRadius: radius.pill,
      backgroundColor: c.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    recipeBlock: { gap: spacing.sm },
    recipeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    recipeName: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: c.ink },
    recipeCount: { ...typography.receipt, color: c.body },

    footerNote: {
      ...typography.receipt,
      color: c.body,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
    thanks: {
      fontFamily: font.medium,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 2.4,
      color: c.body,
      textAlign: 'center',
      marginTop: spacing.md,
    },
  });
