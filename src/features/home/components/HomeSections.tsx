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

export function HomeStudyCompleteHero({
  studyCount,
  minutes,
  streakDays,
  mascot,
  onBrowse,
}: {
  studyCount: number;
  minutes: number;
  streakDays: number;
  mascot: ImageSourcePropType;
  onBrowse: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.completeHero}>
      <Image source={mascot} style={styles.heroMascot} resizeMode="contain" />
      <Overline style={styles.orange}>오늘 학습 완료</Overline>
      <Text style={styles.completeTitle}>오늘도 잘 먹었다.{'\n'}단어 {studyCount}개를 배웠어요.</Text>
      <Text style={styles.meta}>{studyCount} 단어 · {minutes}분 · 단골 {streakDays}일</Text>
      <Pressable onPress={onBrowse} hitSlop={8} accessibilityRole="button">
        <Text style={styles.browseLink}>오늘 배운 단어 보기 ›</Text>
      </Pressable>
    </Card>
  );
}

function ChapterProgress({
  level,
  chapter,
  covered,
  total,
}: {
  level: string;
  chapter: number;
  covered: number;
  total: number;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
  return (
    <View>
      <Text style={styles.sublabel}>{level} 회독</Text>
      <View style={styles.strow}>
        <Text style={styles.chapName}>{level}-{chapter}</Text>
        <Text style={styles.chapProg}>{covered} / {total} 단어</Text>
      </View>
      <View style={styles.linearTrack}>
        <View style={[styles.linearFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.barCap}>{covered} / {total} 단어 · {percent}%</Text>
    </View>
  );
}

export function HomeNextCard({
  phase,
  reviewCount,
  studyCount,
  reading,
  image,
  onReview,
  onHub,
}: {
  phase: Exclude<HomePhase, 'studyBefore'>;
  reviewCount: number;
  studyCount: number;
  reading: { level: string; chapter: number; covered: number; total: number } | null;
  image?: ImageSourcePropType;
  onReview: () => void;
  onHub: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const chapter = reading ? (
    <ChapterProgress
      level={reading.level}
      chapter={reading.chapter}
      covered={reading.covered}
      total={reading.total}
    />
  ) : null;

  if (phase === 'allDone') {
    return (
      <Card style={styles.allDoneCard}>
        {image ? <Image source={image} style={styles.doneOnigiri} resizeMode="contain" /> : null}
        <Overline>오늘 공부 끝!</Overline>
        <Text style={styles.allDoneTitle}>오늘 할 공부를{'\n'}모두 마쳤어요.</Text>
        <View style={styles.summaryBox}>
          <SummaryRow label="오늘 학습" value={`${studyCount}단어`} accent />
          {reviewCount > 0 ? <SummaryRow label="오늘 복습" value={`${reviewCount}단어`} accent /> : null}
          <SummaryRow label="오늘 회독" value="완료" accent />
        </View>
        <Pressable onPress={onHub} hitSlop={8} accessibilityRole="button">
          <Text style={styles.browseLink}>회독 챕터 보기 ›</Text>
        </Pressable>
      </Card>
    );
  }

  if (phase === 'reviewPending') {
    return (
      <Card style={styles.nextCard}>
        <Overline style={styles.orange}>더 익혀볼까요?</Overline>
        <Text style={styles.nextTitle}>오늘 복습</Text>
        <Text style={styles.nextLead}>헷갈린 단어가 {reviewCount}개 있어요.</Text>
        <Text style={styles.nextDesc}>방금 학습에서 아직 어려웠던 단어예요.</Text>
        <Text style={styles.meta}>{reviewCount}단어 · 약 3분</Text>
        <Button label="복습하기" variant="brand" onPress={onReview} style={styles.fullButton} />
        {chapter ? (
          <>
            <View style={styles.divider} />
            {chapter}
            <Pressable onPress={onHub} hitSlop={8} accessibilityRole="button">
              <Text style={styles.browseLink}>회독 이어가기 ›</Text>
            </Pressable>
          </>
        ) : null}
      </Card>
    );
  }

  if (phase === 'reviewDone') {
    return (
      <Card style={styles.nextCard}>
        <View style={styles.doneTag}>
          <View style={styles.doneCheck}>
            <IconCheck size={13} color={colors.ink} />
          </View>
          <Text style={styles.doneTagLabel}>오늘 복습 완료</Text>
        </View>
        <Text style={styles.nextDesc}>{reviewCount}개 단어를 다시 익혔어요.</Text>
        {chapter ? (
          <>
            <View style={styles.divider} />
            <Overline style={styles.orange}>이어서</Overline>
            {chapter}
            <Button label="회독 이어가기" variant="brand" onPress={onHub} style={styles.fullButton} />
          </>
        ) : null}
      </Card>
    );
  }

  return (
    <Card style={styles.nextCard}>
      <Overline style={styles.orange}>다음 학습</Overline>
      <Text style={styles.nextDesc}>오늘 복습할 단어는 없어요. 잘하고 있어요!</Text>
      {chapter ? (
        <>
          <View style={styles.divider} />
          {chapter}
          <Button label="회독 이어가기" variant="brand" onPress={onHub} style={styles.fullButton} />
        </>
      ) : null}
    </Card>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && styles.summaryAccent]}>{value}</Text>
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
    browseLink: { ...typography.bodyStrong, color: colors.body, marginTop: spacing.md },
    nextCard: { borderRadius: radius.card, padding: 22, gap: spacing.sm },
    nextTitle: { ...typography.listTitle, color: colors.ink, marginTop: spacing.xs },
    nextLead: { ...typography.bodyStrong, color: colors.ink, marginTop: spacing.xs },
    nextDesc: { ...typography.caption, color: colors.body, lineHeight: 22 },
    divider: { height: 1, backgroundColor: colors.soft, marginVertical: spacing.md, marginHorizontal: -spacing.xl },
    sublabel: { ...typography.captionStrong, color: colors.body },
    strow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 6 },
    chapName: { ...typography.bodyStrong, color: colors.ink },
    chapProg: { ...typography.caption, color: colors.mute },
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
    summaryLabel: { ...typography.bodyStrong, color: colors.ink },
    summaryValue: { ...typography.bodyStrong, color: colors.ink },
    summaryAccent: { color: colors.success },
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
