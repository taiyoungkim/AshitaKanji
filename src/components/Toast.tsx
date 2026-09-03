// 크로스플랫폼 토스트 — iOS엔 네이티브 토스트가 없어 오버레이로 구현.
// ToastProvider를 루트(_layout)에 두고 어디서든 useToast().show(message) 호출.
//
// iOS: react-native-screens 네이티브 스택이 일반 루트 오버레이를 덮어버리므로
//      FullWindowOverlay(네이티브 윈도우 위에 그림, 터치 비차단)로 감싼다.
// Android: zIndex/elevation 으로 충분.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { cardShadow, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';

type ToastContextValue = {
  show: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 1500;

// 토스트가 뜨는 높이 — edge-to-edge 에서는 제스처 바/내비 바 위로 더 올린다.
const TOAST_BOTTOM = 80;

function ToastOverlay({ message }: { message: string }): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const body = (
    <View pointerEvents="none" style={[styles.root, { bottom: TOAST_BOTTOM + insets.bottom }]}>
      {/* 화면 읽기 도구가 새 메시지를 읽도록 live region 으로 알린다. */}
      <View
        style={[styles.toast, cardShadow(colors)]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{body}</FullWindowOverlay>;
  }
  return body;
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const [message, setMessage] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setMessage(next);
    hideTimer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <View style={styles.host}>{children}</View>
      {message !== null && <ToastOverlay message={message} />}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    host: {
      flex: 1,
    },
    root: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: TOAST_BOTTOM,
      alignItems: 'center',
      zIndex: 9999,
      elevation: 9999,
    },
    toast: {
      maxWidth: '86%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: c.ink,
    },
    text: {
      ...typography.bodyStrong,
      color: c.onInk,
      textAlign: 'center',
    },
  });
