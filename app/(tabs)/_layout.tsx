// Design Ref: §2 Layer Architecture — bottom tab navigation
// 3 tabs: home(오늘) / stats(통계) / settings(설정).
// study(학습)는 탭이 아니라 root 스택 풀스크린 라우트(/study) — 몰입 학습.

import { Tabs } from 'expo-router';

export default function TabsLayout(): React.ReactNode {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0366d6',
        headerStyle: { backgroundColor: '#fafafa' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: '오늘' }} />
      <Tabs.Screen name="stats" options={{ title: '통계' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
