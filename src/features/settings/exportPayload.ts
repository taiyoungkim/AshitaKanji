// Design Ref: §4.6 ExportService — JSON 백업 페이로드 (순수, 네이티브 의존 X).
// 테스트 가능하도록 파일 IO/공유와 분리. ExportService 가 이 함수를 래핑.
//
// Privacy SC: 학습 데이터는 사용자가 명시적으로 내보낼 때만 기기 밖으로 나감
//             (자동 송신 0건). 이 페이로드는 로컬 파일로만 직렬화됨.

import type { UserCard } from '~/types/Card';
import type { DailyStats } from '~/types/DailyStats';
import type { ReviewLogRecord } from '~/types/ReviewLog';

/** Export 파일 포맷 버전 (스키마 진화 추적). */
export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportPayload {
  app: 'ashitakanji';
  schemaVersion: number;
  exportedAt: number; // unix ms
  dataVersion: string | null; // app_meta.data_version
  userCards: UserCard[];
  dailyStats: DailyStats[];
  appMeta: Record<string, string | null>;
  reviewLog?: ReviewLogRecord[]; // 선택 (큰 경우 제외)
}

export interface ExportParts {
  userCards: UserCard[];
  dailyStats: DailyStats[];
  appMeta: Record<string, string | null>;
  reviewLog: ReviewLogRecord[];
}

/** 순수: repo 결과 → 직렬화 가능한 페이로드. */
export function buildExportPayload(
  parts: ExportParts,
  includeReviewLog: boolean,
  exportedAt: number,
): ExportPayload {
  const payload: ExportPayload = {
    app: 'ashitakanji',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    dataVersion: parts.appMeta['data_version'] ?? null,
    userCards: parts.userCards,
    dailyStats: parts.dailyStats,
    appMeta: parts.appMeta,
  };
  if (includeReviewLog) payload.reviewLog = parts.reviewLog;
  return payload;
}

/** 파일명: ashitakanji-backup-YYYYMMDD.json (로컬 날짜). */
export function backupFilename(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `ashitakanji-backup-${y}${m}${day}.json`;
}

/** UTF-8 바이트 길이 (RN Buffer/Blob 비의존). */
export function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++; // surrogate pair = 1 code point, 4 bytes
    } else bytes += 3;
  }
  return bytes;
}
