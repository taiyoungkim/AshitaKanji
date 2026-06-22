// Design Ref: ONIGIRI SHOP redesign — Tab Bar (무채색, 텍스트 중심).
// 4 tabs: home(오늘) / collection(메뉴) / stats(기록) / settings(설정).
// study(학습)는 탭이 아니라 root 스택 풀스크린 라우트(/study) — 몰입 학습.

import { Tabs } from 'expo-router';
import { AppTabBar } from '~/components/AppTabBar';
import { colors, typography } from '~/design/tokens';

export default function TabsLayout(): React.ReactNode {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { ...typography.h2, color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="home" options={{ title: '오늘' }} />
      <Tabs.Screen name="collection" options={{ title: '메뉴' }} />
      <Tabs.Screen name="stats" options={{ title: '기록' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
