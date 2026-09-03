// Design Ref: Onikan handoff 화면 2 (`1b`) — 진행 헤더.
// 세션 상태 → 진행 수치 변환만 담당하고, 그리기는 StudyProgressHeader 가 한다.

import type { SessionState } from '~/types/Session';
import { StudyProgressHeader } from './StudyProgressHeader';

interface Props {
  state: SessionState;
  onClose: () => void;
}

export function StudyHeader({ state, onClose }: Props): React.ReactNode {
  const queue = state.phase === 'again' ? state.againQueue : state.mainQueue;
  const total = Math.max(queue.length, 1);
  const done = Math.min(state.currentIndex, total);

  return <StudyProgressHeader done={done} total={total} onClose={onClose} />;
}
