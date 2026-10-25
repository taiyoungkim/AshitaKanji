// Design Ref: Onikan handoff — 하단 탭바 (공통).
// Figma `537:22633`의 gnb-bottom-navigation 기준:
// 26px 아이콘 + 12px 라벨, 활성 = primary, 비활성 = body.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { font, spacing, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconHistory, IconMenu, IconSettings, IconToday } from '~/design/icons';
import { useBottomInset } from '~/hooks/useScreenInsets';

// 디자인 하단 여백. 안드로이드 edge-to-edge 3버튼 내비(≈48dp)처럼 시스템 inset 이
// 더 크면 inset 을 따라가야 탭이 내비 바에 깔리지 않는다.
const BAR_BOTTOM_PADDING = 24;

type TabIcon = (props: { color: string; knobFill: string }) => React.ReactNode;

const ICONS: Record<string, TabIcon> = {
  home: ({ color }) => <IconToday color={color} />,
  collection: ({ color }) => <IconMenu color={color} />,
  stats: ({ color }) => <IconHistory color={color} />,
  settings: ({ color, knobFill }) => <IconSettings color={color} knobFill={knobFill} />,
};

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const bottomInset = useBottomInset();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(BAR_BOTTOM_PADDING, bottomInset) }]}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const label = typeof options?.title === 'string' ? options.title : route.name;
        const focused = state.index === index;
        const tint = focused ? colors.primary : colors.body;
        const renderIcon = ICONS[route.name];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            hitSlop={8}
          >
            {renderIcon?.({ color: tint, knobFill: colors.canvas })}
            <Text style={[styles.label, { color: tint }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      backgroundColor: c.canvas,
      borderTopWidth: 1,
      borderTopColor: c.pressed,
      paddingTop: 16,
      paddingHorizontal: spacing.xl,
    },
    tab: {
      width: 72,
      height: 54,
      alignItems: 'center',
      gap: 8,
    },
    label: {
      fontFamily: font.regular,
      fontSize: 14,
      lineHeight: 18,
    },
  });
