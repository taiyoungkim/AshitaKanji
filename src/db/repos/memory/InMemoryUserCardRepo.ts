// Design Ref: §8 Test Plan — In-memory test double for UserCardRepo.

import type { CardState, JlptLevel, UserCard } from '~/types/Card';
import { MATURE_STABILITY_DAYS, type UserCardRepo } from '../UserCardRepo';

export class InMemoryUserCardRepo implements UserCardRepo {
  private map = new Map<string, UserCard>();

  // countMatureByLevel 용 word_id → level 룩업 (테스트에서 주입). 없으면 0 반환.
  constructor(
    seed: UserCard[] = [],
    private readonly wordLevels: Map<string, JlptLevel> = new Map(),
  ) {
    for (const c of seed) this.map.set(c.word_id, c);
  }

  async findById(wordId: string): Promise<UserCard | null> {
    return this.map.get(wordId) ?? null;
  }

  async findAllDue(nowMs: number): Promise<UserCard[]> {
    return [...this.map.values()]
      .filter((c) => c.state !== 'new' && c.due <= nowMs)
      .sort((a, b) => a.due - b.due);
  }

  async existingWordIds(): Promise<string[]> {
    return [...this.map.keys()];
  }

  async upsert(card: UserCard): Promise<void> {
    this.map.set(card.word_id, { ...card });
  }

  async markLeech(wordId: string): Promise<void> {
    const c = this.map.get(wordId);
    if (c) c.leech = 1;
  }

  async countByState(state: CardState): Promise<number> {
    return [...this.map.values()].filter((c) => c.state === state).length;
  }

  async countMatureByLevel(level: JlptLevel): Promise<number> {
    return [...this.map.values()].filter(
      (c) =>
        c.stability >= MATURE_STABILITY_DAYS &&
        this.wordLevels.get(c.word_id) === level,
    ).length;
  }

  async countStudiedByLevel(level: JlptLevel): Promise<number> {
    return [...this.map.values()].filter(
      (c) => this.wordLevels.get(c.word_id) === level,
    ).length;
  }

  async findLeeches(): Promise<UserCard[]> {
    return [...this.map.values()].filter((c) => c.leech === 1);
  }

  async findAll(): Promise<UserCard[]> {
    return [...this.map.values()].map((c) => ({ ...c }));
  }
}
