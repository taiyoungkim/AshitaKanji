// 회독(read-through) 엔진 — FSRS와 완전 분리.
//
// 패스(pass) 기반:
//   - 챕터 N = reading_chapter=N 독립 50단어 블록. 한 패스 = 미숙 단어를 한 바퀴.
//   - 안다/모름 모두 최초 노출을 기록하고, 안다만 숙련(known)을 올린다.
//   - 패스 끝(큐 소진): 미숙 남으면 'passEnd', 0이면 'done'.
//     화면은 passEnd를 그리지 않고 바로 reshuffle 한다.
//   - 첫 패스는 빈도순, 다시보기 패스는 셔플.

import type { JlptLevel, Word } from '~/types/Card';
import type { CardRepo } from '~/db/repos/CardRepo';
import type { ReadingProgressRepo } from '~/db/repos/ReadingProgressRepo';

export interface ReadingState {
  level: JlptLevel;
  chapter: number;
  current: Word | null;
  /** 이번 패스 남은 단어. */
  queue: Word[];
  /** 이번 패스 전체 단어 수. */
  passTotal: number;
  /** 이번 패스 진행 수 (안다+모름 모두 카운트). */
  passDone: number;
  /** 이번 패스 모름 수. */
  wrong: number;
  /** 챕터 전체 단어 수. */
  total: number;
  /** 한 번 이상 본 단어 수 — UI의 n/50 진도. */
  covered: number;
  /** 숙달(known 영속) 단어 수 — 챕터 완료 판정. */
  known: number;
  phase: 'study' | 'passEnd' | 'done';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export class ReadingEngine {
  private state: ReadingState | null = null;
  private seenWordIds = new Set<string>();

  constructor(
    private readonly cardRepo: CardRepo,
    private readonly progressRepo: ReadingProgressRepo,
  ) {}

  /** 챕터(회차) 시작/재개. shuffled=false → 빈도순(첫 패스), true → 셔플(다시보기). */
  async startChapter(
    level: JlptLevel,
    chapter: number,
    shuffled = false,
  ): Promise<ReadingState> {
    const words = await this.cardRepo.findChapter(level, chapter);
    const progress = await this.progressRepo.getChapterProgress(level, chapter);
    const notKnown = words.filter((w) => !progress.get(w.id)?.known);
    this.seenWordIds = new Set(words.filter((w) => progress.get(w.id)?.seen).map((w) => w.id));
    const queue = shuffled ? shuffle(notKnown) : notKnown;
    const total = words.length;
    this.state = {
      level,
      chapter,
      queue,
      current: queue[0] ?? null,
      passTotal: queue.length,
      passDone: 0,
      wrong: 0,
      total,
      covered: this.seenWordIds.size,
      known: total - notKnown.length,
      phase: queue.length === 0 ? 'done' : 'study',
    };
    return this.snapshot();
  }

  /** 남은 미숙 단어를 섞어 새 패스 (틀린 것만 다시). */
  async reshuffle(): Promise<ReadingState> {
    const s = this.state;
    if (!s) throw new Error('reading session not started');
    return this.startChapter(s.level, s.chapter, true);
  }

  /** 현재 단어 판정. 둘 다 노출을 영속하고, 안다만 숙련도를 올린다. */
  async mark(known: boolean, now: number = Date.now()): Promise<ReadingState> {
    const s = this.state;
    if (!s) throw new Error('reading session not started');
    if (s.phase !== 'study' || !s.current) return this.snapshot();

    const cur = s.current;
    await this.progressRepo.recordExposure(cur.id, s.chapter, known, now);
    if (!this.seenWordIds.has(cur.id)) {
      this.seenWordIds.add(cur.id);
      s.covered += 1;
    }
    if (known) {
      s.known += 1;
    } else {
      s.wrong += 1;
    }
    s.queue.shift();
    s.passDone += 1;
    s.current = s.queue[0] ?? null;
    if (s.queue.length === 0) {
      s.phase = s.total - s.known === 0 ? 'done' : 'passEnd';
    }
    return this.snapshot();
  }

  getState(): ReadingState | null {
    return this.state ? this.snapshot() : null;
  }

  private snapshot(): ReadingState {
    const s = this.state!;
    return { ...s, queue: [...s.queue] };
  }
}
