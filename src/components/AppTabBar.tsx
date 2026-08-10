// Design Ref: Onikan handoff — 하단 탭바 (공통).
// 면·배지·밑줄 없이 틴트만으로 활성 상태를 표시한다. 활성 색이 body 가 아니라
// tab-active 인 이유는 12px 라벨이 AA(4.5:1)를 넘어야 하기 때문 (핸드오프 참조).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { font, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconHistory, IconMenu, IconSettings, IconToday } from '~/design/icons';

type TabIcon = (props: { color: string; knobFill: string }) => React.ReactNode;

const ICONS: Record<string, TabIcon> = {
  home: ({ color }) => <IconToday color={color} />,
  collection: ({ color }) => <IconMenu color={color} />,
  stats: ({ color }) => <IconHistory color={color} />,
  settings: ({ color, knobFill }) => <IconSettings color={color} knobFill={knobFill} />,
};

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps): React.ReactNode {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 26) }]}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const label = typeof options?.title === 'string' ? options.title : route.name;
        const focused = state.index === index;
        const tint = focused ? colors.tabActive : colors.body;
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
          >
            {renderIcon?.({ color: tint, knobFill: colors.softer })}
            <Text style={[styles.label, { color: tint }, focused && styles.labelActive]}>
              {label}
            </Text>
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
      backgroundColor: c.softer,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.pressed,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      minHeight: layout.tabBarItemHeight,
    },
    label: { ...typography.tab },
    labelActive: { fontFamily: font.semibold },
  });
