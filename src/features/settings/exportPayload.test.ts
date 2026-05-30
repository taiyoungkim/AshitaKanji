// Design Ref: §8 Test Plan — ExportService (JSON 스키마 검증, 순수 부분).

import { describe, expect, it } from 'vitest';
import type { UserCard } from '~/types/Card';
import type { DailyStats } from '~/types/DailyStats';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import { Grade } from '~/types/Grade';
import {
  EXPORT_SCHEMA_VERSION,
  backupFilename,
  buildExportPayload,
  utf8ByteLength,
  type ExportParts,
} from './exportPayload';

const userCard: UserCard = {
  word_id: 'w1',
  difficulty: 5,
  stability: 10,
  scheduled_days: 3,
  elapsed_days: 1,
  reps: 4,
  lapses: 0,
  last_review: 1_700_000_000_000,
  due: 1_700_200_000_000,
  state: 'review',
  note: null,
  leech: 0,
};

const dailyStat: DailyStats = {
  date: '2024-01-01',
  new_count: 5,
  review_count: 12,
  scan_count: 0,
  scan_promoted_count: 0,
  again_count: 2,
  good_easy_count: 10,
  total_time_sec: 600,
  session_count: 1,
  completed_session_count: 1,
  avg_reveal_ms: 1500,
};

const reviewLog: ReviewLogRecord = {
  id: 1,
  word_id: 'w1',
  reviewed_at: 1_700_000_000_000,
  grade: Grade.Good,
  state_before: 'review',
  state_after: 'review',
  scheduled_days: 3,
  elapsed_days: 1,
  stability_after: 10,
  difficulty_after: 5,
  reveal_ms: 1500,
  session_id: 1,
};

const parts: ExportParts = {
  userCards: [userCard],
  dailyStats: [dailyStat],
  appMeta: { data_version: '7', install_date: '2024-01-01' },
  reviewLog: [reviewLog],
};

describe('buildExportPayload', () => {
  it('includes core sections + schema metadata', () => {
    const p = buildExportPayload(parts, false, 1_700_500_000_000);
    expect(p.app).toBe('ashitakanji');
    expect(p.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(p.exportedAt).toBe(1_700_500_000_000);
    expect(p.dataVersion).toBe('7');
    expect(p.userCards).toHaveLength(1);
    expect(p.dailyStats).toHaveLength(1);
    expect(p.appMeta).toEqual(parts.appMeta);
  });

  it('omits reviewLog when includeReviewLog=false', () => {
    const p = buildExportPayload(parts, false, 0);
    expect(p.reviewLog).toBeUndefined();
  });

  it('includes reviewLog when includeReviewLog=true', () => {
    const p = buildExportPayload(parts, true, 0);
    expect(p.reviewLog).toHaveLength(1);
  });

  it('round-trips through JSON.stringify/parse losslessly', () => {
    const p = buildExportPayload(parts, true, 0);
    const back = JSON.parse(JSON.stringify(p));
    expect(back).toEqual(p);
  });

  it('dataVersion null when app_meta missing data_version', () => {
    const p = buildExportPayload({ ...parts, appMeta: {} }, false, 0);
    expect(p.dataVersion).toBeNull();
  });
});

describe('backupFilename', () => {
  it('formats ashitakanji-backup-YYYYMMDD.json', () => {
    const ms = new Date(2024, 0, 9, 14, 30).getTime(); // 2024-01-09 local
    expect(backupFilename(ms)).toBe('ashitakanji-backup-20240109.json');
  });
});

describe('utf8ByteLength', () => {
  it('counts ASCII as 1 byte', () => {
    expect(utf8ByteLength('abc')).toBe(3);
  });
  it('counts Japanese/Korean as 3 bytes', () => {
    expect(utf8ByteLength('日')).toBe(3);
    expect(utf8ByteLength('한')).toBe(3);
  });
  it('counts emoji (surrogate pair) as 4 bytes', () => {
    expect(utf8ByteLength('🎉')).toBe(4);
  });
});
