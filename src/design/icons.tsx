// Onikan 라인 아이콘 — handoff 프로토타입의 SVG를 그대로 이식.
//
// 네 탭 아이콘은 28px 박스 안에서 아트워크 크기와 스트로크 굵기를 광학적으로
// 맞춰 놓았다. 그 정렬이 viewBox 값에 들어 있으므로 viewBox 를 바꾸면 정렬이 깨진다.

import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

/** 오늘 — 오니기리. */
export function IconToday({ size = 28, color }: IconProps): React.ReactNode {
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

/** 메뉴 — 스프링 노트 안의 고양이. Figma `537:22642` 원본 벡터. */
export function IconMenu({ size = 28, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M4.49121 3.30217C4.49121 2.6457 5.02339 2.11353 5.67986 2.11353H22.3209C22.9774 2.11353 23.5096 2.6457 23.5096 3.30217V24.6978C23.5096 25.3543 22.9774 25.8865 22.3209 25.8865H5.67986C5.02339 25.8865 4.49121 25.3543 4.49121 24.6978V3.30217Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M1.93359 7.60718H4.49072M1.93359 14H4.49072M1.93359 20.3928H4.49072"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.6982 8.43918C17.9179 8.41752 18.135 8.53104 18.3281 8.68332C18.4208 8.75645 18.4792 8.84239 18.5215 8.89523C18.6772 9.08982 18.8047 9.34974 18.917 9.65598C18.9956 9.87048 19.05 10.1635 19.0986 10.4792C19.1362 10.7236 19.163 10.9947 19.1816 11.2214C19.7601 11.9251 20.1025 12.8716 20.1025 14.1228C20.1024 17.7653 16.1694 18.2344 14 18.2351C11.8306 18.2357 7.89794 18.1011 7.89746 14.1228C7.89737 12.9393 8.2524 12.0088 8.84961 11.2986C8.85959 11.0709 8.87682 10.798 8.90527 10.5515C8.94199 10.2335 8.98614 9.93811 9.05664 9.72043C9.15731 9.40966 9.27387 9.14491 9.42188 8.94406C9.46233 8.88918 9.51779 8.80117 9.60742 8.72434C9.79426 8.56424 10.0055 8.44072 10.2256 8.45285L10.2695 8.45773L10.4092 8.47922C10.4628 8.48973 10.5232 8.50501 10.5879 8.52805C10.7032 8.5691 10.945 8.68098 11.2188 8.84836H11.2197C11.2963 8.89521 11.4693 9.00215 11.7549 9.25266C11.9113 9.38989 12.0385 9.50254 12.1309 9.58371C12.7276 9.47184 13.3575 9.41867 14 9.41867C14.6618 9.41867 15.3103 9.46431 15.9229 9.56809C16 9.49446 16.0943 9.40606 16.2021 9.30344C16.4781 9.04075 16.647 8.92575 16.7217 8.8757C16.9888 8.69667 17.2264 8.57494 17.3398 8.52902C17.467 8.47754 17.5777 8.45903 17.6543 8.44504L17.6982 8.43918Z"
        fill={color}
      />
    </Svg>
  );
}

/** 기록 — 시계. */
export function IconHistory({ size = 28, color }: IconProps): React.ReactNode {
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
  size = 28,
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

/** 한자 따라쓰기 — 대각선 스타일러스. */
export function IconPencil({ size = 20, color }: IconProps): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M5.5 14.5 14.5 5.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
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
