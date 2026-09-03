import type { UseRoom } from '../lib/useRoom';
import { Button, Card } from './ui';
import { cn } from '../utils/cn';

const MEDALS = ['🥇', '🥈', '🥉'];

export function FinalResult({ ctrl }: { ctrl: UseRoom }) {
  const { players, isGM, uid } = ctrl;
  const ranking = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const maxScore = Math.max(1, ...ranking.map((p) => p.score ?? 0));

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="drift absolute -right-10 top-16 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="drift-slow absolute -left-10 bottom-10 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
      </div>

      <div className="mb-6 text-center">
        <div className="chip mx-auto mb-3 inline-block border-amber-300/40 bg-amber-400/10 text-amber-200">
          FINAL RESULT
        </div>
        <h2 className="text-4xl font-black text-white">総合ランキング</h2>
      </div>

      <div className="space-y-3">
        {ranking.map((p, i) => (
          <Card
            key={p.uid}
            className={cn(
              'flex items-center justify-between gap-3 p-4',
              i === 0 && 'card-accent',
              p.uid === uid && 'border-indigo-400/40',
            )}
          >
            <div className="flex items-center gap-4">
              <span className="w-10 text-center text-3xl">{MEDALS[i] ?? `${i + 1}.`}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate text-lg font-black text-white">
                  {p.uid === uid && <span className="text-[10px] text-indigo-300">(you)</span>}
                  {p.name}
                </div>
                <div className="mt-1.5 h-1.5 w-36 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      i === 0
                        ? 'bg-gradient-to-r from-amber-300 to-orange-400'
                        : 'bg-gradient-to-r from-indigo-400 to-fuchsia-400',
                    )}
                    style={{ width: `${((p.score ?? 0) / maxScore) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <span className="text-3xl font-black tabular-nums text-amber-300">{p.score ?? 0}</span>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {isGM && <Button onClick={ctrl.backToLobby}>ロビーに戻る（再戦）</Button>}
        <Button variant="ghost" onClick={ctrl.leaveRoom}>
          退出する
        </Button>
      </div>
      {!isGM && (
        <p className="mt-3 text-center text-xs text-slate-400">
          GMがロビーに戻すと再戦できます。
        </p>
      )}
    </div>
  );
}
