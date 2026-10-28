import type { Settings } from './types';

export function getRankPoints(rank: number, maxRankCount: number, mode: Settings['scoringMode'], customPoints: number[] = []): number {
  if (rank > maxRankCount) return 0;
  if (mode === 'first') return rank === 1 ? 1 : 0;
  if (mode === 'flat') return 1;
  if (mode === 'custom') return Math.max(0, Math.min(9999, Math.floor(Number(customPoints[rank - 1]) || 0))); 
  // rank mode: 1位 = maxRankCount点, 2位 = maxRankCount - 1点, ...
  return Math.max(1, maxRankCount - rank + 1);
}

