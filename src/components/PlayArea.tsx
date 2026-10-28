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
  /** formula: 表示用の式文字列 / key: 解答例との照合に使う等価判定キー */
  onSolved: (formula: string, key: string) => void;
  onPass?: () => void;
  /** パスの取り消し（パス後も解答できるので、明示的に戻せるようにする） */
  onCancelPass?: () => void;
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
  onCancelPass,
  passed,
  isCountdown,
}: Props) {
  const board = useBoard(numbers, integerOnly);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [wrongShake, setWrongShake] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const solvedRef = useRef<string | null>(null);
  const key = numbers.join(',') + '|' + target;

  useEffect(() => {
    solvedRef.current = null;
    setLockUntil(0);
    setWrongShake(0);
    setConfirmReset(false);
  }, [key]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // 「全リセット」は誤タップ防止のため、押してから4秒以内にもう一度押すと実行
  useEffect(() => {
    if (!confirmReset) return;
    const id = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(id);
  }, [confirmReset]);

  useEffect(() => {
    if (!board.finished || board.finalValue === null) return;
    if (Math.abs(board.finalValue - target) < EPS) {
      if (solvedRef.current !== board.finalFormula) {
        solvedRef.current = board.finalFormula;
        onSolved(board.finalFormula, board.finalKey);
      }
    } else {
      setWrongShake((w) => w + 1);
      if (penaltyMode === 'lock') setLockUntil(Date.now() + 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.finished, board.finalFormula, board.finalValue, target]);

  const lockRemain = Math.max(0, lockUntil - now);
  // パス中でも解答できるように、パスはロック条件に含めない
  const locked = !!disabled || lockRemain > 0 || !!isCountdown;
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-rose-300">
              結果 {displayValue(board.finalValue!)} … {target} になりませんでした
              {lockRemain > 0 && (
                <span className="text-rose-300/70"> / あと {(lockRemain / 1000).toFixed(0)}秒で解除</span>
              )}
            </span>
            <button
              type="button"
              disabled={locked}
              onClick={board.reset}
              className="rounded-full border border-rose-300/40 bg-rose-500/15 px-3 py-1 text-[11px] font-bold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-40"
            >
              ⟲ 式を消してやり直す
            </button>
          </div>
        )}
        {passed && !isCountdown && (
          <div className="mt-2 text-[11px] font-bold text-slate-400">
            ⏭ パス中 — ひらめいたら、このまま式を作って解答できます
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

      {/* 操作（式の編集） */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="soft" onClick={board.undo} disabled={!board.canUndo || locked} className="px-4">
          ↩ 1手戻す
        </Button>
        <Button variant="soft" onClick={board.redo} disabled={!board.canRedo || locked} className="px-4">
          やり直す →
        </Button>
      </div>

      {/* パス: 「全リセット」とは別ブロック・別の見た目にして誤タップを防ぐ */}
      {onPass && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => (passed ? onCancelPass?.() : onPass())}
            disabled={!!disabled || !!isCountdown || (!!passed && !onCancelPass)}
            className={cn(
              'w-full rounded-2xl border-2 border-dashed px-4 py-3 text-sm font-bold transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40',
              passed
                ? 'border-slate-500/40 bg-white/5 text-slate-300 hover:bg-white/10'
                : 'border-white/15 bg-white/[0.03] text-slate-200 hover:border-amber-300/50 hover:bg-amber-400/10 hover:text-amber-100',
            )}
          >
            {passed ? '↩ パスを取り消す' : '⏭ この問題をパスする'}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-slate-500">
            {passed
              ? 'パス中でも解答できます。正解するとパスは自動で取り消されます'
              : '解けなくても大丈夫。パスしても、あとから解答すればOK'}
          </p>
        </div>
      )}

      {/* ここで区切って、全リセットは右下のはじに小さく置く（パスと離す） */}
      <div>
        <div className="glass-divider mb-2" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
              Backspace
            </kbd>
            <span className="ml-1.5">でも1手戻せます</span>
          </span>
          <div className="flex items-center justify-end gap-2">
            {confirmReset ? (
              <>
                <span className="text-[11px] font-bold text-rose-200">本当にリセット？</span>
                <button
                  type="button"
                  onClick={() => {
                    board.reset();
                    setConfirmReset(false);
                  }}
                  className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-rose-500"
                >
                  リセット
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10"
                >
                  やめる
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={locked}
                title="出題時の状態まで一気に戻します（誤タップ防止のため確認あり）"
                className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-white/8 hover:text-slate-200 disabled:opacity-40"
              >
                ⟲ 全リセット
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end text-[11px] text-slate-500">
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
