import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Button } from '~/components/ui/Button';
import { Card, Overline, PlateTile } from '~/components/ui/Surface';
import { IconCheck } from '~/design/icons';
import { HTML_FLOW_PAGE, font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { ingredientImage, ingredientName } from '~/features/onigiri/ingredientAssets';
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
  return (
    <Card variant="elevated" style={styles.studyHero}>
      <View style={styles.greetingRow}>
        <View style={styles.greetingCopy}>
          <Text style={styles.greeting}>왔네.{`\n`}오늘은 {recipe.name}야.</Text>
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
            <View key={`${recipe.id}-${key}`} style={styles.ingredientChip}>
              <Text style={[styles.ingredientName, !acquired && styles.lockedText]} numberOfLines={1}>
                {ingredientLabel(key)}
              </Text>
              {acquired && ingredientImage(key) ? (
                <Image source={ingredientImage(key)} style={styles.ingredientArt} resizeMode="contain" />
              ) : (
                <View style={styles.question}><Text style={styles.questionText}>?</Text></View>
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
 * 학습을 마친 뒤의 홈 히어로. 시안은 복습 상태를 별도 카드가 아니라
 * 이 카드 안 '학습 결과' 박스로 보여준다 — 카드를 쪼개지 않는다.
 * 박스 자체가 오늘 배운 단어 화면으로 가는 유일한 진입점이다.
 */
export function HomeStudyCompleteHero({
  phase,
  studyCount,
  reviewCount,
  mascot,
  onReview,
  onBrowse,
}: {
  phase: Exclude<HomePhase, 'studyBefore'>;
  studyCount: number;
  reviewCount: number;
  mascot: ImageSourcePropType;
  onReview: () => void;
  onBrowse: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Card variant="elevated" style={styles.completeHero}>
      <Image source={mascot} style={styles.heroMascot} resizeMode="contain" />
      <Overline style={styles.orange}>오늘 학습 완료</Overline>
      <Text style={styles.completeTitle}>오늘도 잘 먹었다.{'\n'}단어 {studyCount}개를 배웠어요.</Text>

      {phase === 'reviewPending' ? (
        <>
          <Pressable
            onPress={onBrowse}
            style={({ pressed }) => [styles.resultBox, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="오늘 배운 단어 보기"
          >
            <Text style={styles.resultLabel}>학습 결과</Text>
            <Text style={styles.resultValue}>헷갈린 단어 {reviewCount}개</Text>
          </Pressable>
          <Button label="복습하기" variant="outline" onPress={onReview} style={styles.fullButton} />
        </>
      ) : null}

      {phase === 'reviewDone' ? (
        <Pressable
          onPress={onBrowse}
          style={({ pressed }) => [styles.resultBox, styles.resultBoxDone, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="오늘 배운 단어 보기"
        >
          <View style={styles.doneTag}>
            <View style={styles.doneCheck}>
              <IconCheck size={13} color={colors.ink} />
            </View>
            <Text style={styles.doneTagLabel}>오늘 복습 완료</Text>
          </View>
          <Text style={styles.resultDoneBody}>{reviewCount}개 단어를 다시 익혔어요.</Text>
        </Pressable>
      ) : null}

      {phase === 'noReview' ? (
        <Pressable
          onPress={onBrowse}
          style={({ pressed }) => [styles.resultBox, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="오늘 배운 단어 보기"
        >
          <Text style={styles.resultLabel}>학습 결과</Text>
          <Text style={styles.resultValue}>오늘 복습할 단어는 없어요.</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/**
 * '이어서 회독해요'. 시안에서 이 블록은 히어로 카드에 붙지 않는 독립 섹션이다 —
 * 페이지 레벨 제목 + 전체보기 링크 + 자체 카드.
 */
export function ReadingContinueSection({
  reading,
  onHub,
}: {
  reading: { level: string; chapter: number; covered: number; total: number } | null;
  onHub: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  if (!reading) return null;
  const percent = reading.total > 0 ? Math.round((reading.covered / reading.total) * 100) : 0;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>이어서 회독해요</Text>
        <Pressable onPress={onHub} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sectionMore}>전체보기 ›</Text>
        </Pressable>
      </View>
      <Card style={styles.nextCard}>
        <View style={styles.strow}>
          <Text style={styles.chapName}>{reading.level} - {reading.chapter}</Text>
          <View style={styles.pctBadge}>
            <Text style={styles.pctBadgeLabel}>{percent}% 완료</Text>
          </View>
        </View>
        <View style={styles.linearTrack}>
          <View style={[styles.linearFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.barCap}>{reading.covered} / {reading.total} 단어</Text>
        <Button label="회독하기" variant="ink" onPress={onHub} style={styles.fullButton} />
      </Card>
    </View>
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
    mascot: { width: 74, height: 74 },
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
    ingredientName: { ...typography.bodyStrong, color: colors.ink, maxWidth: 58 },
    lockedText: { color: colors.body },
    ingredientArt: { width: 22, height: 22 },
    question: {
      width: 20,
      height: 20,
      borderRadius: radius.pill,
      backgroundColor: colors.canvas,
      alignItems: 'center',
      justifyContent: 'center',
    },
    questionText: { ...typography.captionStrong, color: colors.mute },
    fullButton: { alignSelf: 'stretch', marginTop: spacing.md },
    orange: { color: colors.primary },
    resultBox: {
      borderRadius: 16,
      backgroundColor: colors.softer,
      padding: spacing.lg,
      gap: spacing.xs,
      marginTop: spacing.lg,
    },
    resultBoxDone: { backgroundColor: colors.secondarySoft },
    resultLabel: { ...typography.caption, color: colors.mute },
    resultValue: { ...typography.bodyStrong, color: colors.ink },
    resultDoneBody: { ...typography.caption, color: colors.body },
    section: { gap: spacing.md },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { ...typography.listTitle, color: colors.ink },
    sectionMore: { ...typography.caption, color: colors.body },
    nextCard: { borderRadius: radius.card, padding: 22, gap: spacing.sm },
    strow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    chapName: { ...typography.listTitle, color: colors.ink },
    pctBadge: {
      borderRadius: radius.pill,
      backgroundColor: colors.softer,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pctBadgeLabel: { ...typography.captionStrong, color: colors.body },
    linearTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.pressed, overflow: 'hidden', marginTop: spacing.sm },
    linearFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.ink },
    barCap: { ...typography.caption, color: colors.mute, marginTop: 7 },
    doneTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    doneCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneTagLabel: { ...typography.bodyStrong, color: colors.success },
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
