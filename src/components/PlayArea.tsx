import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../lib/board';
import { EPS, OP_SYMBOL, displayValue, type Op } from '../lib/solver';
import { Button, ConfirmDialog } from './ui';
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
  /** パスの取り消し（ラウンド中のみ有効） */
  onCancelPass?: () => void;
  /** パス中でも解答はできる（数字を触ったらパスを取り消す） */
  passed?: boolean;
  isCountdown?: boolean;
  /** 出題が変わったことを検知するためのキー（数字が同じでも次の問題なら盤面をリセット） */
  roundKey?: string | number;
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
  roundKey,
}: Props) {
  // 「数字が同じで目標値だけ違う次の問題」でも盤面を必ず作り直す
  const boardKey = `${numbers.join(',')}|${target}|${roundKey ?? ''}`;
  const board = useBoard(numbers, integerOnly, boardKey);
  // お手つきロックは問題が変わったら無効（前ラウンドの残り時間を引き継がない）
  const [lockState, setLockState] = useState<{ key: string; until: number }>({ key: '', until: 0 });
  const [now, setNow] = useState(Date.now());
  const [wrongShake, setWrongShake] = useState(0);
  const [confirmPass, setConfirmPass] = useState(false);
  const solvedRef = useRef<string | null>(null);
  const resumeRequestedRef = useRef(false);

  useEffect(() => {
    solvedRef.current = null;
    setWrongShake(0);
    setConfirmPass(false);
  }, [boardKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!board.finished || board.finalValue === null) return;
    if (Math.abs(board.finalValue - target) < EPS) {
      if (solvedRef.current !== board.finalFormula) {
        solvedRef.current = board.finalFormula;
        onSolved(board.finalFormula, board.finalKey);
      }
    } else {
      setWrongShake((w) => w + 1);
      if (penaltyMode === 'lock') setLockState({ key: boardKey, until: Date.now() + 5000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.finished, board.finalFormula, board.finalValue, target]);

  const lockRemain = lockState.key === boardKey ? Math.max(0, lockState.until - now) : 0;
  // パス中でも解き直せる（パスは「降参の意思表示」であって解答権の放棄ではない）
  const locked = !!disabled || lockRemain > 0 || !!isCountdown;
  const wrongFinished =
    board.finished && board.finalValue !== null && Math.abs(board.finalValue - target) >= EPS;
  const penaltyText = penaltyMode === 'lock' ? '誤答時は5秒間入力ロック' : 'ペナルティなし';
  const canRequestPass = !!onPass && !passed && !disabled && !isCountdown;
  /** パス中に操作したら「やっぱり解く」とみなしてパスを取り消す */
  const resumeIfPassed = () => {
    if (!passed || !onCancelPass || resumeRequestedRef.current) return;
    resumeRequestedRef.current = true;
    onCancelPass();
  };

  useEffect(() => {
    if (!passed) resumeRequestedRef.current = false;
  }, [passed]);

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
                onClick={() => {
                  resumeIfPassed();
                  board.tapNumber(slot.id);
                }}
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
              onClick={() => {
                resumeIfPassed();
                board.tapOp(op);
              }}
              className={cn('op-btn py-4 sm:py-5', active && 'op-btn-active')}
            >
              {OP_SYMBOL[op]}
            </button>
          );
        })}
      </div>

      {/* 操作ボタン（全リセットはパスと離した左上のまとまりに配置） */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="soft"
          onClick={board.undo}
          disabled={!board.canUndo || locked}
          className="px-3 py-2.5 text-xs"
        >
          ↩ 1手戻す
        </Button>
        <Button
          variant="soft"
          onClick={board.redo}
          disabled={!board.canRedo || locked}
          className="px-3 py-2.5 text-xs"
        >
          やり直す →
        </Button>
        <div className="grow" />
        <Button
          variant="soft"
          onClick={board.reset}
          disabled={locked}
          className="px-3 py-2.5 text-xs"
          title="式を出題時の状態まで一気に戻します"
        >
          ⟲ 全リセット
        </Button>
      </div>

      {/* パスは「全リセット」と混同しないよう、区切り線を入れて別ブロックに配置 */}
      {onPass && (
        <div className="mt-1 border-t border-white/10 pt-4">
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.04] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-black tracking-wide text-amber-200">
                <span aria-hidden>⏭</span>
                <span>{passed ? 'この問題はパスしました' : 'この問題をあきらめる'}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                {passed
                  ? 'パス中でも解答OK。数字をタップするとパスを取り消して解答に戻れます'
                  : '未正解の人が全員パスするとラウンド終了。押しただけでは解答権は失われません'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {passed ? (
                <Button
                  variant="soft"
                  className="px-3 py-2 text-xs"
                  disabled={!onCancelPass}
                  onClick={onCancelPass}
                  title="ラウンドが終了していなければ解答に戻れます"
                >
                  ↩ パスを取り消す
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="border border-white/10 px-3 py-2 text-xs text-slate-300"
                  disabled={!canRequestPass}
                  onClick={() => setConfirmPass(true)}
                >
                  ⏭ パスする
                </Button>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
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

      <ConfirmDialog
        open={confirmPass}
        title="この問題をパスしますか？"
        description={
          <>
            パスすると「未正解の人が全員パスしたら終了」の判定対象になります。
            <br />
            パスしたあとでも<b className="text-amber-300">解答はできます</b>（数字を触るとパスを取り消します）。
            <span className="mt-1 block text-xs text-slate-400">
              全員パスで終了するまで少し猶予があるので、誤タップも取り消せます
            </span>
          </>
        }
        confirmLabel="パスする"
        cancelLabel="やめる"
        onConfirm={() => {
          setConfirmPass(false);
          onPass?.();
        }}
        onCancel={() => setConfirmPass(false)}
      />
    </div>
  );
}
