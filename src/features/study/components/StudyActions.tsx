// Design Ref: Onikan handoff 화면 2 (`1b`) — 하단 액션(FSRS 평가).
//
// 4단계(모름·어려움·앎·쉬움)에서 망설임의 원인은 "어려움/앎"의 경계가 모호한 것이었다.
// 사용자는 "알겠다/모르겠다"만 즉각 판단하면 된다.
//
// 1차 학습(learning-flow-home-ux): "외웠어요"는 완전 암기를 약속해 부담이 컸다.
// 첫 만남에서는 '한 번 익혔어요'(뜻·예문을 살펴봄)와 '다시 볼래요'(이번 세션에서 한 번 더)로
// 묻고, 바로 이어지는 2차 기억 확인에서 다시 본다. FSRS 매핑은 그대로 Again/Good 이다 —
// '한 번 익혔어요'도 Good 일정으로 내일 이후 복습 대상에 남는다.
// 다음 복습 시점은 버튼에 쓰지 않는다(판단을 늘린다).

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
      negativeLabel="다시 볼래요"
      onNegative={() => onGrade(Grade.Again)}
      positiveLabel="한 번 익혔어요"
      onPositive={() => onGrade(Grade.Good)}
      disabled={disabled}
    />
  );
}
