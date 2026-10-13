import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { font, spacing, type ThemeColors } from '~/design/tokens';
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const focused = tab.key === active;
        const tint = focused ? colors.primary : colors.body;
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
            hitSlop={8}
          >
            {tab.key === 'home' ? <IconToday color={tint} /> : null}
            {tab.key === 'collection' ? <IconMenu color={tint} /> : null}
            {tab.key === 'stats' ? <IconHistory color={tint} /> : null}
            {tab.key === 'settings' ? <IconSettings color={tint} knobFill={colors.canvas} /> : null}
            <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
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
      paddingBottom: 24,
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
