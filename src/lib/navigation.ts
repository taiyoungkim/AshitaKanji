// 홈으로 되돌아가는 단일 경로.
//
// replace 만 쓰면 스택에 있던 화면(인트로·홈)이 아래에 남아, 홈에서 뒤로가기를
// 눌렀을 때 앱을 벗어나는 대신 그 화면이 다시 뜬다. 스택을 먼저 비우고 홈으로
// 바꿔 끼운다.
import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

export function resetToHome(router: Router): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/home');
}
