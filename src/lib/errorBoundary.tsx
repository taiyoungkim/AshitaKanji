// Design Ref: §7 Error Handling — root error boundary
// 진단 로그는 events 테이블에 type='crash'로 기록 (로컬만, 외부 송신 X)
//
// 바운더리 자체는 클래스라 훅을 쓸 수 없다 — 폴백 UI 만 함수 컴포넌트로 분리해
// 테마를 따르게 한다 (바운더리는 ThemeProvider 안쪽에 있다).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { font, layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { Button } from '~/components/ui/Button';
import { Overline } from '~/components/ui/Surface';

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
        <ErrorFallback diagnosticId={this.state.diagnosticId} onReset={this.handleReset} />
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({
  diagnosticId,
  onReset,
}: {
  diagnosticId: string | null;
  onReset: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Overline>오류</Overline>
      <Text style={styles.title}>문제가 생겼어요</Text>
      <Text style={styles.message}>앱에 예상치 못한 오류가 발생했어요. 다시 시도해 주세요.</Text>
      {diagnosticId && <Text style={styles.diagId}>진단 ID: {diagnosticId}</Text>}
      <Button label="다시 시도" onPress={onReset} style={styles.button} />
    </View>
  );
}

function generateDiagnosticId(): string {
  const now = Date.now();
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0');
  return `${now.toString(36)}-${rand}`;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: layout.gutter,
      backgroundColor: c.softer,
    },
    title: { ...typography.resultTitle, color: c.ink, marginTop: spacing.sm },
    message: {
      ...typography.body,
      textAlign: 'center',
      color: c.body,
      marginTop: spacing.md,
    },
    diagId: {
      fontFamily: font.regular,
      fontSize: 13,
      lineHeight: 18,
      color: c.body,
      marginTop: spacing.lg,
    },
    button: { alignSelf: 'stretch', marginTop: spacing.huge },
  });
