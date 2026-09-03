import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../lib/board';
import { EPS, OP_SYMBOL, displayValue, type Op } from '../lib/solver';
import { Button } from './ui';
import { cn } from '../utils/cn';

interface Props {
  numbers: number[];
  target: number;
  allowedOperators: Op[];
  integerOnly: boolean;
  disabled?: boolean;
  disabledReason?: string;
  penaltyMode: 'none' | 'lock';
  onSolved: (formula: string) => void;
  onPass?: () => void;
  passed?: boolean;
  isCountdown?: boolean;
}

export function PlayArea({
  numbers,
  target,
  allowedOperators,
  integerOnly,
  disabled,
  disabledReason,
  penaltyMode,
  onSolved,
  onPass,
  passed,
  isCountdown,
}: Props) {
  const board = useBoard(numbers, integerOnly);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [wrongShake, setWrongShake] = useState(0);
  const solvedRef = useRef<string | null>(null);
  const key = numbers.join(',') + '|' + target;

  useEffect(() => {
    solvedRef.current = null;
    setLockUntil(0);
    setWrongShake(0);
  }, [key]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!board.finished || board.finalValue === null) return;
    if (Math.abs(board.finalValue - target) < EPS) {
      if (solvedRef.current !== board.finalFormula) {
        solvedRef.current = board.finalFormula;
        onSolved(board.finalFormula);
      }
    } else {
      setWrongShake((w) => w + 1);
      if (penaltyMode === 'lock') setLockUntil(Date.now() + 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.finished, board.finalFormula, board.finalValue, target]);

  const lockRemain = Math.max(0, lockUntil - now);
  const locked = !!disabled || lockRemain > 0 || !!isCountdown || !!passed;
  const wrongFinished =
    board.finished && board.finalValue !== null && Math.abs(board.finalValue - target) >= EPS;
  const penaltyText = penaltyMode === 'lock' ? '誤答時は5秒間入力ロック' : 'ペナルティなし';

  return (
    <div className="flex flex-col gap-4">
      {/* 式表示エリア */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-400/25 bg-gradient-to-b from-indigo-950/60 to-slate-950/60 px-5 py-4">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black tracking-[.3em] text-indigo-300/80">式</div>
            <div
              key={board.flash + '-' + wrongShake}
              className={cn(
                'mt-1 min-h-[36px] truncate text-2xl font-black tabular-nums text-white sm:text-3xl',
                (board.flash > 0 || wrongShake > 0) && 'animate-shake',
              )}
            >
              {isCountdown ? (
                <span className="text-base font-bold text-slate-500">カウントダウン中…</span>
              ) : board.finished ? (
                board.finalFormula
              ) : board.pendingText ? (
                board.pendingText
              ) : (
                <span className="text-base font-bold text-slate-500">数字を選んでね</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-1.5">
            <span className="text-[9px] font-black tracking-widest text-amber-200/70">TARGET</span>
            <span className="text-3xl font-black leading-none text-amber-300">{target}</span>
          </div>
        </div>
        {wrongFinished && !isCountdown && (
          <div className="mt-2 text-xs font-bold text-rose-300">
            結果 {displayValue(board.finalValue!)} … {target} になりませんでした
            {lockRemain > 0 && (
              <span className="text-rose-300/70"> / あと {(lockRemain / 1000).toFixed(0)}秒で解除</span>
            )}
          </div>
        )}
      </div>

      {/* 数字タイル（固定グリッド・空スロットも固定） */}
      <div className="grid grid-cols-4 gap-3 sm:gap-4">
        {board.slots.map((slot) => (
          <div key={slot.id} className="relative aspect-square">
            {slot.tile ? (
              <button
                disabled={locked}
                onClick={() => board.tapNumber(slot.id)}
                className={cn(
                  'tile animate-pop transition-all',
                  slot.id === board.selectedSlot && 'tile-selected',
                  isCountdown && 'text-white/20',
                )}
              >
                {isCountdown ? '?' : displayValue(slot.tile.expr.rat)}
              </button>
            ) : (
              <div className="absolute inset-0 rounded-[20px] border-2 border-dashed border-white/8 bg-white/[0.015]" />
            )}
          </div>
        ))}
      </div>

      {/* 演算子 */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {(['+', '-', '*', '/'] as Op[]).map((op) => {
          const allowed = allowedOperators.includes(op);
          const active = board.pendingOp === op;
          return (
            <button
              key={op}
              disabled={locked || !allowed || board.selectedSlot === null}
              onClick={() => board.tapOp(op)}
              className={cn('op-btn py-4 sm:py-5', active && 'op-btn-active')}
            >
              {OP_SYMBOL[op]}
            </button>
          );
        })}
      </div>

      {/* 操作ボタン */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="soft" onClick={board.undo} disabled={!board.canUndo || locked} className="px-4">
          ↩ 1手戻す
        </Button>
        <Button variant="soft" onClick={board.redo} disabled={!board.canRedo || locked} className="px-4">
          やり直す →
        </Button>
        <div className="grow" />
        {onPass && (
          <Button
            variant="ghost"
            onClick={onPass}
            disabled={!!passed || !!disabled || !!isCountdown}
            title="解けない場合はパスできます。未正解者が全員パスするとラウンド終了になります"
          >
            {passed ? '⏭ パス済み' : '⏭ パスする'}
          </Button>
        )}
        <Button
          variant="danger"
          onClick={board.reset}
          disabled={locked}
          className="px-4"
          title="出題時の状態まで一気に戻します"
        >
          ⟲ 全リセット
        </Button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>
          <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
            Backspace
          </kbd>
          <span className="ml-1.5">でも1手戻せます</span>
        </span>
        <span className="font-bold">⚠ {penaltyText}</span>
      </div>

      {disabled && disabledReason && (
        <div className="animate-float-up rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-center text-sm font-bold text-amber-100">
          {disabledReason}
        </div>
      )}
    </div>
  );
}
