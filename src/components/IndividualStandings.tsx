import type { IndividualStanding } from '../lib/teams';
import { RankBadge } from './ui';
import { TeamBadge } from './TeamBadge';
import { cn } from '../utils/cn';

/**
 * 個人成績リスト（チーム戦でも個人の順位・得点・1位数・正解数を必ず見られるようにする）。
 *
 * reveal=false のときは「結果発表まで隠す」設定に従い、順位・得点・回数を出さない。
 * その場合 rows は得点順ではない順序で渡すこと（並び順からも推測できないように）。
 */
export function IndividualStandings({
  rows,
  myUid,
  reveal = true,
  compact = false,
}: {
  rows: IndividualStanding[];
  myUid?: string | null;
  reveal?: boolean;
  compact?: boolean;
}) {
  const maxScore = Math.max(1, ...rows.map((r) => r.score));
  if (rows.length === 0) {
    return <p className="jp text-[11px] text-slate-500">プレイヤーがいません</p>;
  }
  return (
    <ul className={compact ? 'space-y-1' : 'space-y-2'}>
      {rows.map((r) => {
        const mine = r.uid === myUid;
        return (
          <li
            key={r.uid}
            className={cn(
              'relative flex items-center gap-2.5 border px-2.5',
              compact ? 'py-1.5' : 'py-2.5',
              reveal && r.rank === 1
                ? 'border-amber-300/50 bg-amber-400/8'
                : reveal && r.rank === 2
                  ? 'border-white/25 bg-white/[0.05]'
                  : reveal && r.rank === 3
                    ? 'border-orange-400/40 bg-orange-500/8'
                    : 'border-white/10 bg-black/30',
              mine && 'ring-1 ring-cyan-400/40',
            )}
            style={
              compact
                ? undefined
                : {
                    clipPath:
                      'polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)',
                  }
            }
          >
            {reveal ? (
              <RankBadge rank={r.rank} size={compact ? 'sm' : 'md'} />
            ) : (
              <span className="num grid h-9 w-9 shrink-0 place-items-center border border-white/12 text-[11px] font-black text-slate-500">
                ?
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn('jp font-black break-words text-white', compact ? 'text-[12px]' : 'text-[14px]')}
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {r.name}
                </span>
                {mine && (
                  <span className="shrink-0 text-[8px] tracking-wider text-cyan-300/80">YOU</span>
                )}
                <TeamBadge teamId={r.teamId} size="sm" />
              </div>
              {reveal ? (
                <div className="jp mt-0.5 flex flex-wrap gap-x-2.5 text-[9px] text-slate-400">
                  <span>
                    個人{r.rank}位
                  </span>
                  <span>1位 {r.firstPlaceCount}回</span>
                  <span>正解 {r.correctCount}回</span>
                </div>
              ) : (
                <div className="jp mt-0.5 text-[9px] text-slate-500">結果発表まで非公開</div>
              )}
              {!compact && reveal && (
                <div className="mt-1.5 h-1 w-full overflow-hidden bg-white/8">
                  <div
                    className={cn(
                      'h-full',
                      r.rank === 1
                        ? 'bg-gradient-to-r from-amber-300 to-orange-400 shadow-[0_0_10px_rgba(255,176,32,.9)]'
                        : r.rank === 2
                          ? 'bg-gradient-to-r from-slate-200 to-cyan-200'
                          : r.rank === 3
                            ? 'bg-gradient-to-r from-orange-300 to-rose-300'
                            : 'bg-gradient-to-r from-cyan-400/70 to-fuchsia-400/70',
                    )}
                    style={{ width: `${Math.max(4, (r.score / maxScore) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            {reveal ? (
              <span
                className={cn(
                  'num shrink-0 font-black text-amber-200 tabular-nums',
                  compact ? 'text-[17px]' : 'text-[24px]',
                )}
              >
                {r.score}
                {compact && <span className="ml-0.5 text-[9px] text-slate-500">点</span>}
              </span>
            ) : (
              <span className="jp shrink-0 text-[9px] font-bold tracking-wider text-slate-500">非公開</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
