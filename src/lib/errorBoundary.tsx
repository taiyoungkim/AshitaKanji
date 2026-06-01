// Design Ref: §7 Error Handling — root error boundary
// 진단 로그는 events 테이블에 type='crash'로 기록 (로컬만, 외부 송신 X)

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fontFamily, fontWeight, radius, spacing, typography } from '~/design/tokens';

interface State {
  hasError: boolean;
  error: Error | null;
  diagnosticId: string | null;
}

interface Props {
  children: React.ReactNode;
}

export class RootErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false, error: null, diagnosticId: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      diagnosticId: generateDiagnosticId(),
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Plan SC: 외부 송신 0건 — log only to console + (future) local events table
    console.error('[RootErrorBoundary]', error, info);
    // TODO: persist to events table when EventsRepo lands (module-3+)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, diagnosticId: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.kicker}>ERROR</Text>
          <Text style={styles.title}>문제가 생겼어요</Text>
          <Text style={styles.message}>
            앱에 예상치 못한 오류가 발생했습니다. 다시 시도해주세요.
          </Text>
          {this.state.diagnosticId && (
            <Text style={styles.diagId}>진단 ID: {this.state.diagnosticId}</Text>
          )}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function generateDiagnosticId(): string {
  const now = Date.now();
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${now.toString(36)}-${rand}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  kicker: { ...typography.tiny, color: colors.textSecondary, marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  message: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  diagId: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
    fontFamily: fontFamily.mono,
    textTransform: 'none',
    letterSpacing: 0,
  },
  button: {
    backgroundColor: colors.black,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeight.medium,
  },
});
