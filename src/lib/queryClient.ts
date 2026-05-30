// Design Ref: §6 State Management — TanStack Query for cache + invalidation
//
// 로컬 SQLite 기반이라 staleTime을 길게 잡고, 등급/세션/설정 변경 시 명시 invalidate.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 로컬 DB → 네트워크 없음 → 길게 캐시
      staleTime: 1000 * 60 * 5,   // 5 min
      gcTime: 1000 * 60 * 30,     // 30 min
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Query key conventions (Design §6.2):
//   ['stats', 'level-progress', level]
//   ['stats', 'overall-progress']
//   ['stats', 'streak']
//   ['stats', 'mature', level]
//   ['word', wordId]
//   ['user-card', wordId]
//   ['queue', 'due', levels]
//   ['queue', 'new', levels, limit]
export const QueryKeys = {
  stats: {
    all: ['stats'] as const,
    levelProgress: (level: string) => ['stats', 'level-progress', level] as const,
    overall: () => ['stats', 'overall-progress'] as const,
    streak: () => ['stats', 'streak'] as const,
    mature: (level: string) => ['stats', 'mature', level] as const,
  },
  word: (wordId: string) => ['word', wordId] as const,
  userCard: (wordId: string) => ['user-card', wordId] as const,
  queue: {
    all: ['queue'] as const,
    due: (levels: readonly string[]) => ['queue', 'due', levels] as const,
    newCards: (levels: readonly string[], limit: number) =>
      ['queue', 'new', levels, limit] as const,
  },
} as const;
