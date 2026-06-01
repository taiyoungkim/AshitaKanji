// Design Ref: ONIGIRI SHOP redesign — Tab Bar (텍스트 전용, active 밑줄).
// expo Tabs 기본 탭바는 탭별 밑줄을 지원하지 않아 커스텀 렌더로 대체.
// 무채색: active = text + 1.5px 밑줄, inactive = textTertiary.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fontWeight, layout, spacing } from '~/design/tokens';

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps): React.ReactNode {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const label =
          typeof options?.title === 'string' ? options.title : route.name;
        const focused = state.index === index;

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
            <View style={[styles.labelWrap, focused && styles.labelWrapActive]}>
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    minHeight: layout.tabBarHeight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
  },
  labelWrap: {
    paddingBottom: spacing.xs,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
  },
  labelWrapActive: {
    borderBottomColor: colors.text,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: colors.textTertiary,
    fontWeight: fontWeight.regular,
  },
  labelActive: {
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
});
