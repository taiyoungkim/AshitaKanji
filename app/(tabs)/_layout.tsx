// Design Ref: §2 Layer Architecture — bottom tab navigation
// 4 tabs: home(오늘) / study(학습) / stats(통계) / settings(설정)

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
      <Tabs.Screen name="study" options={{ title: '학습' }} />
      <Tabs.Screen name="stats" options={{ title: '통계' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
