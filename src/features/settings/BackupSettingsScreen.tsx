import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import { Button } from '~/components/ui/Button';
import { spacing, typography, type ThemeColors } from '~/design/tokens';
import { useTheme, useThemedStyles } from '~/design/theme';
import { SettingsPage } from './SettingsControls';
import { buildExportService } from './buildExportService';

export default function BackupSettingsScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const service = await buildExportService();
      const { path, bytes } = await service.exportToJson(true);
      await service.shareFile(path);
      Alert.alert('백업 생성됨', `${Math.max(1, Math.round(bytes / 1024))}KB 파일을 저장하거나 공유할 수 있어요.`);
    } catch (error) {
      Alert.alert('내보내기 실패', error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SettingsPage title="데이터 백업">
      <Text style={styles.sectionTitle}>학습 기록 내보내기</Text>
      <Text style={styles.description}>
        학습 기록을 JSON 파일로 내보낼 수 있습니다.{`\n`}내보낸 파일은 저장하거나 다른 앱으로 공유할 수 있어요.
      </Text>
      {exporting ? (
        <ActivityIndicator style={styles.loading} color={colors.ink} />
      ) : (
        <Button label="백업 내보내기 (JSON)" variant="outline" onPress={() => void exportData()} />
      )}
      <Text style={styles.privacy}>
        모든 학습 데이터는 이 기기에만 저장돼요.{`\n`}외부로 전송하지 않습니다.
      </Text>
    </SettingsPage>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionTitle: { ...typography.listTitle, color: colors.ink, marginBottom: spacing.sm },
    description: { ...typography.body, color: colors.body, marginBottom: spacing.lg },
    loading: { height: 56 },
    privacy: { ...typography.caption, color: colors.mute, textAlign: 'center', marginTop: spacing.xl },
  });
