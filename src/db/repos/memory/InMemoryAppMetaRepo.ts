// Design Ref: §8 Test Plan — In-memory test double for AppMetaRepo.

import type { AppMetaRepo } from '../AppMetaRepo';

export class InMemoryAppMetaRepo implements AppMetaRepo {
  private map = new Map<string, string | null>();

  constructor(seed: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(seed)) this.map.set(k, v);
  }

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async getAll(): Promise<Record<string, string | null>> {
    return Object.fromEntries(this.map.entries());
  }
}
