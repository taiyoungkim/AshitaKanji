// Design Ref: Onikan alpha.1 — 기록 탭(통계형).
//
// 영구 하단 탭으로 진입하므로 프로토타입의 닫기 버튼은 쓰지 않는다.
// 실제 동작 대상이 없는 공유·더보기·셰브론도 그리지 않는다 — 눌리지 않는 인터랙션을
// 암시하지 않기 위해서다.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  cardShadow,
  layout,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconCheck, IconFlame } from '~/design/icons';
import { Button } from '~/components/ui/Button';
import { Overline } from '~/components/ui/Surface';
import { AnimatedNumber } from '~/components/ui/AnimatedNumber';
import { useToast } from '~/components/Toast';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { useSettingsStore } from '~/stores/SettingsStore';
import { resolveStudyEntry } from '~/features/study/resolveStudyEntry';
import { buildRecordService } from './buildRecordService';
import { ScoreDistribution } from './components/ScoreDistribution';
import type { RecordSnapshot, RecordViewState } from './recordTypes';

/** 큰 제목이 인라인 제목으로 넘어가는 스크롤 구간. */
const TITLE_SCRUB_PX = 48;
const HAIRLINE_AT = 6;

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export default function StatsScreen(): React.ReactNode {
  const router = useRouter();
  const { colors, name: themeName } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const toast = useToast();
  const reducedMotion = useReducedMotion();
  const selectedLevels = useSettingsStore((s) => s.selectedLevels);
  const dailyNewLimit = useSettingsStore((s) => s.dailyNewLimit);

  const [state, setState] = useState<RecordViewState>({ phase: 'loading' });
  const [starting, setStarting] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [scrolled, setScrolled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setState({ phase: 'loading' });
      void buildRecordService()
        .then((svc) => svc.load(Date.now()))
        .then((snapshot) => {
          if (!alive) return;
          // latest 가 없으면 아직 완료한 학습이 없다는 뜻 — 오류가 아니다.
          setState(
            snapshot.latest === null
              ? { phase: 'empty', snapshot }
              : { phase: 'ready', snapshot },
          );
        })
        .catch((err: unknown) => {
          console.warn('[record] load failed:', err);
          if (alive) setState({ phase: 'error', message: '기록을 불러오지 못했어요.' });
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const onStart = () => {
    if (starting) return;
    setStarting(true);
    void resolveStudyEntry(selectedLevels, dailyNewLimit)
      .then((route) => router.push(route))
      .catch((err: unknown) => {
        console.warn('[record] study entry failed:', err);
        toast.show('학습을 시작하지 못했어요. 다시 시도해 주세요');
      })
      .finally(() => setStarting(false));
  };

  // 큰 제목은 스크롤에 따라 접히고 인라인 제목이 대신 나타난다.
  const t = scrollY.interpolate({
    inputRange: [0, TITLE_SCRUB_PX],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const snapshot = state.phase === 'ready' || state.phase === 'empty' ? state.snapshot : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <BlurView
          intensity={24}
          tint={themeName === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* blur 를 못 쓰는 환경에서도 글자가 겹쳐 보이지 않도록 반투명 면을 깐다. */}
        <View style={styles.headerFallback} pointerEvents="none" />
        <Animated.Text style={[styles.headerInline, { opacity: t }]} numberOfLines={1}>
          기록
        </Animated.Text>
        {scrolled && <View style={styles.headerHairline} />}
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (e) => {
            const y = (e.nativeEvent as { contentOffset: { y: number } }).contentOffset.y;
            setScrolled(y > HAIRLINE_AT);
          },
        })}
      >
        <Animated.Text
          style={[
            styles.bigTitle,
            {
              opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) },
              ],
            },
          ]}
        >
          기록
        </Animated.Text>

        {state.phase === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.body} />
          </View>
        )}

        {state.phase === 'error' && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
        )}

        {snapshot && (
          <RecordBody
            snapshot={snapshot}
            empty={state.phase === 'empty'}
            reducedMotion={reducedMotion !== false}
            cta={<Button label="지금 연습하기" onPress={onStart} disabled={starting} />}
          />
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function RecordBody({
  snapshot,
  empty,
  reducedMotion,
  cta,
}: {
  snapshot: RecordSnapshot;
  empty: boolean;
  reducedMotion: boolean;
  cta: React.ReactNode;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { latest, streakDays, week, totals, comparison } = snapshot;

  return (
    <View style={styles.stack}>
      <StaggerCard index={0} reducedMotion={reducedMotion}>
        <View style={styles.card}>
          <Overline>최근 학습</Overline>
          {latest ? (
            <>
              <View style={styles.scoreRow}>
                <AnimatedNumber
                  value={latest.correct}
                  suffix={` / ${latest.total}`}
                  delay={0}
                  style={styles.scoreValue}
                />
              </View>
              <Text style={styles.cardCaption}>
                정답률 {Math.round(latest.percent)}% · {formatDay(latest.endedAt)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
              <Text style={styles.cardCaption}>
                첫 학습을 마치면 점수와 연속 기록이 여기에 쌓여요.
              </Text>
            </>
          )}
        </View>
      </StaggerCard>

      <StaggerCard index={1} reducedMotion={reducedMotion}>
        <View style={styles.card}>
          <Overline>연속 학습</Overline>
          <View style={styles.scoreRow}>
            <IconFlame size={30} color={streakDays > 0 ? colors.primary : colors.pressed} />
            <AnimatedNumber value={streakDays} suffix="일" delay={0} style={styles.scoreValue} />
          </View>
          <View style={styles.weekRow}>
            {week.map((day, i) => (
              <WeekCell
                key={day.date}
                label={WEEKDAY_LABELS[day.weekday] ?? ''}
                active={day.active}
                index={i}
                reducedMotion={reducedMotion}
              />
            ))}
          </View>
        </View>
      </StaggerCard>

      <StaggerCard index={2} reducedMotion={reducedMotion}>
        <View style={styles.tileGrid}>
          <View style={styles.tileRow}>
            <StatTile label="읽은 단어" value={totals.learnedWords} />
            <StatTile label="복습" value={totals.reviews} />
          </View>
          <View style={styles.tileRow}>
            <StatTile label="다시 본 것" value={totals.again} />
            <StatTile label="학습" value={totals.completedSessions} />
          </View>
        </View>
      </StaggerCard>

      <StaggerCard index={3} reducedMotion={reducedMotion}>
        {!empty && latest ? (
          <ScoreDistribution
            comparison={comparison}
            currentPercent={latest.percent}
            cta={cta}
          />
        ) : (
          // 아직 기록이 없으면 분포 카드 대신 CTA 만 남긴다.
          cta
        )}
      </StaggerCard>
    </View>
  );
}

/** 카드가 위로 떠오르며 순서대로 등장한다. 마지막 카드가 420ms 에 끝난다. */
function StaggerCard({
  index,
  reducedMotion,
  children,
}: {
  index: number;
  reducedMotion: boolean;
  children: React.ReactNode;
}): React.ReactNode {
  const value = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useFocusEffect(
    useCallback(() => {
      if (reducedMotion) {
        value.setValue(1);
        return;
      }
      value.setValue(0);
      const animation = Animated.timing(value, {
        toValue: 1,
        delay: 50 + index * 90,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [index, reducedMotion, value]),
  );

  return (
    <Animated.View
      style={{
        opacity: value,
        transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** 활동한 날만 라임 체크가 팝한다 — 이 화면에서 라임은 여기에만 쓴다. */
function WeekCell({
  label,
  active,
  index,
  reducedMotion,
}: {
  label: string;
  active: boolean;
  index: number;
  reducedMotion: boolean;
}): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pop = useRef(new Animated.Value(reducedMotion || !active ? 1 : 0)).current;

  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      if (reducedMotion) {
        pop.setValue(1);
        return;
      }
      pop.setValue(0);
      const animation = Animated.timing(pop, {
        toValue: 1,
        delay: 420 + index * 60,
        duration: 260,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [active, index, reducedMotion, pop]),
  );

  return (
    <View style={styles.weekCell}>
      <Text style={styles.weekLabel}>{label}</Text>
      <View style={[styles.weekDot, active && styles.weekDotActive]}>
        {active && (
          <Animated.View style={{ opacity: pop, transform: [{ scale: pop }] }}>
            <IconCheck size={14} color={colors.onSecondary} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: number }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tile}>
      <AnimatedNumber value={value} delay={0} style={styles.tileValue} />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.softer },

    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 52,
      zIndex: 10,
      justifyContent: 'flex-end',
      paddingBottom: spacing.sm,
    },
    headerFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: c.softer, opacity: 0.72 },
    headerInline: {
      ...typography.cardTitle,
      color: c.ink,
      textAlign: 'center',
    },
    headerHairline: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.pressed,
    },

    scroll: { flex: 1 },
    content: {
      paddingHorizontal: layout.gutter,
      paddingTop: 60,
      paddingBottom: spacing.huge,
    },
    bigTitle: { ...typography.screenTitle, color: c.ink, marginBottom: layout.gutter },

    center: { paddingVertical: spacing.huge, alignItems: 'center', gap: spacing.md },
    errorText: { ...typography.body, color: c.body, textAlign: 'center' },

    // 카드 그룹 사이는 28px, 카드 안은 12–16px.
    stack: { gap: layout.gapGroup },
    card: {
      backgroundColor: c.canvas,
      borderRadius: radius.card,
      padding: layout.gutter,
      gap: layout.gapTight,
      ...cardShadow(c),
    },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    scoreValue: { ...typography.hero, color: c.ink },
    cardCaption: { ...typography.body, color: c.body },
    emptyTitle: { ...typography.listTitle, color: c.ink },

    weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
    weekCell: { alignItems: 'center', gap: spacing.sm, minWidth: 36 },
    weekLabel: { ...typography.caption, color: c.body },
    weekDot: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.pressed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekDotActive: { backgroundColor: c.secondary, borderColor: c.secondary },

    // 퍼센트 폭에 gap 을 더하면 부모를 넘겨 줄바꿈된다. 행을 명시하고 타일은 flex 로 나눈다.
    tileGrid: { gap: layout.gapTight },
    tileRow: { flexDirection: 'row', gap: layout.gapTight },
    tile: {
      flex: 1,
      backgroundColor: c.canvas,
      borderRadius: radius.card,
      padding: layout.gutter,
      gap: spacing.xs,
    },
    tileValue: { ...typography.resultTitle, color: c.ink },
    tileLabel: { ...typography.body, color: c.body },

  });
