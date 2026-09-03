import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, layout, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconHistory, IconMenu, IconSettings, IconToday } from '~/design/icons';

export type MainTabKey = 'home' | 'collection' | 'stats' | 'settings';

const TABS: { key: MainTabKey; label: string; href: Href }[] = [
  { key: 'home', label: '오늘', href: '/home' },
  { key: 'collection', label: '메뉴', href: '/collection' },
  { key: 'stats', label: '기록', href: '/stats' },
  { key: 'settings', label: '설정', href: '/settings' },
];

export function MainTabBar({ active }: { active: MainTabKey }): React.ReactNode {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {TABS.map((tab) => {
        const focused = tab.key === active;
        const tint = focused ? colors.primary : colors.mute;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (router.canDismiss()) router.dismissAll();
              router.navigate(tab.href);
            }}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
          >
            {tab.key === 'home' ? <IconToday color={tint} /> : null}
            {tab.key === 'collection' ? <IconMenu color={tint} /> : null}
            {tab.key === 'stats' ? <IconHistory color={tint} /> : null}
            {tab.key === 'settings' ? <IconSettings color={tint} knobFill={colors.canvas} /> : null}
            <Text style={[styles.label, { color: tint }, focused && styles.labelActive]}>{tab.label}</Text>
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
      backgroundColor: c.canvas,
      borderTopWidth: 1,
      borderTopColor: c.soft,
      paddingTop: 8,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: layout.tabBarItemHeight,
    },
    label: { ...typography.tab, fontWeight: undefined, fontFamily: font.medium, fontSize: 11, lineHeight: 16 },
    labelActive: { fontFamily: font.medium },
  });
