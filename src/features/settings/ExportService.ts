// Design Ref: §4.6 ExportService — JSON 내보내기 + 공유 시트.
// Plan SC: user_card 전체 + daily_stats 전체 + app_meta + review_log(선택).
//          파일명 ashitakanji-backup-YYYYMMDD.json, FileSystem.documentDirectory.
//
// 순수 로직(buildExportPayload)은 exportPayload.ts 에 분리 (테스트). 여기선 파일 IO/공유.

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { UserCardRepo } from '~/db/repos/UserCardRepo';
import type { DailyStatsRepo } from '~/db/repos/DailyStatsRepo';
import type { AppMetaRepo } from '~/db/repos/AppMetaRepo';
import type { ReviewLogRepo } from '~/db/repos/ReviewLogRepo';
import {
  backupFilename,
  buildExportPayload,
  utf8ByteLength,
  type ExportPayload,
} from './exportPayload';

export class ExportService {
  constructor(
    private readonly userCardRepo: UserCardRepo,
    private readonly dailyStatsRepo: DailyStatsRepo,
    private readonly appMetaRepo: AppMetaRepo,
    private readonly reviewLogRepo: ReviewLogRepo,
    private readonly now: () => number = Date.now,
  ) {}

  async buildPayload(includeReviewLog: boolean): Promise<ExportPayload> {
    const [userCards, dailyStats, appMeta, reviewLog] = await Promise.all([
      this.userCardRepo.findAll(),
      this.dailyStatsRepo.findAll(),
      this.appMetaRepo.getAll(),
      includeReviewLog ? this.reviewLogRepo.findAll() : Promise.resolve([]),
    ]);
    return buildExportPayload(
      { userCards, dailyStats, appMeta, reviewLog },
      includeReviewLog,
      this.now(),
    );
  }

  /** JSON 직렬화 → documentDirectory 파일 기록. 반환: 경로 + 바이트. */
  async exportToJson(
    includeReviewLog: boolean,
  ): Promise<{ path: string; bytes: number }> {
    const payload = await this.buildPayload(includeReviewLog);
    const json = JSON.stringify(payload, null, 2);
    const dir = FileSystem.documentDirectory;
    if (!dir) throw new Error('ExportService: documentDirectory unavailable');
    const path = dir + backupFilename(this.now());
    await FileSystem.writeAsStringAsync(path, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return { path, bytes: utf8ByteLength(json) };
  }

  /** OS 공유 시트 (사용자 명시적 행위). 미지원 환경이면 no-op. */
  async shareFile(path: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: '오니칸 백업 내보내기',
      UTI: 'public.json',
    });
  }
}
