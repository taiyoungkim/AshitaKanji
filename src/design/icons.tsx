// Onikan 라인 아이콘 — handoff 프로토타입의 SVG를 그대로 이식.
//
// 네 탭 아이콘은 26px 박스 안에서 아트워크 크기(약 20px)와 스트로크 굵기를 광학적으로
// 맞춰 놓았다. 그 정렬이 viewBox 값에 들어 있으므로 viewBox 를 바꾸면 정렬이 깨진다.

import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

/** 오늘 — 오니기리. */
export function IconToday({ size = 26, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="1.5 1.5 29 29" fill="none">
      <Path
        d="M11 28V21C11 20.7348 11.1054 20.4804 11.2929 20.2929C11.4804 20.1054 11.7348 20 12 20H20C20.2652 20 20.5196 20.1054 20.7071 20.2929C20.8946 20.4804 21 20.7348 21 21V28"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.9113 18.8362C1.4313 22.8324 4.30505 27.9999 9.01005 27.9999H22.9901C27.6951 27.9999 30.5688 22.8324 28.0888 18.8362L21.0976 6.83618C18.7501 3.05493 13.2501 3.05493 10.9026 6.83618L3.9113 18.8362Z"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 메뉴 — 책. */
export function IconMenu({ size = 26, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="-0.2 -0.2 15.4 15.4" fill="none">
      <Path
        d="M4.5 1.25V14.25M7 5.25H11M1.5 1.25H11.5C12.6046 1.25 13.5 2.14543 13.5 3.25V12.25C13.5 13.3546 12.6046 14.25 11.5 14.25H1.5V1.25Z"
        stroke={color}
        strokeWidth={1.16}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 기록 — 시계. */
export function IconHistory({ size = 26, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="3.5 3.5 25 25" fill="none">
      <Path
        d="M16 27c6.075 0 11-4.925 11-11S22.075 5 16 5 5 9.925 5 16s4.925 11 11 11Z"
        stroke={color}
        strokeWidth={1.85}
        strokeLinejoin="round"
      />
      <Path
        d="M16 10v6.4l4.6 2.8"
        stroke={color}
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 설정 — 슬라이더. 노브를 배경색으로 채우지 않으면 선이 원을 관통한다. */
export function IconSettings({
  size = 26,
  color,
  knobFill,
}: IconProps & { knobFill: string }): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="3.5 3.5 25 25" fill="none">
      <Path d="M5 11h22M5 21h22" stroke={color} strokeWidth={1.85} strokeLinecap="round" />
      <Path
        d="M12.5 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20.5 24a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill={knobFill}
        stroke={color}
        strokeWidth={1.85}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 뒤로 / 더보기 셰브론. `direction` 으로 좌우를 고른다. */
export function IconChevron({
  size = 24,
  color,
  direction = 'right',
}: IconProps & { direction?: 'left' | 'right' }): React.ReactNode {
  const d = direction === 'left' ? 'M15 5 8 12l7 7' : 'M9 5l7 7-7 7';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 닫기 ✕. */
export function IconClose({ size = 24, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 발음 재생 — 스피커. */
export function IconSpeaker({ size = 20, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 5 6.5 9H3v6h3.5L11 19V5Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18.5 6.5a7.5 7.5 0 0 1 0 11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 목록 뷰로 전환. */
export function IconList({ size = 24, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M4 12h16M4 17h16"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 그리드 뷰로 전환. */
export function IconGrid({ size = 24, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 보상 체크 — 라임 배지 안에 들어간다. */
export function IconCheck({ size = 24, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5 10 17.5 19 7"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 연속 학습 — 불꽃. 스트릭이 0이면 회색으로 꺼둔다. */
export function IconFlame({ size = 26, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c.6 3 2.4 4.1 3.7 5.6A6.9 6.9 0 0 1 17.5 13a5.5 5.5 0 0 1-11 0c0-1.6.7-2.9 1.6-3.9.3 1 .9 1.7 1.7 2 .1-2.9 1.1-5.6 2.2-8.1Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 학습/테스트 — 학사모. */
export function IconStudy({ size = 24, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 테스트 점수 — 우상향 꺾은선. 기록 화면의 점수 카드에만 쓴다. */
export function IconTrendUp({ size = 24, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 16.5 9 10l4 4 7-7.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M15 6h5.5v5.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 복습 — 되돌아가는 화살표. */
export function IconRepeat({ size = 22, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h12a4 4 0 0 1 4 4v1M8 3 4 7l4 4M20 17H8a4 4 0 0 1-4-4v-1M16 21l4-4-4-4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 잠김 자물쇠 — 도감 목록의 잠긴 행. */
export function IconLock({ size = 16, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 10h12v10H6V10Zm3 0V7a3 3 0 1 1 6 0v3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={15} r={1.2} fill={color} />
    </Svg>
  );
}
