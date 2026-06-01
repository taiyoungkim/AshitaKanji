// Root index — 앱 진입 시 항상 인트로(고양이 첫 인사) 먼저.
// 인트로 "시작하기" → /home.

import { Redirect } from 'expo-router';

export default function Index(): React.ReactNode {
  return <Redirect href="/intro" />;
}
