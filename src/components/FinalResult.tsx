import { useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { ChatPanel } from './ChatPanel';
import { Button, Card, ConfirmDialog, Icon, Rule } from './ui';
import { cn } from '../utils/cn';

const RANK_LABEL = ['I', 'II', 'III'];

export function FinalResult({ ctrl }: { ctrl: UseRoom }) {
  const { players, isGM, uid } = ctrl;
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const ranking = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const maxScore = Math.max(1, ...ranking.map((p) => p.score ?? 0));
  const winner = ranking[0];
  const tied = ranking.length >= 2 && (ranking[1].score ?? 0) === (ranking[0].score ?? 0);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="absolute left-1/2 top-0 h-[360px] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[rgba(201,162,39,0.35)] to-transparent" />
      </div>

      <div className="mt-auto" />

      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-[var(--hair)]" />
          <span className="eyebrow">Final result</span>
          <span className="h-px w-10 bg-[var(--hair)]" />
        </div>
        <h2 className="ink-title display mt-3 text-[2.5rem] leading-none tracking-[0.06em] sm:text-[3.2rem]">
          総合ランキング
        </h2>
        {winner && (
          <p className="mt-3 text-[12px] text-bone-dim">
            <Icon name="award" className="mr-1.5 inline h-3.5 w-3.5 text-brass" />
            <span className="text-bone">{winner.name}</span> が首位
            {tied && <span className="numeral ml-2 text-[10px] text-brass">TIE AT TOP</span>}
          </p>
        )}
      </div>

      <div className="mt-7 space-y-2">
        {ranking.map((p, i) => {
          const isMe = p.uid === uid;
          const isTop = i === 0;
          return (
            <Card
              key={p.uid}
              accent={isTop}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-3.5',
                isTop && 'border-brass/40',
                isMe && !isTop && 'border-blood/50',
              )}
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center border',
                    isTop
                      ? 'border-brass/60 bg-brass/10 text-brass'
                      : 'border-[var(--hair)] bg-black/30 text-bone-faint',
                  )}
                >
                  <span className="display text-[15px] leading-none">
                    {RANK_LABEL[i] ?? String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[15px] text-bone">{p.name}</span>
                    {isMe && (
                      <span className="numeral shrink-0 text-[9px] tracking-[0.12em] text-[#ff8a9b]">
                        YOU
                      </span>
                    )}
                    {p.uid === ctrl.room?.gmUid && (
                      <span className="numeral shrink-0 border border-brass/45 px-1 text-[9px] tracking-[0.1em] text-brass">
                        GM
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-[3px] w-32 overflow-hidden bg-[var(--hair-soft)] sm:w-44">
                    <div
                      className={cn('h-full', isTop ? 'bar-track' : 'bg-bone-faint/70')}
                      style={{ width: `${((p.score ?? 0) / maxScore) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-1">
                <span
                  className={cn(
                    'numeral text-[26px] leading-none',
                    isTop ? 'text-brass' : 'text-bone',
                  )}
                >
                  {p.score ?? 0}
                </span>
                <span className="numeral text-[9px] tracking-[0.16em] text-bone-faint">PTS</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {isGM && (
          <Button onClick={ctrl.backToLobby} className="py-3">
            <Icon name="redo" className="h-3.5 w-3.5" />
            <span>ロビーに戻る（再戦）</span>
          </Button>
        )}
        <Button
          variant="ghost"
          className="border border-[var(--hair)] py-3 text-bone-dim"
          onClick={() => (isGM ? setLeaveConfirm(true) : ctrl.leaveRoom())}
        >
          <Icon name="exit" className="h-3.5 w-3.5" />
          <span>退出する</span>
        </Button>
      </div>
      {!isGM && (
        <p className="numeral mt-3 text-center text-[10px] leading-relaxed tracking-[0.14em] text-bone-faint">
          GM RETURNS TO LOBBY TO REMATCH
        </p>
      )}

      <div className="mx-auto mt-7 w-full max-w-xl">
        <Rule className="mb-4" />
        <ChatPanel ctrl={ctrl} />
      </div>

      <div className="mb-auto" />

      <ConfirmDialog
        open={leaveConfirm}
        title="ルームを解散しますか？"
        description={
          <>
            GM が退出すると<b className="text-[#ff8a9b]">ルームは削除されます</b>。
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
