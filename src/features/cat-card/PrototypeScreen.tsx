// 고양이 카드 보상 프로토타입. /_dev/cat-card 경로. 설정 > 개발자에서 진입한다.
// Plan Ref: docs/01-plan/features/ashitakanji.cat-card-reward.plan.md
//
// 목적 두 가지:
//  1) 전체 루프(도장 -> 뽑기 -> 연출 -> 도감 -> 공유)를 손으로 만져보고 판단
//  2) R-03 검증 — mixBlendMode 홀로가 저사양 Android 에서 몇 fps 나오는지 실측
//
// 프로덕션 데이터에 손대지 않는다. 모든 상태는 화면 안 메모리에만 있다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useReducedMotion } from '~/hooks/useReducedMotion';
import { CARD_ASPECT_RATIO, RARITY_LABEL, RARITY_WEIGHTS, SEASON_1, type CatCard } from './catalog';
import { availableDraws, draw, spendStamps, STAMPS_PER_DRAW } from './gacha';
import { CardThumb, HoloCard, useTilt } from './components/HoloCard';

/** 프레임 카운터. R-03 검증용이라 프로토타입에만 둔다. */
function useFps(active: boolean): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frames = 0;
    let last = Date.now();
    let handle = 0;
    const tick = (): void => {
      frames += 1;
      const now = Date.now();
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [active]);
  return fps;
}

export default function CatCardPrototypeScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [stamps, setStamps] = useState(STAMPS_PER_DRAW);
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
  const [current, setCurrent] = useState<CatCard | null>(null);
  const [lastWasDuplicate, setLastWasDuplicate] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(true);
  const [fullscreen, setFullscreen] = useState<CatCard | null>(null);
  const [showFps, setShowFps] = useState(true);

  const { tilt, recalibrate } = useTilt(tiltEnabled && (current !== null || fullscreen !== null));
  const fps = useFps(showFps);

  const flip = useRef(new Animated.Value(0)).current;
  const cardRef = useRef<View>(null);

  const cardWidth = Math.min(width - layout.gutter * 2, 340);
  // 전체화면은 세로 여백까지 감안해 가로·세로 중 먼저 걸리는 쪽에 맞춘다.
  const fullscreenWidth = Math.min(width - spacing.xl * 2, (height - 160) * CARD_ASPECT_RATIO);
  // 10개를 넘겨 쌓이면 칸은 가득 찬 상태로 두고 이월분은 숫자로만 보여준다.
  const filledStamps = Math.min(stamps, STAMPS_PER_DRAW);
  const thumbWidth = (width - layout.gutter * 2 - spacing.sm * 4) / 5;

  const runDraw = useCallback(() => {
    if (availableDraws(stamps) < 1) return;
    const result = draw(SEASON_1, RARITY_WEIGHTS, owned);
    setStamps((prev) => spendStamps(prev));
    setCurrent(result.card);
    setLastWasDuplicate(result.duplicate);
    setOwned((prev) => new Set([...prev, result.card.id]));
    recalibrate();

    if (reducedMotion === true) {
      flip.setValue(1);
      return;
    }
    flip.setValue(0);
    Animated.timing(flip, {
      toValue: 1,
      duration: 620,
      easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, [flip, owned, recalibrate, reducedMotion, stamps]);

  const share = useCallback(async () => {
    if (!current?.shareable || !cardRef.current) return;
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        await Share.share({ url: uri });
      }
    } catch (err) {
      console.log('[cat-card] share failed', err);
    }
  }, [current]);

  const flipStyle = useMemo(
    () => ({
      transform: [
        { perspective: 1200 },
        {
          rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }),
        },
        { scale: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.86, 0.94, 1] }) },
      ],
      opacity: flip.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0, 1, 1] }),
    }),
    [flip],
  );

  const completed = owned.size >= SEASON_1.length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>고양이 카드 프로토타입</Text>
        <Text style={styles.caption}>
          기획 검증용 화면. 실제 학습 기록과 무관하고 앱을 나가면 초기화된다.
        </Text>

        {/* 도장 시뮬레이터 */}
        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>출석도장 {stamps}/{STAMPS_PER_DRAW}</Text>
            <Text style={styles.hint}>
              {availableDraws(stamps) > 0 ? '뽑기 가능' : `${STAMPS_PER_DRAW - (stamps % STAMPS_PER_DRAW)}일 남음`}
            </Text>
          </View>
          <View style={styles.stampRow}>
            {Array.from({ length: STAMPS_PER_DRAW }, (_, i) => (
              <View key={i} style={[styles.stamp, i < filledStamps && styles.stampOn]} />
            ))}
          </View>
          <View style={styles.btnRow}>
            <Btn label="도장 +1" onPress={() => setStamps((s) => s + 1)} />
            <Btn label="도장 +10" onPress={() => setStamps((s) => s + STAMPS_PER_DRAW)} />
            <Btn label="초기화" onPress={() => { setStamps(STAMPS_PER_DRAW); setOwned(new Set()); setCurrent(null); }} />
          </View>
        </View>

        {/* 카드 */}
        <View style={styles.stage}>
          {current ? (
            <Animated.View style={flipStyle}>
              <Pressable
                onPress={() => setFullscreen(current)}
                accessibilityRole="button"
                accessibilityLabel={`${current.name} 크게 보기`}
              >
                <View ref={cardRef} collapsable={false}>
                  <HoloCard card={current} tilt={tilt} width={cardWidth} />
                </View>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={[styles.empty, { width: cardWidth, height: cardWidth / CARD_ASPECT_RATIO }]}>
              <Text style={styles.emptyText}>도장 10개를 채우고{'\n'}카드를 뽑아보세요</Text>
            </View>
          )}
        </View>

        {current ? (
          <View style={styles.meta}>
            <Text style={styles.cardName}>
              {current.name} · {RARITY_LABEL[current.rarity]}
            </Text>
            <Text style={styles.cardDesc}>{current.description}</Text>
            <Text style={styles.hint}>카드를 누르면 크게 볼 수 있다</Text>
            {lastWasDuplicate ? <Text style={styles.dup}>이미 만난 고양이다</Text> : null}
          </View>
        ) : null}

        <View style={styles.btnRow}>
          <Btn label="뽑기" primary disabled={availableDraws(stamps) < 1} onPress={runDraw} />
          <Btn label="공유" disabled={!current?.shareable} onPress={() => void share()} />
          <Btn label="기울기 0점" disabled={!current} onPress={recalibrate} />
        </View>

        {/* 검증 토글 */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>검증</Text>
          <View style={styles.btnRow}>
            <Btn label={tiltEnabled ? '기울기 끄기' : '기울기 켜기'} onPress={() => setTiltEnabled((v) => !v)} />
            <Btn label={showFps ? 'fps 숨기기' : 'fps 보기'} onPress={() => setShowFps((v) => !v)} />
          </View>
          <Text style={styles.hint}>
            {showFps ? `${fps} fps · ` : ''}
            {Platform.OS} · 모션감소 {reducedMotion === true ? '켜짐' : '꺼짐'} · 기울기 x{tilt.x.toFixed(2)} y{tilt.y.toFixed(2)}
          </Text>
          <Text style={styles.hint}>
            R-03 기준: 저사양 Android 에서 30fps 미만이면 정적 폴백 또는 Skia 재검토.
          </Text>
        </View>

        {/* 도감 */}
        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>도감</Text>
            {/* Plan Ref: FR-09 — 총 카드 수를 고정 문구로 노출하지 않는다 */}
            <Text style={styles.hint}>{completed ? '시즌1 완주' : `${owned.size}마리 만남`}</Text>
          </View>
          <View style={styles.grid}>
            {SEASON_1.map((card) => (
              <CardThumb
                key={card.id}
                card={card}
                owned={owned.has(card.id)}
                width={thumbWidth}
                onPress={() => setFullscreen(card)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={fullscreen !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreen(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setFullscreen(null)}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          {fullscreen ? (
            <>
              {/* 배경 탭은 닫기다. 카드 탭은 삼켜서 실수로 닫히지 않게 한다. */}
              <Pressable onPress={recalibrate} accessibilityRole="button" accessibilityLabel="기울기 0점">
                <HoloCard card={fullscreen} tilt={tilt} width={fullscreenWidth} />
              </Pressable>
              <Text style={styles.fsName}>
                {fullscreen.name} · {RARITY_LABEL[fullscreen.rarity]}
              </Text>
              <Text style={styles.fsHint}>카드를 누르면 기울기 0점 · 배경을 누르면 닫기</Text>
            </>
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Btn({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        primary && styles.btnPrimary,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <Text style={[styles.btnLabel, primary && styles.btnLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.softer },
    content: {
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.lg,
      paddingBottom: spacing.huge,
      gap: spacing.lg,
    },
    title: { ...typography.meaning, color: colors.ink },
    caption: { ...typography.caption, color: colors.mute, marginTop: -spacing.sm },
    panel: {
      backgroundColor: colors.canvas,
      borderRadius: radius.card,
      padding: spacing.lg,
      gap: spacing.md,
    },
    panelTitle: { ...typography.cardTitle, color: colors.ink },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hint: { ...typography.caption, color: colors.mute },
    stampRow: { flexDirection: 'row', gap: spacing.xs },
    stamp: { flex: 1, height: 10, borderRadius: 999, backgroundColor: colors.pressed },
    stampOn: { backgroundColor: colors.primary },
    stage: { alignItems: 'center', paddingVertical: spacing.md },
    empty: {
      borderRadius: radius.card,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.pressed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { ...typography.body, color: colors.mute, textAlign: 'center' },
    meta: { alignItems: 'center', gap: spacing.xs },
    cardName: { ...typography.cardTitle, color: colors.ink },
    cardDesc: { ...typography.body, color: colors.body, textAlign: 'center' },
    dup: { ...typography.caption, color: colors.primary },
    btnRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    btn: {
      flexGrow: 1,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: colors.ink },
    btnPressed: { opacity: 0.7 },
    btnDisabled: { opacity: 0.35 },
    btnLabel: { ...typography.body, color: colors.ink },
    btnLabelPrimary: { color: colors.onInk },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    },
    fsName: { ...typography.cardTitle, color: '#FFFFFF' },
    fsHint: { ...typography.caption, color: 'rgba(255,255,255,0.55)', marginTop: -spacing.sm },
  });
