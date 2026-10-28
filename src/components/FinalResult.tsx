import { useEffect, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { Button, Card, ConfirmDialog, RankBadge } from './ui';
import { IconCrown, IconTrophy } from './icons';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';

export function FinalResult({ ctrl }: { ctrl: UseRoom }) {
  const { players, isGM, uid } = ctrl;
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const ranking = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const maxScore = Math.max(1, ...ranking.map((p) => p.score ?? 0));
  const champ = ranking[0];
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    playSe('finish');
  }, []);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="drift absolute -right-10 top-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="drift-slow absolute -left-10 bottom-10 h-64 w-64 rounded-full bg-cyan-600/10 blur-3xl" />
      </div>

      <div className="mt-auto" />

      <div className="mb-5 text-center">
        <div className="label mb-2 text-amber-200/80">FINAL RESULT</div>
        <h2 className="font-display text-[26px] font-black tracking-[.2em] text-white sm:text-[32px]">
          <span className="grad-solar">MATCH COMPLETE</span>
        </h2>
      </div>

      {/* 優勝パネル */}
      {champ && (
        <Card accent className="mb-4 overflow-hidden p-5">
          <div className="scan-line" />
          <div className="relative flex items-center gap-4">
            <RankBadge rank={1} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="label flex items-center gap-1.5 text-amber-300/90">
                <IconCrown size={11} /> CHAMPION
              </div>
              <div className="num truncate text-[26px] leading-tight font-black text-white sm:text-[30px]">
                {champ.name}
              </div>
              <div className="jp text-[10px] text-slate-400">
                {champ.uid === uid ? 'あなたが1位です' : 'おめでとう！'}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="label text-[8px] text-slate-500">SCORE</div>
              <div className="num text-[34px] leading-none font-black text-amber-300 tabular-nums">
                {champ.score ?? 0}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {ranking.map((p, i) => {
          const rank = i + 1;
          const pct = ((p.score ?? 0) / maxScore) * 100;
          return (
            <div
              key={p.uid}
              className={cn(
                'relative flex items-center gap-3 border px-3 py-2.5',
                rank === 1
                  ? 'border-amber-300/50 bg-amber-400/8'
                  : rank === 2
                    ? 'border-white/25 bg-white/[0.05]'
                    : rank === 3
                      ? 'border-orange-400/40 bg-orange-500/8'
                      : 'border-white/10 bg-black/30',
                p.uid === uid && 'ring-1 ring-cyan-400/40',
              )}
              style={{
                clipPath:
                  'polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)',
              }}
            >
              <RankBadge rank={rank} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="jp truncate text-[14px] font-black text-white">{p.name}</span>
                  {p.uid === uid && (
                    <span className="shrink-0 text-[8px] tracking-wider text-cyan-300/80">YOU</span>
                  )}
                  {rank === 1 && <IconTrophy size={12} className="shrink-0 text-amber-300" />}
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden bg-white/8">
                  <div
                    className={cn(
                      'h-full',
                      rank === 1
                        ? 'bg-gradient-to-r from-amber-300 to-orange-400 shadow-[0_0_10px_rgba(255,176,32,.9)]'
                        : rank === 2
                          ? 'bg-gradient-to-r from-slate-200 to-cyan-200'
                          : rank === 3
                            ? 'bg-gradient-to-r from-orange-300 to-rose-300'
                            : 'bg-gradient-to-r from-cyan-400/70 to-fuchsia-400/70',
                    )}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
              <span className="num shrink-0 text-[24px] font-black text-amber-200 tabular-nums">
                {p.score ?? 0}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {isGM && (
          <Button onClick={ctrl.backToLobby} className="gap-1.5">
            <IconTrophy size={13} /> ロビーに戻る（再戦）
          </Button>
        )}
        <Button variant="ghost" onClick={() => (isGM ? setLeaveConfirm(true) : ctrl.leaveRoom())}>
          退出する
        </Button>
      </div>
      {!isGM && (
        <p className="jp mt-2 text-center text-[10px] text-slate-400">
          GMがロビーに戻すと再戦できます。
        </p>
      )}

      <div className="mb-auto" />

      <ConfirmDialog
        open={leaveConfirm}
        title="ルームを解散しますか？"
        description={
          <>
            GMが退出すると<b className="text-rose-300">ルームは削除されます</b>。
            チャット・スコア・履歴も残りません。
          </>
        }
        confirmLabel="解散して退出"
        cancelLabel="やめる"
        onConfirm={() => {
          setLeaveConfirm(false);
          ctrl.leaveRoom();
        }}
        onCancel={() => setLeaveConfirm(false)}
      />
    </div>
  );
}
