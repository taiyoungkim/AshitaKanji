// Design Ref: Onikan handoff 화면 2 (`1b`) — 하단 액션(FSRS 평가).
//
// 4단계(모름·어려움·앎·쉬움)에서 망설임의 원인은 "어려움/앎"의 경계가 모호한 것이었다.
// 사용자는 "알겠다/모르겠다"만 즉각 판단하면 된다.
//
// 두 라벨 모두 '현재 내 상태'로 맞춘다 — "또 볼래요" 같은 의사 표현은 시제 축이 달라
// "외웠어요"와 나란히 비교되지 않는다. 다음 복습 시점은 버튼에 쓰지 않는다(판단을 늘린다).

import { Grade } from '~/types/Grade';
import { StudyActionBar } from './StudyActionBar';

interface Props {
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

export function StudyActions({ revealed, onReveal, onGrade, disabled }: Props): React.ReactNode {
  return (
    <StudyActionBar
      revealed={revealed}
      onReveal={onReveal}
      negativeLabel="아직이에요"
      onNegative={() => onGrade(Grade.Again)}
      positiveLabel="외웠어요"
      onPositive={() => onGrade(Grade.Good)}
      disabled={disabled}
    />
  );
}
