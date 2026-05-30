// Design Ref: §8 Test Plan — In-memory test double for SessionRepo.

import type { SessionRecord } from '~/types/Session';
import type { SessionRepo } from '../SessionRepo';

export class InMemorySessionRepo implements SessionRepo {
  private map = new Map<number, SessionRecord>();
  private seq = 0;

  async create(rec: SessionRecord): Promise<number> {
    const id = ++this.seq;
    this.map.set(id, { ...rec, id });
    return id;
  }

  async update(id: number, patch: Partial<SessionRecord>): Promise<void> {
    const cur = this.map.get(id);
    if (cur) this.map.set(id, { ...cur, ...patch, id });
  }

  async findById(id: number): Promise<SessionRecord | null> {
    return this.map.get(id) ?? null;
  }

  async findAll(): Promise<SessionRecord[]> {
    return [...this.map.values()];
  }
}
