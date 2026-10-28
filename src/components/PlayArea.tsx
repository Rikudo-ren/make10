import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../lib/board';
import { EPS, OP_SYMBOL, displayValue, type Op } from '../lib/solver';
import { Button, Icon } from './ui';
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
  const solvedRef = useRef<string | null>(null);
  const resumeRequestedRef = useRef(false);

  useEffect(() => {
    solvedRef.current = null;
    setWrongShake(0);
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
  const penaltyText = penaltyMode === 'lock' ? '誤答時は5秒間ロック' : 'ペナルティなし';
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
      {/* 式表示 */}
      <div className="relative border border-[var(--hair)] bg-black/45 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Expression</div>
            <div
              key={board.flash + '-' + wrongShake}
              className={cn(
                'mt-2 min-h-[42px] break-words text-[22px] leading-tight sm:text-[28px]',
                'display text-bone',
                (board.flash > 0 || wrongShake > 0) && 'animate-shake',
              )}
            >
              {isCountdown ? (
                <span className="text-[13px] tracking-[0.3em] text-bone-faint">STANDBY</span>
              ) : board.finished ? (
                board.finalFormula
              ) : board.pendingText ? (
                board.pendingText
              ) : (
                <span className="text-[13px] tracking-[0.14em] text-bone-faint">
                  数字を選択して開始
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 border border-brass/45 bg-brass/[0.06] px-4 py-2 text-center">
            <div className="eyebrow text-brass/80">Target</div>
            <div className="display mt-0.5 text-[34px] leading-none text-brass">{target}</div>
          </div>
        </div>

        {wrongFinished && !isCountdown && (
          <div className="mt-3 border-l-2 border-blood pl-2.5 text-[12px] leading-relaxed text-[#ff9aa8]">
            結果 {displayValue(board.finalValue!)} — {target} になりませんでした
            {lockRemain > 0 && (
              <span className="numeral ml-1.5 text-[11px] text-blood">
                LOCK {(lockRemain / 1000).toFixed(0)}s
              </span>
            )}
          </div>
        )}
      </div>

      {/* 数字タイル（固定グリッド・空スロットも固定） */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
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
                  'tile',
                  slot.id === board.selectedSlot && 'tile-selected',
                  isCountdown && 'text-bone/15',
                )}
              >
                {isCountdown ? '—' : displayValue(slot.tile.expr.rat)}
              </button>
            ) : (
              <div className="tile-empty absolute inset-0" />
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
              className={cn('op-btn py-3.5 sm:py-4', active && 'op-btn-active')}
            >
              {OP_SYMBOL[op]}
            </button>
          );
        })}
      </div>

      {/* 操作列 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="soft"
          onClick={board.undo}
          disabled={!board.canUndo || locked}
          className="px-3 py-2 text-[10px]"
        >
          <Icon name="undo" className="h-3.5 w-3.5" />
          <span>1手戻す</span>
        </Button>
        <Button
          variant="soft"
          onClick={board.redo}
          disabled={!board.canRedo || locked}
          className="px-3 py-2 text-[10px]"
        >
          <Icon name="redo" className="h-3.5 w-3.5" />
          <span>やり直す</span>
        </Button>
        <div className="grow" />
        <Button
          variant="ghost"
          onClick={board.reset}
          disabled={locked}
          className="px-3 py-2 text-[10px] text-bone-dim"
          title="式を出題時の状態まで一気に戻します"
        >
          <Icon name="reset" className="h-3.5 w-3.5" />
          <span>全リセット</span>
        </Button>
      </div>

      {/* パス: 左側に分離し、全リセット（右端）から離す */}
      {onPass && (
        <div className="border-t border-[var(--hair)] pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {passed ? (
              <Button
                variant="soft"
                className="px-3 py-2 text-[10px]"
                disabled={!onCancelPass}
                onClick={onCancelPass}
                title="ラウンドが終了していなければ解答に戻れます"
              >
                <Icon name="undo" className="h-3.5 w-3.5" />
                <span>パスを取り消す</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="border border-[var(--hair)] px-3 py-2 text-[10px] text-bone-dim"
                disabled={!canRequestPass}
                onClick={onPass}
                title="未正解の人が全員パスするとラウンド終了になります"
              >
                <Icon name="skip" className="h-3.5 w-3.5" />
                <span>パスする</span>
              </Button>
            )}
            <span className="text-[11px] leading-relaxed text-bone-faint">
              {passed
                ? 'パス中でも解答可（数字を触ると取り消し）'
                : '解けないときのみ。押しただけでは解答権は失われません'}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="numeral text-[10px] tracking-[0.12em] text-bone-faint">
          [BACKSPACE] 1手戻す
        </span>
        <span className="numeral text-[10px] tracking-[0.12em] text-bone-faint">
          PENALTY — {penaltyText}
        </span>
      </div>

      {disabled && disabledReason && (
        <div className="animate-rise border-l-2 border-brass bg-brass/[0.07] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#efd894]">
          {disabledReason}
        </div>
      )}
    </div>
  );
}
