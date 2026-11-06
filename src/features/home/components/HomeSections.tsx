import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Button } from '~/components/ui/Button';
import { Card, Overline, PlateTile } from '~/components/ui/Surface';
import { IconChevron } from '~/design/icons';
import { HTML_FLOW_PAGE, font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import {
  ingredientEmptyImage,
  ingredientImage,
  ingredientName,
} from '~/features/onigiri/ingredientAssets';
import type { OnigiriCatalogItem } from '~/features/onigiri/types';
import type { HomePhase } from '../homeState';

function ingredientLabel(key: string): string {
  return key === 'RICE' ? '밥' : ingredientName(key);
}

export function HomeStudyHero({
  recipe,
  ingredientCount,
  plannedCount,
  minutes,
  mascot,
  disabled,
  onPress,
}: {
  recipe: OnigiriCatalogItem;
  ingredientCount: number;
  plannedCount: number;
  minutes: number;
  mascot: ImageSourcePropType;
  disabled: boolean;
  onPress: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { name } = useTheme();
  return (
    <Card variant="elevated" style={styles.studyHero}>
      <View style={styles.greetingRow}>
        <View style={styles.greetingCopy}>
          <Text style={styles.greeting}>오늘의 한 단어,{`\n`}천천히 눌러 담아보자.</Text>
          <Text style={styles.meta}>오늘 단어 {plannedCount}개 · 약 {minutes}분</Text>
        </View>
        <Image source={mascot} style={styles.mascot} resizeMode="contain" />
      </View>
      <View style={styles.dashedDivider} />
      <Text style={styles.ingredientMeta}>
        모은 재료 {ingredientCount}/{recipe.ingredients.length}
      </Text>
      <View style={styles.ingredientRow}>
        {recipe.ingredients.map((key, index) => {
          const acquired = index < ingredientCount;
          return (
            <View
              key={`${recipe.id}-${key}`}
              style={[styles.ingredientChip, name === 'light' && styles.ingredientChipLight]}
            >
              <Text style={[styles.ingredientName, !acquired && styles.lockedText]} numberOfLines={1}>
                {ingredientLabel(key)}
              </Text>
              {acquired && ingredientImage(key) ? (
                <Image source={ingredientImage(key)} style={styles.ingredientArt} resizeMode="contain" />
              ) : (
                <Image
                  source={ingredientEmptyImage}
                  style={styles.ingredientEmptyIcon}
                  resizeMode="contain"
                />
              )}
            </View>
          );
        })}
      </View>
      <Button
        label="학습 시작하기"
        compact
        disabled={disabled}
        onPress={onPress}
        style={styles.fullButton}
      />
    </Card>
  );
}

/**
 * 학습을 마친 뒤의 홈 히어로 — 오늘의 학습 성과만 보여준다.
 * '오늘 배운 단어'(보기)와 '이어서 회독해요'(학습)는 서로 다른 행동이라
 * 히어로 아래 HomeActionCard 두 장으로 분리한다.
 * 다시 볼 단어가 남아 있으면 기존 오늘 복습 진입(복습하기)은 유지한다.
 */
export function HomeStudyCompleteHero({
  phase,
  studyCount,
  reviewCount,
  reward,
  mascot,
  onReview,
}: {
  phase: Exclude<HomePhase, 'studyBefore'>;
  studyCount: number;
  reviewCount: number;
  /** 오늘 학습 세션으로 받은 재료. 지급 대상이 아니면 null — 행을 숨긴다. */
  reward: { ingredient: string; recipeName: string; ingredientCount: number; ingredientTotal: number } | null;
  mascot: ImageSourcePropType;
  onReview: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { name } = useTheme();
  const rewardArt = reward ? ingredientImage(reward.ingredient) : undefined;
  return (
    <Card variant="elevated" style={styles.completeHero}>
      <Image source={mascot} style={styles.heroMascot} resizeMode="contain" />
      <Overline style={styles.orange}>오늘 학습 완료</Overline>
      <Text style={styles.completeTitle}>오늘도 잘 먹었다.</Text>
      <Text style={styles.completeBody}>단어 {studyCount}개를 익혔어요.</Text>

      {reward ? (
        <>
          <View style={[styles.dashedDivider, styles.rewardDivider]} />
          <View style={styles.rewardRow} accessible accessibilityLabel={`오늘 획득한 재료 ${ingredientLabel(reward.ingredient)}`}>
            <View style={[styles.ingredientChip, name === 'light' && styles.ingredientChipLight]}>
              {rewardArt ? (
                <Image source={rewardArt} style={styles.ingredientArt} resizeMode="contain" />
              ) : null}
              <Text style={styles.ingredientName} numberOfLines={1}>
                {ingredientLabel(reward.ingredient)}
              </Text>
            </View>
            <View style={styles.rewardCopy}>
              <Text style={styles.resultLabel}>오늘 획득한 재료</Text>
              <Text style={styles.rewardMeta} numberOfLines={1}>
                {reward.recipeName} 재료 {reward.ingredientCount}/{reward.ingredientTotal}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {phase === 'reviewPending' ? (
        <Button
          label={`다시 볼 단어 ${reviewCount}개 복습하기`}
          variant="outline"
          onPress={onReview}
          style={styles.fullButton}
        />
      ) : null}
    </Card>
  );
}

/**
 * 홈 하단 액션 카드. 카드 전체가 하나의 버튼이다(제목·설명·진행률·Chevron).
 */
export function HomeActionCard({
  title,
  description,
  progress,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  description: string;
  /** 0–1. 넘기면 설명 아래 진행률 바를 그린다. */
  progress?: number;
  accessibilityLabel?: string;
  onPress: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const percent = progress == null ? null : Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}, ${description}`}
    >
      <View style={styles.compactCopy}>
        <Text style={styles.compactTitle}>{title}</Text>
        <Text style={styles.actionMeta} numberOfLines={1}>{description}</Text>
        {percent != null ? (
          <View
            style={styles.linearTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
          >
            <View style={[styles.linearFill, { width: `${percent}%` }]} />
          </View>
        ) : null}
      </View>
      <IconChevron size={18} color={colors.mute} />
    </Pressable>
  );
}

export function HomeAllDoneCard({
  reviewCount,
  studyCount,
  image,
  onHub,
}: {
  reviewCount: number;
  studyCount: number;
  image?: ImageSourcePropType;
  onHub: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.allDoneCard}>
      {image ? <Image source={image} style={styles.doneOnigiri} resizeMode="contain" /> : null}
      <Overline>오늘 공부 끝!</Overline>
      <Text style={styles.allDoneTitle}>오늘 할 공부를 모두 마쳤어요.</Text>
      <View style={styles.summaryBox}>
        <SummaryRow label="오늘 학습" value={`${studyCount} 단어`} />
        {reviewCount > 0 ? <SummaryRow label="복습" value={`${reviewCount} 단어`} /> : null}
        <SummaryRow label="회독" value="완료" />
      </View>
      <Button label="회독하러 가기" variant="outline" onPress={onHub} style={styles.fullButton} />
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function RecentOnigiriCard({
  name,
  image,
  onPress,
}: {
  name: string;
  image?: ImageSourcePropType;
  onPress: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <PlateTile size={48} image={image} imageSize={40} />
      <View style={styles.compactCopy}>
        <Text style={styles.compactMeta}>최근 획득</Text>
        <Text style={styles.compactTitle}>{name} 오니기리</Text>
      </View>
    </Pressable>
  );
}

export function MonthlyMenuCard({
  month,
  level,
  total,
  progress,
  onPress,
}: {
  month: number;
  level: string;
  total: number;
  progress: number;
  onPress: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuCard, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.compactCopy}>
        <Text style={styles.menuTitle}>{month}월 {level} 메뉴판</Text>
        <Text style={styles.menuMeta}>기초 단어 {total}개 중 {Math.round(progress * 100)}% 완료</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    studyHero: { borderRadius: radius.card, padding: 22, gap: spacing.md },
    completeHero: { borderRadius: radius.card, padding: 22, gap: spacing.sm, position: 'relative' },
    greetingRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    greetingCopy: { flex: 1, gap: spacing.xs },
    greeting: { ...typography.listTitle, color: colors.ink },
    completeTitle: {
      fontFamily: font.extrabold,
      fontSize: 23,
      lineHeight: 30,
      letterSpacing: -0.4,
      color: colors.ink,
      maxWidth: '74%',
      marginTop: 10,
    },
    completeBody: { ...typography.bodyStrong, color: colors.body, maxWidth: '74%' },
    orange: { color: colors.primary },
    rewardDivider: { marginTop: spacing.md },
    rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
    rewardCopy: { flex: 1, minWidth: 0, gap: 2 },
    rewardMeta: { ...typography.bodyStrong, color: colors.ink },
    actionCard: {
      minHeight: 78,
      borderRadius: radius.card,
      backgroundColor: colors.canvas,
      paddingHorizontal: 22,
      paddingVertical: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    actionMeta: { ...typography.caption, color: colors.mute },
    mascot: { width: 100, height: 100 },
    heroMascot: { position: 'absolute', top: 20, right: 18, width: 74, height: 74 },
    meta: { ...typography.caption, color: colors.mute, marginTop: spacing.sm },
    dashedDivider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.pressed },
    ingredientMeta: { ...typography.caption, color: colors.body },
    ingredientRow: { flexDirection: 'row', gap: 7, overflow: 'hidden' },
    ingredientChip: {
      minWidth: 64,
      height: 44,
      borderRadius: radius.tileSm,
      backgroundColor: colors.softer,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    ingredientChipLight: { backgroundColor: '#F2F4F6' },
    ingredientName: { ...typography.bodyStrong, color: colors.ink, maxWidth: 58 },
    lockedText: { color: colors.body },
    ingredientArt: { width: 22, height: 22 },
    ingredientEmptyIcon: { width: 24, height: 24 },
    fullButton: { alignSelf: 'stretch', marginTop: spacing.md },
    resultLabel: { ...typography.caption, color: colors.mute },
    linearTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.pressed, overflow: 'hidden', marginTop: spacing.sm },
    linearFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.ink },
    allDoneCard: { borderRadius: radius.card, alignItems: 'center', gap: spacing.sm, padding: 22 },
    doneOnigiri: { width: 96, height: 96 },
    allDoneTitle: { ...typography.listTitle, color: colors.ink, textAlign: 'center' },
    summaryBox: {
      width: '100%',
      borderRadius: 16,
      backgroundColor: HTML_FLOW_PAGE,
      padding: 14,
      gap: 6,
      marginVertical: spacing.md,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    summaryLabel: { ...typography.caption, color: colors.body },
    summaryValue: { ...typography.bodyStrong, color: colors.ink },
    compactCard: {
      minHeight: 88,
      borderRadius: radius.card,
      backgroundColor: colors.canvas,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    compactCopy: { flex: 1, minWidth: 0, gap: 2 },
    compactMeta: { ...typography.caption, color: colors.mute },
    compactTitle: { ...typography.cardTitle, color: colors.ink },
    menuCard: {
      minHeight: 78,
      borderRadius: radius.card,
      backgroundColor: colors.canvas,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    menuTitle: { ...typography.cardTitle, color: colors.ink },
    menuMeta: { ...typography.caption, color: colors.mute },
    pressed: { backgroundColor: colors.soft },
  });
