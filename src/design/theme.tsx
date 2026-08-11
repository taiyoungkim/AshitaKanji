// Onikan 테마 — 라이트/다크 1급 지원.
//
// 화면은 `useThemedStyles(makeStyles)` 로 스타일을 만든다:
//
//   const makeStyles = (c: ThemeColors) => StyleSheet.create({ ... });
//   const styles = useThemedStyles(makeStyles);
//
// 팩토리는 모듈 최상위에 두어야 캐시가 재사용된다 (컴포넌트 안에서 새로 만들면 매 렌더 재생성).

import { createContext, useContext, useMemo } from 'react';
import { useColorScheme, type StyleSheet } from 'react-native';
import { useSettingsStore } from '~/stores/SettingsStore';
import { darkColors, lightColors, makeButtons, type ThemeColors } from './tokens';

export type ThemeName = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  buttons: ReturnType<typeof makeButtons>;
}

const lightTheme: Theme = {
  name: 'light',
  colors: lightColors,
  buttons: makeButtons(lightColors),
};

const darkTheme: Theme = {
  name: 'dark',
  colors: darkColors,
  buttons: makeButtons(darkColors),
};

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const scheme = useColorScheme();
  const preference = useSettingsStore((state) => state.themePreference);
  const resolvedName: ThemeName =
    preference === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = resolvedName === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** 색만 필요할 때의 축약. */
export function useColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

type StyleFactory<T extends StyleSheet.NamedStyles<T>> = (c: ThemeColors) => T;

// 팩토리별 테마 캐시 — 같은 팩토리+테마 조합은 StyleSheet 를 한 번만 만든다.
const styleCache = new WeakMap<StyleFactory<never>, Partial<Record<ThemeName, unknown>>>();

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: StyleFactory<T>): T {
  const theme = useTheme();
  return useMemo(() => {
    const key = factory as unknown as StyleFactory<never>;
    let perTheme = styleCache.get(key);
    if (!perTheme) {
      perTheme = {};
      styleCache.set(key, perTheme);
    }
    const hit = perTheme[theme.name];
    if (hit) return hit as T;
    const built = factory(theme.colors);
    perTheme[theme.name] = built;
    return built;
  }, [factory, theme]);
}
