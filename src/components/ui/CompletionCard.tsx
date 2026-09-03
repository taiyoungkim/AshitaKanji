import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { IconCheck } from '~/design/icons';

export function CompletionCard({ title, caption }: { title: string; caption?: string }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <View style={styles.icon}>
          <IconCheck size={16} color={colors.onSecondary} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: c.secondarySoft,
      borderRadius: 12,
      padding: spacing.lg,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    icon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...typography.bodyStrong, color: c.ink },
    caption: { ...typography.caption, color: c.mute, textAlign: 'center' },
  });
