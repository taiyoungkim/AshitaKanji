// 크로스플랫폼 토스트 — iOS엔 네이티브 토스트가 없어 오버레이로 구현.
// ToastProvider를 루트(_layout)에 두고 어디서든 useToast().show(message) 호출.
//
// iOS: react-native-screens 네이티브 스택이 일반 루트 오버레이를 덮어버리므로
//      FullWindowOverlay(네이티브 윈도우 위에 그림, 터치 비차단)로 감싼다.
// Android: zIndex/elevation 으로 충분.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

type ToastContextValue = {
  show: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 1500;

function ToastOverlay({ message }: { message: string }): React.ReactNode {
  const body = (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.toast}>
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

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    maxWidth: '86%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(28,28,30,0.95)',
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
