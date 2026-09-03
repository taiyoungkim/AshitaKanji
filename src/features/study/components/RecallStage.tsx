import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '~/components/ui/Button';
import { layout, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';

interface Props {
  surface: string;
  reading: string | null;
  meaning: string;
  revealed: boolean;
  onReveal: () => void;
  onUnknown: () => void;
  onKnown: () => void;
  disabled?: boolean;
}

/** today-review / review-hub HTML 회상 카드 — 공개 후 모름/안다. */
export function RecallStage({
  surface,
  reading,
  meaning,
  revealed,
  onReveal,
  onUnknown,
  onKnown,
  disabled,
}: Props): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Pressable
        style={styles.stage}
        onPress={revealed ? undefined : onReveal}
        accessibilityRole={revealed ? undefined : 'button'}
        accessibilityLabel={revealed ? undefined : '탭해서 뜻 보기'}
      >
        <Text style={styles.word}>{surface}</Text>
        {reading ? <Text style={styles.reading}>{reading}</Text> : null}
        {revealed ? (
          <Text style={styles.meaning}>{meaning}</Text>
        ) : (
          <Text style={styles.hint}>탭해서 뜻 보기</Text>
        )}
      </Pressable>
      {revealed ? (
        <View style={styles.grades}>
          <Button label="모름" variant="outline" tall style={styles.grade} onPress={onUnknown} disabled={disabled} />
          <Button label="안다" variant="ink" tall style={styles.grade} onPress={onKnown} disabled={disabled} />
        </View>
      ) : (
        <View style={styles.revealWrap}>
          <Button label="뜻 보기" variant="brand" onPress={onReveal} disabled={disabled} />
        </View>
      )}
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: layout.gutter,
    },
    word: { ...typography.cardWord, color: c.ink, textAlign: 'center' },
    reading: { ...typography.reading, color: c.body, textAlign: 'center' },
    meaning: { ...typography.meaning, color: c.ink, textAlign: 'center', marginTop: spacing.xs },
    hint: { ...typography.body, color: c.mute, marginTop: spacing.sm },
    grades: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    grade: { flex: 1 },
    revealWrap: {
      paddingHorizontal: layout.gutter,
      paddingTop: layout.gutter,
      paddingBottom: spacing.xxl,
    },
  });
