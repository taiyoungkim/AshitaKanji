// Design Ref: §3 Data Model — SQLite schema
// Plan Ref: §9 (전체 8 tables: word, user_card, review_log, scan_result, session, events, daily_stats, app_meta)
// Plan SC:
//   - is_beta 컬럼 폐기 (v0.6)
//   - example_jp_id/author + ko_id/author + license 5컬럼 추가 (v0.7 Tatoeba)
//   - daily_stats = lazy rollup (자정 cron 없음)

export const SCHEMA_V1: string[] = [
  // ─────────────────────────────────────────────────────────────
  // word — vocabulary master (shipped in assets/jlpt.db)
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS word (
    id              TEXT    PRIMARY KEY,
    level           TEXT    NOT NULL,
    surface         TEXT    NOT NULL,
    reading_kana    TEXT    NOT NULL,
    furigana        TEXT,
    meaning_ko      TEXT    NOT NULL,
    part_of_speech  TEXT,
    card_type       TEXT    NOT NULL CHECK (card_type IN ('A','B','C','D','E')),
    example_jp      TEXT,
    example_ko      TEXT,
    example_jp_id   INTEGER,
    example_jp_author TEXT,
    example_ko_id   INTEGER,
    example_ko_author TEXT,
    example_license TEXT,
    alt_forms       TEXT,
    disambig        TEXT,
    source          TEXT,
    qa_status       TEXT    NOT NULL CHECK (qa_status IN ('verified','auto','needs_review','rejected')),
    deprecated      INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1)),
    tags            TEXT,
    data_version    INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_word_level    ON word(level)`,
  `CREATE INDEX IF NOT EXISTS idx_word_qa       ON word(qa_status)`,
  `CREATE INDEX IF NOT EXISTS idx_word_deprecated ON word(deprecated)`,

  // ─────────────────────────────────────────────────────────────
  // user_card — per-user FSRS scheduling state
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_card (
    word_id         TEXT    PRIMARY KEY,
    difficulty      REAL    NOT NULL,
    stability       REAL    NOT NULL,
    scheduled_days  INTEGER NOT NULL DEFAULT 0,
    elapsed_days    INTEGER NOT NULL DEFAULT 0,
    reps            INTEGER NOT NULL DEFAULT 0,
    lapses          INTEGER NOT NULL DEFAULT 0,
    last_review     INTEGER NOT NULL DEFAULT 0,
    due             INTEGER NOT NULL,
    state           TEXT    NOT NULL CHECK (state IN ('new','learning','review','relearning')),
    note            TEXT,
    leech           INTEGER NOT NULL DEFAULT 0 CHECK (leech IN (0,1)),
    FOREIGN KEY (word_id) REFERENCES word(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_card_due    ON user_card(due)`,
  `CREATE INDEX IF NOT EXISTS idx_user_card_state  ON user_card(state)`,
  `CREATE INDEX IF NOT EXISTS idx_user_card_leech  ON user_card(leech)`,

  // ─────────────────────────────────────────────────────────────
  // review_log — full review history (FSRS audit, undo, stats source)
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS review_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id           TEXT    NOT NULL,
    reviewed_at       INTEGER NOT NULL,
    grade             INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
    state_before      TEXT,
    state_after       TEXT    NOT NULL,
    scheduled_days    INTEGER NOT NULL,
    elapsed_days      INTEGER NOT NULL,
    stability_after   REAL    NOT NULL,
    difficulty_after  REAL    NOT NULL,
    reveal_ms         INTEGER,
    session_id        INTEGER,
    FOREIGN KEY (word_id)    REFERENCES word(id),
    FOREIGN KEY (session_id) REFERENCES session(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_review_log_word    ON review_log(word_id)`,
  `CREATE INDEX IF NOT EXISTS idx_review_log_session ON review_log(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_review_log_time    ON review_log(reviewed_at)`,

  // ─────────────────────────────────────────────────────────────
  // scan_result — fast scan / classification mode results
  // (대량 노출은 FSRS에 바로 넣지 않음, 후보만 promote)
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS scan_result (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id         TEXT    NOT NULL,
    scanned_at      INTEGER NOT NULL,
    result          TEXT    NOT NULL CHECK (result IN ('known','confused','unknown','later')),
    batch_size      INTEGER,
    promoted_to_srs INTEGER NOT NULL DEFAULT 0 CHECK (promoted_to_srs IN (0,1)),
    session_id      INTEGER,
    FOREIGN KEY (word_id)    REFERENCES word(id),
    FOREIGN KEY (session_id) REFERENCES session(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scan_word    ON scan_result(word_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scan_result  ON scan_result(result)`,
  `CREATE INDEX IF NOT EXISTS idx_scan_session ON scan_result(session_id)`,

  // ─────────────────────────────────────────────────────────────
  // session — study session lifecycle
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS session (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mode            TEXT    NOT NULL CHECK (mode IN ('review','new','scan','weakness')),
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    ended_reason    TEXT CHECK (ended_reason IN ('completed','abandoned','app_killed')),
    planned_new     INTEGER,
    planned_review  INTEGER,
    planned_scan    INTEGER,
    done_new        INTEGER NOT NULL DEFAULT 0,
    done_review     INTEGER NOT NULL DEFAULT 0,
    done_scan       INTEGER NOT NULL DEFAULT 0,
    again_count     INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_session_started ON session(started_at)`,

  // ─────────────────────────────────────────────────────────────
  // events — lightweight UI/analytic events (local only)
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      INTEGER NOT NULL,
    type    TEXT    NOT NULL,
    payload TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`,
  `CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts)`,

  // ─────────────────────────────────────────────────────────────
  // daily_stats — lazy rollup (재계산 idempotent)
  // 호출 시점: 앱 시작 / 세션 종료 / 통계 화면 진입
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_stats (
    date                      TEXT    PRIMARY KEY,
    new_count                 INTEGER NOT NULL DEFAULT 0,
    review_count              INTEGER NOT NULL DEFAULT 0,
    scan_count                INTEGER NOT NULL DEFAULT 0,
    scan_promoted_count       INTEGER NOT NULL DEFAULT 0,
    again_count               INTEGER NOT NULL DEFAULT 0,
    good_easy_count           INTEGER NOT NULL DEFAULT 0,
    total_time_sec            INTEGER NOT NULL DEFAULT 0,
    session_count             INTEGER NOT NULL DEFAULT 0,
    completed_session_count   INTEGER NOT NULL DEFAULT 0,
    avg_reveal_ms             REAL
  )`,

  // ─────────────────────────────────────────────────────────────
  // app_meta — key/value (data_version, install_date, etc)
  // ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS app_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  )`,
];

/** Returns SQL statements for the given target schema version. */
export function migrationsTo(targetVersion: number): string[] {
  if (targetVersion < 1) return [];
  if (targetVersion === 1) return SCHEMA_V1;
  // Future migrations append here.
  throw new Error(`Unknown schema version: ${targetVersion}`);
}

export const CURRENT_SCHEMA_VERSION = 1;
