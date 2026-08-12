// Onikan 표면 · 라벨 · 진행 프리미티브.
//
// 한 화면에 흰 카드가 둘 이상일 때 위계는 **그림자 유무로만** 나눈다 —
// 색·테두리·반경은 동일하게 유지한다. 카드 안에 카드를 넣지 않는다.

import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  cardShadow,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';

/**
 * 표준 콘텐츠 카드. 층은 **그림자 유무로만** 나눈다 — 테두리 변형은 없다.
 * `flat` 은 "누를 수 있으나 히어로는 아닌" 카드(홈 진행 카드)다.
 */
export type CardVariant = 'elevated' | 'flat';

export function Card({
  children,
  variant = 'flat',
  style,
}: {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.card, variant === 'elevated' && cardShadow(colors), style]}>
      {children}
    </View>
  );
}

/** 오버라인 — 그룹 라벨. 대문자·자간 1.4. */
export function Overline({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.overline, style]}>{children}</Text>;
}

/**
 * 일러스트 배킹 타일. plate 는 다크에서도 고정이라 검정 선화가 살아남는다.
 * `locked` 면 그림 대신 hairline 링 + "?" 를 그린다 — 무엇을 받을지 미리 보여주지 않는다.
 */
export function PlateTile({
  size,
  image,
  imageSize,
  locked = false,
  cornerRadius,
  children,
  style,
}: {
  size: number;
  image?: ImageSourcePropType;
  imageSize?: number;
  locked?: boolean;
  cornerRadius?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const r = cornerRadius ?? radius.tileMd;
  const art = imageSize ?? Math.round(size * 0.82);

  if (locked) {
    return (
      <View
        style={[
          styles.tileLocked,
          { width: size, height: size, borderRadius: r, borderColor: colors.pressed },
          style,
        ]}
      >
        <Text style={[styles.lockedMark, { fontSize: Math.round(size * 0.4) }]}>?</Text>
      </View>
    );
  }

  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: r }, style]}>
      {image ? (
        <Image source={image} style={{ width: art, height: art }} resizeMode="contain" />
      ) : null}
      {children}
    </View>
  );
}

/**
 * 칸 분할 진행바. 홈·메뉴·상세는 `barFill`(탐색 맥락), 결과 화면만 `ink`(보상 순간).
 * `justFilled` 는 방금 채워진 칸으로, 라임에서 시작해 잉크로 가라앉는 연출의 대상이다.
 */
export function ProgressSegments({
  total,
  filled,
  height,
  gap,
  fill = 'bar',
  style,
}: {
  total: number;
  filled: number;
  height: number;
  gap: number;
  fill?: 'bar' | 'ink';
  style?: StyleProp<ViewStyle>;
}): React.ReactNode {
  const { colors } = useTheme();
  const fillColor = fill === 'ink' ? colors.ink : colors.barFill;

  return (
    <View style={[{ flexDirection: 'row', gap }, style]}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height,
            borderRadius: radius.pill,
            backgroundColor: i < filled ? fillColor : colors.pressed,
          }}
        />
      ))}
    </View>
  );
}

/** 중립 배지 — JLPT 레벨 같은 메타 태그. 브랜드색을 쓰지 않는다. */
export function Badge({ label }: { label: string }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.canvas,
      borderRadius: radius.card,
      padding: spacing.xl,
    },
    overline: { ...typography.overline, color: c.body },
    tile: {
      backgroundColor: c.plate,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    tileLocked: {
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockedMark: { ...typography.cta, color: c.body, lineHeight: undefined },
    badge: {
      backgroundColor: c.soft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      alignSelf: 'flex-start',
    },
    badgeLabel: { ...typography.overline, color: c.ink },
  });
