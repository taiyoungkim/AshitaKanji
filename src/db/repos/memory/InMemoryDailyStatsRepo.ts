// Design Ref: §8 Test Plan — In-memory test double for DailyStatsRepo.

import type { DailyStats } from '~/types/DailyStats';
import type { DailyStatsRepo } from '../DailyStatsRepo';

export class InMemoryDailyStatsRepo implements DailyStatsRepo {
  private map = new Map<string, DailyStats>();

  async upsert(row: DailyStats): Promise<void> {
    this.map.set(row.date, { ...row });
  }

  async findByDate(date: string): Promise<DailyStats | null> {
    return this.map.get(date) ?? null;
  }

  async findRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    return [...this.map.values()]
      .filter((r) => r.date >= startDate && r.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async findAll(): Promise<DailyStats[]> {
    return [...this.map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
