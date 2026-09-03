import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '~/db/open';
import { useSessionStore } from '~/stores/SessionStore';
import { useSettingsStore, type CollectionView } from '~/stores/SettingsStore';
import type { CardWithProgress, Word } from '~/types/Card';
import type { SessionState, SessionSummary } from '~/types/Session';

export const VISUAL_NOW_MS = new Date(2026, 7, 7, 9, 41, 0, 0).getTime();
export const VISUAL_WORD_ID = 'w_80121247ba5c6668';

export const VISUAL_FIXTURE_IDS = [
  '01-home-study-before',
  '02-study-front',
  '03-study-reveal',
  '04-study-word-detail',
  '05-study-result',
  '06-onigiri-complete',
  '07-receipt',
  '08-home-review-done',
  '09-home-no-review',
  '10-home-all-done',
  '11-review-hub',
  '12-review-hub-filter',
  '13-menu-list',
  '14-menu-grid',
  '15-recipe-detail',
  '16-stats',
  '17-settings',
  '18-settings-learning',
  '19-settings-pronun',
  '20-settings-backup',
  '21-home-review-pending',
] as const;

export type VisualFixtureId = (typeof VISUAL_FIXTURE_IDS)[number];

export function isVisualCaptureEnabled(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_UI_CAPTURE === '1';
}

export function isVisualFixtureId(value: string | undefined): value is VisualFixtureId {
  return VISUAL_FIXTURE_IDS.includes(value as VisualFixtureId);
}

const studyWord: Word = {
  id: VISUAL_WORD_ID,
  level: 'N5',
  surface: '勉強',
  reading_kana: 'べんきょう',
  meaning_ko: '공부, 학습',
  part_of_speech: '명사',
  card_type: 'A',
  example_jp: '毎日 日本語を 勉強します。',
  example_ko: '매일 일본어를 공부합니다.',
  qa_status: 'verified',
  deprecated: 0,
  data_version: 1,
};

const studyCard: CardWithProgress = { word: studyWord, userCard: null };

function seedStudyStore(revealed: boolean): void {
  const current: SessionState = {
    sessionId: 9001,
    phase: 'main',
    mainQueue: Array.from({ length: 10 }, () => studyCard),
    againQueue: [],
    currentIndex: 0,
    doneNew: 0,
    doneReview: 0,
    againSubmissions: new Map(),
    startedAtMs: VISUAL_NOW_MS,
  };
  useSessionStore.setState({
    engine: {} as never,
    current,
    card: studyCard,
    reveal: revealed,
    cardShownMs: VISUAL_NOW_MS,
    lastRevealMs: revealed ? 1200 : null,
    summary: null,
    busy: false,
    dataEmpty: false,
  });
}

function seedDoneStore(sessionId: number): void {
  const summary: SessionSummary = {
    sessionId,
    durationSec: 360,
    newCount: 12,
    reviewCount: 0,
    againCount: 3,
    goodEasyCount: 9,
    streakDays: 5,
  };
  useSessionStore.setState({
    engine: {} as never,
    current: null,
    card: null,
    reveal: false,
    summary,
    busy: false,
    dataEmpty: false,
  });
}

async function resetMutableData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM review_log;
    DELETE FROM reading_progress;
    DELETE FROM user_card;
    DELETE FROM daily_stats;
    DELETE FROM session;
    DELETE FROM events WHERE type = 'reading_pass';
  `);
}

async function addCompletedSession(
  db: SQLiteDatabase,
  id: number,
  endedAt: number,
  options: { again?: number; sourceSessionId?: number | null; mode?: 'new' | 'review' | 'weakness' } = {},
): Promise<void> {
  const mode = options.mode ?? 'new';
  await db.runAsync(
    `INSERT INTO session
      (id, mode, started_at, ended_at, ended_reason, planned_new, planned_review,
       planned_scan, done_new, done_review, done_scan, again_count, source_session_id)
     VALUES (?, ?, ?, ?, 'completed', 12, 0, 0, 12, 0, 0, ?, ?)`,
    [id, mode, endedAt - 360_000, endedAt, options.again ?? 0, options.sourceSessionId ?? null],
  );
}

async function seedIngredientSessions(db: SQLiteDatabase, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await addCompletedSession(db, index + 1, VISUAL_NOW_MS - (count - index) * 86_400_000);
  }
}

async function seedReading(db: SQLiteDatabase, covered = 32): Promise<void> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM word
     WHERE level = 'N5' AND reading_chapter = 1 AND deprecated = 0
     ORDER BY frequency DESC, id ASC LIMIT ?`,
    [covered],
  );
  for (const row of rows) {
    await db.runAsync(
      `INSERT INTO reading_progress (word_id, chapter, known, seen, updated_at)
       VALUES (?, 1, 0, 1, ?)`,
      [row.id, VISUAL_NOW_MS],
    );
  }
}

async function seedHome(db: SQLiteDatabase, fixture: VisualFixtureId): Promise<void> {
  await seedIngredientSessions(db, 6);
  await seedReading(db, fixture === '10-home-all-done' ? 50 : 32);

  if (fixture === '01-home-study-before') return;

  await db.execAsync(`
    INSERT INTO user_card
      (word_id, difficulty, stability, scheduled_days, elapsed_days, reps, lapses,
       last_review, due, state, note, leech)
    SELECT id, 5, 1, 30, 0, 1, 0, ${VISUAL_NOW_MS}, ${VISUAL_NOW_MS + 30 * 86_400_000},
           'review', NULL, 0
    FROM word
    WHERE level = 'N5' AND deprecated = 0 AND qa_status = 'verified';
  `);

  const studyId = 100;
  await addCompletedSession(db, studyId, VISUAL_NOW_MS, {
    again: fixture === '09-home-no-review' ? 0 : 13,
  });
  if (fixture === '08-home-review-done' || fixture === '10-home-all-done') {
    await addCompletedSession(db, 101, VISUAL_NOW_MS + 1_000, {
      mode: 'weakness',
      sourceSessionId: studyId,
    });
  }
}

async function seedDone(db: SQLiteDatabase, fixture: VisualFixtureId): Promise<void> {
  const count = fixture === '07-receipt' ? 1 : 4;
  await seedIngredientSessions(db, count);
  seedDoneStore(count);
}

async function seedStats(db: SQLiteDatabase): Promise<void> {
  const wordRows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM word WHERE level = 'N5' AND deprecated = 0 AND qa_status = 'verified' ORDER BY id LIMIT 55`,
  );
  let sessionId = 1;
  let logId = 1;
  for (let day = 5; day >= 0; day -= 1) {
    const endedAt = VISUAL_NOW_MS - day * 86_400_000;
    await addCompletedSession(db, sessionId, endedAt);
    const count = day === 0 ? 12 : day === 5 ? 7 : 9;
    for (let index = 0; index < count; index += 1) {
      const word = wordRows[(logId - 1) % wordRows.length];
      if (!word) continue;
      await db.runAsync(
        `INSERT INTO review_log
          (id, word_id, reviewed_at, grade, state_before, state_after, scheduled_days,
           elapsed_days, stability_after, difficulty_after, reveal_ms, session_id)
         VALUES (?, ?, ?, ?, 'new', 'review', 1, 0, 1, 5, 1200, ?)`,
        [logId, word.id, endedAt, day === 0 || index < 7 ? 3 : 1, sessionId],
      );
      logId += 1;
    }
    sessionId += 1;
  }
}

function seedSettings(view: CollectionView): void {
  useSettingsStore.setState({
    selectedLevels: ['N5'],
    dailyNewLimit: 12,
    ttsEnabled: true,
    ttsSpeed: 0.9,
    autoPlayWordTtsOnReveal: true,
    collectionView: view,
    themePreference: 'light',
    tutorialCompleted: true,
    _hydrated: true,
  });
}

export async function prepareVisualFixture(fixture: VisualFixtureId): Promise<string> {
  if (!isVisualCaptureEnabled()) throw new Error('Visual capture mode is disabled');

  seedSettings(fixture === '14-menu-grid' ? 'grid' : 'list');
  if (
    fixture.startsWith('01-') ||
    fixture.startsWith('08-') ||
    fixture.startsWith('09-') ||
    fixture.startsWith('10-') ||
    fixture.startsWith('21-')
  ) {
    useSettingsStore.setState({ dailyNewLimit: 20 });
  }
  useSessionStore.getState().reset();
  const db = await getDatabase();
  await resetMutableData(db);

  if (fixture.startsWith('home-')) {
    // Kept for defensive compatibility with hand-written fixture ids.
    await seedHome(db, fixture);
  } else if (
    fixture.startsWith('01-') ||
    fixture.startsWith('08-') ||
    fixture.startsWith('09-') ||
    fixture.startsWith('10-') ||
    fixture.startsWith('21-')
  ) {
    await seedHome(db, fixture);
  } else if (fixture === '02-study-front' || fixture === '03-study-reveal') {
    seedStudyStore(fixture === '03-study-reveal');
  } else if (fixture === '05-study-result' || fixture === '06-onigiri-complete' || fixture === '07-receipt') {
    await seedDone(db, fixture);
  } else if (fixture === '11-review-hub' || fixture === '12-review-hub-filter') {
    await seedReading(db, 32);
    for (let index = 0; index < 20; index += 1) {
      await db.runAsync(
        `INSERT INTO events (ts, type, payload) VALUES (?, 'reading_pass', 'N5-1')`,
        [VISUAL_NOW_MS - index * 86_400_000],
      );
    }
  } else if (fixture === '13-menu-list' || fixture === '14-menu-grid' || fixture === '15-recipe-detail') {
    await seedIngredientSessions(db, 9);
  } else if (fixture === '16-stats') {
    await seedStats(db);
  }

  const query = `uiFixture=${encodeURIComponent(fixture)}`;
  switch (fixture) {
    case '01-home-study-before':
    case '08-home-review-done':
    case '09-home-no-review':
    case '10-home-all-done':
    case '21-home-review-pending':
      return `/home?${query}`;
    case '02-study-front':
    case '03-study-reveal':
      return `/study?${query}`;
    case '04-study-word-detail':
      return `/word/${VISUAL_WORD_ID}?${query}`;
    case '05-study-result':
    case '06-onigiri-complete':
    case '07-receipt':
      return `/done?${query}`;
    case '11-review-hub':
    case '12-review-hub-filter':
      return `/reading?${query}`;
    case '13-menu-list':
    case '14-menu-grid':
      return `/collection?${query}`;
    case '15-recipe-detail':
      return `/onigiri/onigiri-003?${query}`;
    case '16-stats':
      return `/stats?${query}`;
    case '17-settings':
      return `/settings?${query}`;
    case '18-settings-learning':
      return `/settings-learning?${query}`;
    case '19-settings-pronun':
      return `/settings-pronunciation?${query}`;
    case '20-settings-backup':
      return `/settings-backup?${query}`;
  }
}
